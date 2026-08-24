import {
  collection,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  Timestamp
} from "firebase/firestore";

import { db } from "./firebase/client";
import { fetchChatMessagesAction, sendChatMessageAction } from "@/app/actions/account";
import type { ChatMessage } from "@/types/domain";

export type { ChatMessage };

export type ChatTransport = "live" | "polling";

interface SubscribeHandlers {
  onMessages: (messages: ChatMessage[]) => void;
  onTransport?: (transport: ChatTransport) => void;
  onError?: (message: string) => void;
}

const POLL_INTERVAL_MS = 5000;
const MESSAGE_LIMIT = 200;

const toMillis = (value: unknown): number | null => {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

/**
 * Streams a game's chat.
 *
 * Firestore `onSnapshot` gives true realtime delivery, but it only works once
 * the security rules for `games/{id}/chat` are deployed. When the listener is
 * rejected we fall back to polling the backend, which reads through the Admin
 * SDK and therefore always works. Callers see the same message shape either way.
 */
export const subscribeToChat = (
  gameId: string,
  { onMessages, onTransport, onError }: SubscribeHandlers
): (() => void) => {
  let cancelled = false;
  let pollTimer: number | undefined;
  let stopSnapshot: (() => void) | undefined;

  const poll = async () => {
    const result = await fetchChatMessagesAction(gameId);
    if (cancelled) return;

    if (!result.ok) {
      onError?.(result.message);
      return;
    }

    onMessages(result.data);
  };

  const startPolling = () => {
    if (cancelled || pollTimer !== undefined) return;

    onTransport?.("polling");
    void poll();
    pollTimer = window.setInterval(poll, POLL_INTERVAL_MS);
  };

  if (!db) {
    startPolling();
  } else {
    const messagesQuery = query(
      collection(db, "games", gameId, "chat"),
      orderBy("createdAt", "asc"),
      limitToLast(MESSAGE_LIMIT)
    );

    stopSnapshot = onSnapshot(
      messagesQuery,
      (snapshot) => {
        if (cancelled) return;

        onTransport?.("live");
        onMessages(
          snapshot.docs.map((document) => {
            const data = document.data();
            return {
              id: document.id,
              gameId,
              senderUserId: String(data.senderUserId ?? ""),
              senderDisplayName: String(data.senderDisplayName ?? "Player"),
              message: String(data.message ?? ""),
              createdAt: toMillis(data.createdAt)
            };
          })
        );
      },
      () => {
        // Rules not deployed yet, or the client is offline — keep chat working.
        stopSnapshot?.();
        stopSnapshot = undefined;
        startPolling();
      }
    );
  }

  return () => {
    cancelled = true;
    stopSnapshot?.();
    if (pollTimer !== undefined) window.clearInterval(pollTimer);
  };
};

/**
 * Writes go through a server action so roster membership is enforced on the
 * server and a display name is always stored alongside the message.
 */
export const sendMessage = async (gameId: string, message: string): Promise<ChatMessage> => {
  const trimmed = message.trim();
  if (!trimmed) throw new Error("Message cannot be empty");

  const result = await sendChatMessageAction({ gameId, message: trimmed });

  if (!result.ok) throw new Error(result.message);

  return result.data;
};
