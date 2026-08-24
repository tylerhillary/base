import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import type { GameSummary, UserProfile } from "@/types/domain";
import { collections, db } from "./firebase";
import type { GameDocument, UserDocument } from "./types";
import type { UpdateProfileInput } from "./validators";

/** How many games a fallback scan looks at before giving up on completeness. */
const SCAN_LIMIT = 150;

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

const blankUser = (email = "", displayName = "Player"): UserDocument => {
  const timestamp = Timestamp.now();

  return {
    displayName,
    email,
    sportsInterests: ["football"],
    homeLocation: { label: "", lat: 0, lng: 0 },
    bio: "",
    ratings: { reliabilityScore: 5, sportsmanshipScore: 5, gamesJoined: 0, noShows: 0 },
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

const buildProfile = (
  userId: string,
  user: UserDocument,
  lists: {
    recentGames?: GameSummary[];
    gamesCreated?: GameSummary[];
    gamesVoted?: GameSummary[];
    gamesPlayed?: GameSummary[];
  } = {}
): UserProfile => ({
  id: userId,
  displayName: user.displayName,
  email: user.email,
  bio: user.bio ?? "",
  sportsInterests: user.sportsInterests ?? [],
  reliabilityScore: user.ratings?.reliabilityScore ?? 5,
  sportsmanshipScore: user.ratings?.sportsmanshipScore ?? 5,
  gamesJoined: user.ratings?.gamesJoined ?? 0,
  noShows: user.ratings?.noShows ?? 0,
  homeLocation: user.homeLocation?.label ?? "",
  recentGames: lists.recentGames ?? [],
  gamesCreated: lists.gamesCreated ?? [],
  gamesVoted: lists.gamesVoted ?? [],
  gamesPlayed: lists.gamesPlayed ?? []
});

const byDateDescending = (left: GameSummary, right: GameSummary) =>
  new Date(right.scheduledFor).getTime() - new Date(left.scheduledFor).getTime();

/**
 * Collects the game ids a user appears in for a given subcollection.
 *
 * The collection-group query is a single read for the whole database, but needs
 * a collection-group index on `userId`. When that index is missing we fall back
 * to checking a bounded set of games in parallel — still one round trip of
 * latency, just wider.
 */
const gameIdsFromSubcollection = async (
  subcollection: "participants" | "votes",
  userId: string,
  candidateGameIds: string[]
): Promise<Set<string>> => {
  try {
    const snapshot = await db
      .collectionGroup(subcollection)
      .where("userId", "==", userId)
      .limit(300)
      .get();

    return new Set(
      snapshot.docs
        .map((document) => document.ref.parent.parent?.id)
        .filter((id): id is string => Boolean(id))
    );
  } catch {
    const checks = await Promise.all(
      candidateGameIds.map(async (gameId) => {
        const document = await collections.games
          .doc(gameId)
          .collection(subcollection)
          .doc(userId)
          .get();

        return document.exists ? gameId : null;
      })
    );

    return new Set(checks.filter((id): id is string => Boolean(id)));
  }
};

export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  const userRef = collections.users.doc(userId);
  const [userSnapshot, createdSnapshot, recentSnapshot] = await Promise.all([
    userRef.get(),
    collections.games.where("createdBy", "==", userId).limit(SCAN_LIMIT).get(),
    collections.games.orderBy("scheduledFor", "desc").limit(SCAN_LIMIT).get()
  ]);

  const user = userSnapshot.exists ? (userSnapshot.data() as UserDocument) : blankUser();

  const gamesById = new Map<string, GameSummary>();
  for (const document of [...recentSnapshot.docs, ...createdSnapshot.docs]) {
    gamesById.set(document.id, serializeGame(document.id, document.data() as GameDocument));
  }

  const candidateGameIds = [...gamesById.keys()];
  const [playedIds, votedIds] = await Promise.all([
    gameIdsFromSubcollection("participants", userId, candidateGameIds),
    gameIdsFromSubcollection("votes", userId, candidateGameIds)
  ]);

  // A collection-group hit can reference a game outside the recent window.
  const missingIds = [...playedIds, ...votedIds].filter((id) => !gamesById.has(id));

  if (missingIds.length > 0) {
    const extras = await db.getAll(
      ...missingIds.slice(0, 60).map((id) => collections.games.doc(id))
    );

    for (const document of extras) {
      if (document.exists) {
        gamesById.set(document.id, serializeGame(document.id, document.data() as GameDocument));
      }
    }
  }

  const pick = (ids: Iterable<string>) =>
    [...ids]
      .map((id) => gamesById.get(id))
      .filter((game): game is GameSummary => Boolean(game))
      .sort(byDateDescending);

  const gamesCreated = createdSnapshot.docs
    .map((document) => gamesById.get(document.id))
    .filter((game): game is GameSummary => Boolean(game))
    .sort(byDateDescending);

  const gamesPlayed = pick(playedIds);
  const gamesVoted = pick(votedIds);

  const recentGames = [
    ...new Map([...gamesCreated, ...gamesPlayed, ...gamesVoted].map((game) => [game.id, game])).values()
  ]
    .sort(byDateDescending)
    .slice(0, 3);

  return buildProfile(userId, user, { recentGames, gamesCreated, gamesVoted, gamesPlayed });
};

/**
 * Creates the Firestore profile that backs a freshly registered account, and
 * heals records written before the client knew the player's name.
 */
export const ensureUserProfile = async (
  userId: string,
  data: { displayName: string; email: string }
): Promise<UserProfile> => {
  const userRef = collections.users.doc(userId);
  const snapshot = await userRef.get();
  const email = data.email.toLowerCase();

  if (!snapshot.exists) {
    const created = blankUser(email, data.displayName || "Player");
    await userRef.set(created);
    return buildProfile(userId, created);
  }

  const existing = snapshot.data() as UserDocument;
  const patch: Partial<UserDocument> = {};

  if (!existing.email && email) patch.email = email;

  /*
   * On sign-up the auth listener can run before Firebase has stored the chosen
   * display name, so the first write lands with a placeholder derived from the
   * email. Treat those as unset so the follow-up call with the real name wins.
   */
  const emailLocalPart = (existing.email || email || "").split("@")[0];
  const isPlaceholderName =
    !existing.displayName ||
    existing.displayName === "Player" ||
    (Boolean(emailLocalPart) && existing.displayName === emailLocalPart);

  if (isPlaceholderName && data.displayName && data.displayName !== existing.displayName) {
    patch.displayName = data.displayName;
  }

  if (Object.keys(patch).length === 0) {
    return buildProfile(userId, existing);
  }

  patch.updatedAt = Timestamp.now();
  await userRef.update(patch);

  return buildProfile(userId, { ...existing, ...patch } as UserDocument);
};

export const updateUserProfile = async (
  userId: string,
  data: UpdateProfileInput
): Promise<UserProfile> => {
  const userRef = collections.users.doc(userId);
  const snapshot = await userRef.get();
  const existing = snapshot.exists ? (snapshot.data() as UserDocument) : blankUser();

  const updates: Partial<UserDocument> = { updatedAt: Timestamp.now() };

  if (data.displayName !== undefined) updates.displayName = data.displayName;
  if (data.bio !== undefined) updates.bio = data.bio;
  if (data.sportsInterests !== undefined) updates.sportsInterests = data.sportsInterests;

  if (data.homeLocation !== undefined) {
    // The profile form sends a place name; keep whatever coordinates we had.
    updates.homeLocation =
      typeof data.homeLocation === "string"
        ? { ...existing.homeLocation, label: data.homeLocation }
        : data.homeLocation;
  }

  const merged = { ...existing, ...updates } as UserDocument;

  if (snapshot.exists) {
    await userRef.update(updates);
  } else {
    await userRef.set(merged);
  }

  return buildProfile(userId, merged);
};
