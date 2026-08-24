"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Callout, EmptyState, Skeleton, StatTile } from "@/components/ui/primitives";
import { useNotifications } from "@/providers/notifications-provider";
import { relativeTime } from "@/lib/format";
import type { NotificationItem, NotificationType } from "@/types/domain";
import styles from "./notifications.module.css";

const TYPE_STYLE: Record<NotificationType, { icon: IconName; tint: string; label: string }> = {
  invite: { icon: "userPlus", tint: "var(--sport-other)", label: "Invite" },
  vote_update: { icon: "vote", tint: "var(--accent)", label: "Votes" },
  waitlist_update: { icon: "users", tint: "var(--signal-info)", label: "Roster" },
  game_confirmed: { icon: "checkCircle", tint: "var(--signal-live)", label: "Confirmed" },
  chat_message: { icon: "message", tint: "var(--sport-running)", label: "Chat" }
};

type Filter = "all" | "unread" | NotificationType;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Everything" },
  { value: "unread", label: "Unread" },
  { value: "game_confirmed", label: "Confirmed" },
  { value: "vote_update", label: "Votes" },
  { value: "waitlist_update", label: "Roster" },
  { value: "invite", label: "Invites" }
];

const matches = (item: NotificationItem, filter: Filter) => {
  if (filter === "all") return true;
  if (filter === "unread") return !item.read;
  return item.type === filter;
};

export default function NotificationsPage() {
  const { items, unreadCount, loading, error, refresh, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const map = new Map<Filter, number>([
      ["all", items.length],
      ["unread", unreadCount]
    ]);

    for (const item of items) {
      map.set(item.type, (map.get(item.type) ?? 0) + 1);
    }

    return map;
  }, [items, unreadCount]);

  const visible = useMemo(() => items.filter((item) => matches(item, filter)), [items, filter]);

  const confirmedCount = counts.get("game_confirmed") ?? 0;

  return (
    <div className="u-shell u-stack">
      <PageHeader
        eyebrow="Your inbox"
        eyebrowIcon="bell"
        title="Updates"
        count={unreadCount}
        lede="Votes on your proposals, roster changes, waitlist promotions and confirmations — everything the community did that involves you."
        backHref="/"
        actions={
          <>
            <Button variant="ghost" onClick={() => void refresh()} busy={loading} busyLabel="Refreshing…">
              <Icon name="refresh" size={16} />
              Refresh
            </Button>
            {unreadCount > 0 ? (
              <Button variant="secondary" onClick={() => void markAllRead()}>
                <Icon name="check" size={16} strokeWidth={2.4} />
                Mark all read
              </Button>
            ) : null}
          </>
        }
      />

      {error ? <Callout tone="danger">{error}</Callout> : null}

      <section className={styles.stats} aria-label="Notification summary">
        <StatTile
          icon="bell"
          value={unreadCount}
          label="Unread"
          hint={unreadCount === 0 ? "All caught up" : "Waiting on you"}
          tint="var(--accent)"
          pulse={unreadCount > 0}
        />
        <StatTile
          icon="mail"
          value={items.length}
          label="Total updates"
          hint="Last 100 kept"
          tint="var(--signal-info)"
        />
        <StatTile
          icon="checkCircle"
          value={confirmedCount}
          label="Confirmations"
          hint="Games that locked in"
          tint="var(--signal-live)"
        />
      </section>

      <section aria-label="All updates">
        <header className="u-section-head">
          <div>
            <p className="u-eyebrow">Activity</p>
            <h2 className="u-section-title">Everything that happened</h2>
          </div>

          <div className={styles.filters}>
            {FILTERS.map((option) => {
              const count = counts.get(option.value) ?? 0;
              if (option.value !== "all" && option.value !== "unread" && count === 0) return null;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.filter} ${filter === option.value ? styles.filterActive : ""}`}
                  onClick={() => setFilter(option.value)}
                  aria-pressed={filter === option.value}
                >
                  {option.label}
                  <span className={styles.filterCount}>{count}</span>
                </button>
              );
            })}
          </div>
        </header>

        {loading && items.length === 0 ? (
          <div className={styles.list}>
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className={styles.item}>
                <Skeleton width="2.5rem" height="2.5rem" radius="var(--r-md)" />
                <div className={styles.body}>
                  <Skeleton width="40%" height="0.9rem" />
                  <div style={{ height: "0.5rem" }} />
                  <Skeleton width="80%" height="0.8rem" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon="bell"
            title={filter === "all" ? "Nothing here yet" : "Nothing matches that filter"}
            description={
              filter === "all"
                ? "Once you propose, vote on or join a game, updates about it land here."
                : "Try a different filter to see the rest of your activity."
            }
            actions={
              filter === "all" ? (
                <ButtonLink href="/" variant="primary">
                  <Icon name="compass" size={16} />
                  Find a game
                </ButtonLink>
              ) : (
                <Button variant="secondary" onClick={() => setFilter("all")}>
                  Show everything
                </Button>
              )
            }
          />
        ) : (
          <div className={styles.list}>
            {visible.map((item, index) => {
              const meta = TYPE_STYLE[item.type] ?? TYPE_STYLE.vote_update;

              return (
                <article
                  key={item.id}
                  className={`${styles.item} ${item.read ? "" : styles.unread}`}
                  style={
                    {
                      "--tint": meta.tint,
                      animationDelay: `${Math.min(index, 10) * 30}ms`
                    } as CSSProperties
                  }
                >
                  <span className={styles.icon}>
                    <Icon name={meta.icon} size={18} />
                  </span>

                  <div className={styles.body}>
                    <div className={styles.head}>
                      <h3 className={styles.title}>{item.title}</h3>
                      <span className={styles.time}>{relativeTime(item.createdAt)}</span>
                    </div>

                    <p className={styles.text}>{item.body}</p>

                    <div className={styles.itemActions}>
                      {item.gameId ? (
                        <Link href={`/games/${item.gameId}`} className={styles.link}>
                          Open game
                          <Icon name="arrowRight" size={13} strokeWidth={2.4} />
                        </Link>
                      ) : null}

                      {!item.read ? (
                        <button
                          type="button"
                          className={styles.markRead}
                          onClick={() => void markRead(item.id)}
                        >
                          Mark as read
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {!item.read ? <span className={styles.dot} aria-label="Unread" /> : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
