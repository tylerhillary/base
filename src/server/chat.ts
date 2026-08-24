import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import type { ChatMessage } from "@/types/domain";
import { chatOf, collections } from "./firebase";
import { badRequest, forbidden, notFound } from "./errors";
import type { ChatMessageDocument, GameDocument, ParticipantDocument } from "./types";

/**
 * Epoch milliseconds rather than an ISO string: the realtime `onSnapshot` path
 * yields a Firestore `Timestamp`, and millis is the one representation both
 * transports can agree on without the UI having to care which one it got.
 */
const serialize = (id: string, message: ChatMessageDocument): ChatMessage => ({
  id,
  gameId: message.gameId,
  senderUserId: message.senderUserId,
  senderDisplayName: message.senderDisplayName ?? "Player",
  message: message.message,
  createdAt: message.createdAt.toMillis()
});

/**
 * Chat is private to the roster. Returns the game so callers can reuse it
 * instead of reading the document twice.
 */
const requireMembership = async (gameId: string, userId: string) => {
  const gameRef = collections.games.doc(gameId);
  const [gameSnapshot, participantSnapshot] = await Promise.all([
    gameRef.get(),
    gameRef.collection("participants").doc(userId).get()
  ]);

  if (!gameSnapshot.exists) throw notFound("Game not found");

  const game = gameSnapshot.data() as GameDocument;

  if (!participantSnapshot.exists && game.createdBy !== userId) {
    throw forbidden("Join the game to see its chat");
  }

  return {
    game,
    participant: participantSnapshot.exists
      ? (participantSnapshot.data() as ParticipantDocument)
      : undefined
  };
};

export const getChatMessages = async (gameId: string, userId: string): Promise<ChatMessage[]> => {
  await requireMembership(gameId, userId);

  const snapshot = await chatOf(gameId).orderBy("createdAt", "asc").limit(200).get();

  return snapshot.docs.map((document) =>
    serialize(document.id, document.data() as ChatMessageDocument)
  );
};

export const sendChatMessage = async (
  gameId: string,
  actor: { uid: string; displayName: string },
  message: string
): Promise<ChatMessage> => {
  const trimmed = message.trim();

  if (!trimmed) throw badRequest("Message cannot be empty");

  const { game, participant } = await requireMembership(gameId, actor.uid);

  if (game.status === "cancelled") {
    throw badRequest("This game was cancelled, so its chat is closed");
  }

  const now = Timestamp.now();
  const document: ChatMessageDocument = {
    gameId,
    senderUserId: actor.uid,
    // Names are denormalised onto the message so reading a thread is one query.
    senderDisplayName: participant?.displayName ?? actor.displayName,
    message: trimmed,
    createdAt: now
  };

  const messageRef = chatOf(gameId).doc();
  await messageRef.set(document);

  return serialize(messageRef.id, document);
};
