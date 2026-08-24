"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Avatar, Badge, Panel, PanelBody, PanelHead, Spinner } from "@/components/ui/primitives";
import { useAuth } from "@/components/auth/auth-context";
import { useToast } from "@/providers/toast-provider";
import { subscribeToChat, sendMessage, type ChatTransport } from "@/lib/chat-service";
import { formatTime, friendlyDay } from "@/lib/format";
import type { ChatMessage, GameDetail } from "@/types/domain";
import styles from "./game-detail.module.css";

const dayKey = (value: number | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : "pending";

export const GameChat = ({ game }: { game: GameDetail }) => {
  const { user } = useAuth();
  const toast = useToast();

  const userId = user?.uid ?? "";
  const isMember =
    Boolean(userId) &&
    (game.createdBy === userId ||
      game.participants.some((participant) => participant.userId === userId));

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [transport, setTransport] = useState<ChatTransport>("live");
  const [pinnedToBottom, setPinnedToBottom] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMember || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToChat(game.id, {
      onMessages: (next) => {
        setMessages(next);
        setLoading(false);
        // Drop optimistic echoes once the server copy arrives.
        setPending((current) =>
          current.filter(
            (item) => !next.some((message) => message.message === item.message && message.senderUserId === item.senderUserId)
          )
        );
      },
      onTransport: setTransport,
      onError: (message) => {
        setLoading(false);
        toast.error("Chat problem", message);
      }
    });

    return unsubscribe;
  }, [game.id, userId, isMember, toast]);

  const visible = useMemo(() => [...messages, ...pending], [messages, pending]);

  // Only auto-scroll when the reader is already at the bottom.
  useEffect(() => {
    if (pinnedToBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [visible.length, pinnedToBottom]);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    setPinnedToBottom(distance < 80);
  }, []);

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();

    const text = draft.trim();
    if (!text || sending || !userId) return;

    const displayName = user?.displayName || user?.email?.split("@")[0] || "Player";
    const optimistic: ChatMessage = {
      id: `pending-${Date.now()}`,
      gameId: game.id,
      senderUserId: userId,
      senderDisplayName: displayName,
      message: text,
      createdAt: Date.now(),
      pending: true
    };

    setDraft("");
    setPending((current) => [...current, optimistic]);
    setPinnedToBottom(true);
    setSending(true);

    try {
      await sendMessage(game.id, text);
    } catch (error) {
      setPending((current) => current.filter((item) => item.id !== optimistic.id));
      setDraft(text);
      toast.error("Message not sent", error instanceof Error ? error.message : undefined);
    } finally {
      setSending(false);
    }
  };

  if (!isMember) {
    return (
      <Panel>
        <PanelHead title="Game chat" icon="message" />
        <PanelBody>
          <div className={styles.chatLocked}>
            <span className={styles.chatLockedIcon}>
              <Icon name="lock" size={22} />
            </span>
            <p>Chat is private to the roster.</p>
            <p className="u-section-sub">Join this game to read and post messages.</p>
          </div>
        </PanelBody>
      </Panel>
    );
  }

  let lastDay = "";
  let lastSender = "";

  return (
    <Panel>
      <PanelHead
        title="Game chat"
        icon="message"
        action={
          <span className={styles.chatTransport}>
            {transport === "live" ? (
              <Badge tone="live" dot pulse>
                Live
              </Badge>
            ) : (
              <Badge tone="muted" icon="refresh">
                Syncing
              </Badge>
            )}
          </span>
        }
      />

      <div className={styles.messages} ref={scrollRef} onScroll={handleScroll}>
        {loading && visible.length === 0 ? (
          <div className={styles.chatLocked}>
            <Spinner large />
            <p className="u-section-sub">Loading the conversation…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className={styles.chatLocked}>
            <span className={styles.chatLockedIcon}>
              <Icon name="message" size={22} />
            </span>
            <p>No messages yet.</p>
            <p className="u-section-sub">Say hello and sort out who is bringing the ball.</p>
          </div>
        ) : (
          visible.map((message) => {
            const mine = message.senderUserId === userId;
            const key = dayKey(message.createdAt);
            const showDay = key !== lastDay;
            const showName = showDay || message.senderUserId !== lastSender;

            lastDay = key;
            lastSender = message.senderUserId;

            return (
              <div key={message.id}>
                {showDay && message.createdAt ? (
                  <p className={styles.daySeparator}>{friendlyDay(message.createdAt)}</p>
                ) : null}

                <div
                  className={`${styles.message} ${mine ? styles.messageMine : ""} ${
                    message.pending ? styles.pending : ""
                  }`}
                >
                  {showName ? (
                    <Avatar
                      name={message.senderDisplayName}
                      seed={message.senderUserId}
                      size="xs"
                    />
                  ) : (
                    <span style={{ width: "1.75rem", flex: "none" }} aria-hidden="true" />
                  )}

                  <div className={styles.bubble}>
                    {showName ? (
                      <span className={styles.bubbleHead}>
                        <span className={styles.bubbleName}>
                          {mine ? "You" : message.senderDisplayName}
                        </span>
                        <span className={styles.bubbleTime}>
                          {message.createdAt ? formatTime(message.createdAt) : "sending…"}
                        </span>
                      </span>
                    ) : null}
                    <p className={styles.bubbleText}>{message.message}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {!pinnedToBottom && visible.length > 0 ? (
          <button
            type="button"
            className={styles.scrollPin}
            onClick={() => {
              setPinnedToBottom(true);
              bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Jump to latest
          </button>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <form className={styles.chatForm} onSubmit={handleSend}>
        <input
          className={styles.chatInput}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message the roster…"
          aria-label="Message"
          maxLength={1000}
          disabled={game.status === "cancelled"}
        />
        <Button
          type="submit"
          variant="primary"
          iconOnly
          busy={sending}
          disabled={!draft.trim() || game.status === "cancelled"}
          aria-label="Send message"
        >
          <Icon name="send" size={17} />
        </Button>
      </form>
    </Panel>
  );
};
