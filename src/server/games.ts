import "server-only";

import { FieldValue, Timestamp, type Query, type QueryDocumentSnapshot, type Transaction } from "firebase-admin/firestore";

import type { GameDetail, GameParticipant, GameSummary } from "@/types/domain";
import { collections, db, participantsOf, votesOf } from "./firebase";
import { badRequest, conflict, forbidden, notFound } from "./errors";
import { createNotification } from "./notifications";
import type { GameDocument, ParticipantDocument, UserDocument, VoteDocument } from "./types";
import type { CreateGameInput, ListGamesQuery } from "./validators";

/**
 * How many votes a proposal needs before it confirms itself: half the roster,
 * never fewer than two, so an organiser cannot rubber-stamp their own game.
 */
export const voteThresholdFor = (game: Pick<GameDocument, "maxPlayers" | "voteThreshold">) =>
  game.voteThreshold ?? Math.max(2, Math.ceil(game.maxPlayers / 2));

const serializeGame = (id: string, game: GameDocument): GameSummary => ({
  id,
  title: game.title,
  description: game.description ?? "",
  sport: game.sport,
  status: game.status,
  createdBy: game.createdBy,
  createdByName: game.createdByName ?? "",
  scheduledFor: game.scheduledFor.toDate().toISOString(),
  votingEndsAt: game.votingEndsAt.toDate().toISOString(),
  maxPlayers: game.maxPlayers,
  participantCount: game.participantCount,
  waitlistCount: game.waitlistCount,
  voteCount: game.voteCount,
  location: game.location,
  createdAt: game.createdAt.toDate().toISOString(),
  updatedAt: game.updatedAt.toDate().toISOString()
});

const serializeParticipant = (participant: ParticipantDocument): GameParticipant => ({
  userId: participant.userId,
  displayName: participant.displayName ?? "Player",
  status: participant.status,
  joinedAt: participant.joinedAt.toDate().toISOString(),
  promotedAt: participant.promotedAt?.toDate().toISOString() ?? null
});

/** A failed notification must never take down the action that triggered it. */
const notifyQuietly = (input: Parameters<typeof createNotification>[0]) =>
  createNotification(input).catch(() => undefined);

/* -------------------------------------------------------------------- Reads */

export const listGames = async (filters: ListGamesQuery = {}): Promise<GameSummary[]> => {
  let query: Query = collections.games;

  if (filters.sport) query = query.where("sport", "==", filters.sport);
  if (filters.status) query = query.where("status", "==", filters.status);

  // Sorted in memory so a filtered read never needs a composite index.
  const snapshot = await query.limit(filters.limit ?? 200).get();

  return snapshot.docs
    .map((document) => serializeGame(document.id, document.data() as GameDocument))
    .sort(
      (left, right) =>
        new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime()
    );
};

export const getGameById = async (gameId: string): Promise<GameDetail> => {
  const gameRef = collections.games.doc(gameId);
  const [gameSnapshot, participantsSnapshot, votesSnapshot] = await Promise.all([
    gameRef.get(),
    gameRef.collection("participants").orderBy("joinedAt", "asc").get(),
    gameRef.collection("votes").get()
  ]);

  if (!gameSnapshot.exists) {
    throw notFound("Game not found");
  }

  const game = gameSnapshot.data() as GameDocument;

  return {
    ...serializeGame(gameSnapshot.id, game),
    participants: participantsSnapshot.docs.map((document) =>
      serializeParticipant(document.data() as ParticipantDocument)
    ),
    voterUserIds: votesSnapshot.docs.map(
      (document) => (document.data() as VoteDocument).userId ?? document.id
    ),
    voteThreshold: voteThresholdFor(game)
  };
};

/* ------------------------------------------------------------------- Writes */

export const createGame = async (
  input: CreateGameInput,
  actor: { uid: string; displayName: string }
): Promise<GameSummary> => {
  const gameRef = collections.games.doc();
  const now = Timestamp.now();

  const gameDocument: GameDocument = {
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    sport: input.sport,
    status: "proposed",
    createdBy: actor.uid,
    createdByName: actor.displayName,
    scheduledFor: Timestamp.fromDate(new Date(input.scheduledFor)),
    votingEndsAt: Timestamp.fromDate(new Date(input.votingEndsAt)),
    maxPlayers: input.maxPlayers,
    participantCount: 1,
    waitlistCount: 0,
    voteCount: 0,
    voteThreshold: Math.max(2, Math.ceil(input.maxPlayers / 2)),
    location: input.location,
    createdAt: now,
    updatedAt: now
  };

  // The organiser is on their own roster — otherwise they must join their own game.
  const organiser: ParticipantDocument = {
    gameId: gameRef.id,
    userId: actor.uid,
    displayName: actor.displayName,
    status: "joined",
    joinedAt: now
  };

  const batch = db.batch();
  batch.set(gameRef, gameDocument);
  batch.set(participantsOf(gameRef.id).doc(actor.uid), organiser);
  await batch.commit();

  await notifyQuietly({
    recipientUserId: actor.uid,
    type: "vote_update",
    title: "Your game is live",
    body: `${input.title} is on the board and open for voting.`,
    gameId: gameRef.id
  });

  return serializeGame(gameRef.id, gameDocument);
};

export const joinGame = async (gameId: string, actor: { uid: string; displayName: string }) => {
  const gameRef = collections.games.doc(gameId);
  const participantRef = participantsOf(gameId).doc(actor.uid);

  const result = await db.runTransaction(async (transaction) => {
    const [gameSnapshot, participantSnapshot] = await transaction.getAll(gameRef, participantRef);

    if (!gameSnapshot.exists) throw notFound("Game not found");
    if (participantSnapshot.exists) {
      throw conflict("You have already joined or waitlisted for this game");
    }

    const game = gameSnapshot.data() as GameDocument;

    if (game.status === "cancelled" || game.status === "completed") {
      throw badRequest("This game is no longer accepting participants");
    }

    const joinedStatus = game.participantCount < game.maxPlayers ? "joined" : "waitlisted";
    const now = Timestamp.now();

    transaction.set(participantRef, {
      gameId,
      userId: actor.uid,
      displayName: actor.displayName,
      status: joinedStatus,
      joinedAt: now
    } satisfies ParticipantDocument);

    transaction.update(gameRef, {
      participantCount: FieldValue.increment(joinedStatus === "joined" ? 1 : 0),
      waitlistCount: FieldValue.increment(joinedStatus === "waitlisted" ? 1 : 0),
      updatedAt: now
    });

    return { status: joinedStatus, game };
  });

  if (result.game.createdBy !== actor.uid) {
    await notifyQuietly({
      recipientUserId: result.game.createdBy,
      type: "waitlist_update",
      title: result.status === "joined" ? "A player joined" : "A player is waitlisted",
      body: `${actor.displayName} ${
        result.status === "joined" ? "joined" : "is waiting for a spot in"
      } ${result.game.title}.`,
      gameId
    });
  }

  return {
    status: result.status,
    message:
      result.status === "joined"
        ? "You are on the roster"
        : "The roster is full, so you were added to the waitlist"
  };
};

/**
 * Finds the player who has been waiting longest.
 *
 * The ordered form needs a composite index on (status, joinedAt); without it we
 * still promote someone rather than failing the whole transaction, just not
 * necessarily the longest-waiting player.
 */
const findNextWaitlisted = async (
  transaction: Transaction,
  gameId: string
): Promise<QueryDocumentSnapshot | undefined> => {
  const waitlisted = participantsOf(gameId).where("status", "==", "waitlisted");

  try {
    const ordered = await transaction.get(waitlisted.orderBy("joinedAt", "asc").limit(1));
    return ordered.docs[0];
  } catch {
    const unordered = await transaction.get(waitlisted.limit(1));
    return unordered.docs[0];
  }
};

/**
 * Removes a participant and, when a roster spot opens up, promotes the player
 * who has been on the waitlist longest.
 */
const releaseSpot = async (
  gameId: string,
  participantUserId: string,
  options: { requireCreator?: string; selfLeave?: boolean } = {}
) => {
  const gameRef = collections.games.doc(gameId);
  const participantRef = participantsOf(gameId).doc(participantUserId);

  return db.runTransaction(async (transaction) => {
    const [gameSnapshot, participantSnapshot] = await transaction.getAll(gameRef, participantRef);

    if (!gameSnapshot.exists) throw notFound("Game not found");

    const game = gameSnapshot.data() as GameDocument;

    if (options.requireCreator && game.createdBy !== options.requireCreator) {
      throw forbidden("Only the organiser can remove players");
    }

    if (!participantSnapshot.exists) {
      throw notFound(
        options.selfLeave ? "You are not part of this game" : "That player is not on this game"
      );
    }

    if (options.selfLeave && game.createdBy === participantUserId) {
      throw badRequest("Organisers cannot leave their own game — cancel it instead");
    }

    const participant = participantSnapshot.data() as ParticipantDocument;
    const wasJoined = participant.status === "joined";

    // Every read must happen before the first write in a Firestore transaction.
    const promotion = wasJoined ? await findNextWaitlisted(transaction, gameId) : undefined;
    const promoted = promotion ? (promotion.data() as ParticipantDocument) : undefined;

    const now = Timestamp.now();

    // The leaver frees a roster spot; a promotion immediately takes it back.
    const rosterDelta = (wasJoined ? -1 : 0) + (promoted ? 1 : 0);
    const waitlistDelta = (participant.status === "waitlisted" ? -1 : 0) + (promoted ? -1 : 0);

    transaction.delete(participantRef);

    if (promotion) {
      transaction.update(promotion.ref, { status: "joined", promotedAt: now });
    }

    transaction.update(gameRef, {
      participantCount: FieldValue.increment(rosterDelta),
      waitlistCount: FieldValue.increment(waitlistDelta),
      updatedAt: now
    });

    return { game, participant, promoted };
  });
};

export const leaveGame = async (gameId: string, uid: string) => {
  const { participant, promoted, game } = await releaseSpot(gameId, uid, { selfLeave: true });

  if (promoted) {
    await notifyQuietly({
      recipientUserId: promoted.userId,
      type: "waitlist_update",
      title: "You are on the roster",
      body: `A spot opened up in ${game.title} and you were moved off the waitlist.`,
      gameId
    });
  }

  return participant.status === "joined"
    ? "You have left the game"
    : "You have been removed from the waitlist";
};

export const kickPlayer = async (gameId: string, creatorId: string, participantUserId: string) => {
  if (creatorId === participantUserId) {
    throw badRequest("Organisers cannot remove themselves");
  }

  const { promoted, game } = await releaseSpot(gameId, participantUserId, {
    requireCreator: creatorId
  });

  await notifyQuietly({
    recipientUserId: participantUserId,
    type: "waitlist_update",
    title: "Removed from a game",
    body: `The organiser removed you from ${game.title}.`,
    gameId
  });

  if (promoted) {
    await notifyQuietly({
      recipientUserId: promoted.userId,
      type: "waitlist_update",
      title: "You are on the roster",
      body: `A spot opened up in ${game.title} and you were moved off the waitlist.`,
      gameId
    });
  }

  return "Player removed from the game";
};

export const castVote = async (gameId: string, uid: string) => {
  const gameRef = collections.games.doc(gameId);
  const voteRef = votesOf(gameId).doc(uid);

  const outcome = await db.runTransaction(async (transaction) => {
    const [gameSnapshot, voteSnapshot] = await transaction.getAll(gameRef, voteRef);

    if (!gameSnapshot.exists) throw notFound("Game not found");
    if (voteSnapshot.exists) throw conflict("You have already voted for this game");

    const game = gameSnapshot.data() as GameDocument;

    if (game.status !== "proposed") throw badRequest("Voting is only open on proposed games");
    if (game.votingEndsAt.toDate().getTime() < Date.now()) {
      throw badRequest("Voting for this game has closed");
    }

    const now = Timestamp.now();
    const voteCount = game.voteCount + 1;
    const threshold = voteThresholdFor(game);
    const confirmed = voteCount >= threshold;

    transaction.set(voteRef, {
      gameId,
      userId: uid,
      vote: "upvote",
      createdAt: now
    } satisfies VoteDocument);

    transaction.update(gameRef, {
      voteCount: FieldValue.increment(1),
      updatedAt: now,
      ...(confirmed ? { status: "confirmed", confirmedAt: now } : {})
    });

    return { game, voteCount, threshold, confirmed };
  });

  if (outcome.confirmed) {
    // Everyone on the roster should hear that it is really happening.
    const participants = await participantsOf(gameId).get();
    const recipients = new Set<string>([outcome.game.createdBy]);

    for (const document of participants.docs) {
      recipients.add((document.data() as ParticipantDocument).userId ?? document.id);
    }

    await Promise.all(
      [...recipients].map((recipientUserId) =>
        notifyQuietly({
          recipientUserId,
          type: "game_confirmed",
          title: "Game confirmed",
          body: `${outcome.game.title} reached ${outcome.threshold} votes and is locked in.`,
          gameId
        })
      )
    );
  } else if (outcome.game.createdBy !== uid) {
    await notifyQuietly({
      recipientUserId: outcome.game.createdBy,
      type: "vote_update",
      title: "New vote",
      body: `${outcome.game.title} now has ${outcome.voteCount} of ${outcome.threshold} votes.`,
      gameId
    });
  }

  return {
    confirmed: outcome.confirmed,
    voteCount: outcome.voteCount,
    threshold: outcome.threshold,
    message: outcome.confirmed
      ? "Vote recorded — this game is now confirmed"
      : `Vote recorded (${outcome.voteCount}/${outcome.threshold})`
  };
};

export const removeVote = async (gameId: string, uid: string) => {
  const gameRef = collections.games.doc(gameId);
  const voteRef = votesOf(gameId).doc(uid);

  return db.runTransaction(async (transaction) => {
    const [gameSnapshot, voteSnapshot] = await transaction.getAll(gameRef, voteRef);

    if (!gameSnapshot.exists) throw notFound("Game not found");
    if (!voteSnapshot.exists) throw notFound("You have not voted for this game");

    const game = gameSnapshot.data() as GameDocument;

    if (game.status !== "proposed") {
      throw badRequest("Votes are locked once a game leaves the proposal stage");
    }

    transaction.delete(voteRef);
    transaction.update(gameRef, {
      voteCount: FieldValue.increment(-1),
      updatedAt: Timestamp.now()
    });

    return "Your vote has been removed";
  });
};

export const invitePlayer = async (gameId: string, email: string, creatorId: string) => {
  const gameRef = collections.games.doc(gameId);
  const gameSnapshot = await gameRef.get();

  if (!gameSnapshot.exists) throw notFound("Game not found");

  const game = gameSnapshot.data() as GameDocument;

  if (game.createdBy !== creatorId) throw forbidden("Only the organiser can invite players");
  if (game.status === "cancelled" || game.status === "completed") {
    throw badRequest("This game is no longer accepting players");
  }

  // Emails are stored lower-cased, but older records may not be.
  const lowered = await collections.users.where("email", "==", email).limit(1).get();
  const found = lowered.empty
    ? await collections.users.where("email", "==", email.toLowerCase()).limit(1).get()
    : lowered;

  if (found.empty) throw notFound("Nobody with that email has a BASE-0 account yet");

  const invitedUserId = found.docs[0].id;
  const invitedUser = found.docs[0].data() as UserDocument;

  // Participants are keyed by uid, so this both looks up and prevents duplicates.
  const participantRef = participantsOf(gameId).doc(invitedUserId);

  if ((await participantRef.get()).exists) {
    throw conflict(`${invitedUser.displayName} is already on this game`);
  }

  const status = game.participantCount >= game.maxPlayers ? "waitlisted" : "joined";
  const now = Timestamp.now();

  const batch = db.batch();
  batch.set(participantRef, {
    gameId,
    userId: invitedUserId,
    displayName: invitedUser.displayName,
    status,
    joinedAt: now
  } satisfies ParticipantDocument);
  batch.update(gameRef, {
    participantCount: FieldValue.increment(status === "joined" ? 1 : 0),
    waitlistCount: FieldValue.increment(status === "waitlisted" ? 1 : 0),
    updatedAt: now
  });
  await batch.commit();

  await notifyQuietly({
    recipientUserId: invitedUserId,
    type: "invite",
    title: "You have been added to a game",
    body: `${game.title} · ${game.sport} — ${
      status === "joined" ? "you are on the roster" : "you are on the waitlist"
    }.`,
    gameId
  });

  return status === "joined"
    ? `${invitedUser.displayName} was added to the roster`
    : `${invitedUser.displayName} was added to the waitlist`;
};

export const cancelGame = async (gameId: string, creatorId: string) => {
  const gameRef = collections.games.doc(gameId);

  const game = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(gameRef);

    if (!snapshot.exists) throw notFound("Game not found");

    const current = snapshot.data() as GameDocument;

    if (current.createdBy !== creatorId) throw forbidden("Only the organiser can cancel this game");
    if (current.status === "cancelled") throw conflict("This game is already cancelled");

    const now = Timestamp.now();
    transaction.update(gameRef, { status: "cancelled", cancelledAt: now, updatedAt: now });

    return current;
  });

  const participants = await participantsOf(gameId).get();

  await Promise.all(
    participants.docs
      .map((document) => (document.data() as ParticipantDocument).userId ?? document.id)
      .filter((userId) => userId !== creatorId)
      .map((recipientUserId) =>
        notifyQuietly({
          recipientUserId,
          type: "waitlist_update",
          title: "Game cancelled",
          body: `${game.title} was called off by the organiser.`,
          gameId
        })
      )
  );

  return "Game cancelled and everyone was notified";
};
