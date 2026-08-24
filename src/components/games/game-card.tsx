import type { CSSProperties } from "react";
import Link from "next/link";

import { Badge, Meter } from "@/components/ui/primitives";
import { Countdown } from "@/components/ui/countdown";
import { Icon } from "@/components/ui/icon";
import { SportMark } from "@/components/ui/sport-mark";
import { formatDate, formatTime } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import { getSport, getStatus } from "@/lib/sports";
import type { GameSummary } from "@/types/domain";
import styles from "./game-card.module.css";

const statusTone = {
  live: "live",
  gold: "gold",
  muted: "muted",
  danger: "danger"
} as const;

interface GameCardProps {
  game: GameSummary;
  variant?: "grid" | "row";
  /** Kilometres from the viewer, when they have shared their location. */
  distanceKm?: number;
  /** Renders the card as a static sample — used by the create-game preview. */
  preview?: boolean;
}

export const GameCard = ({ game, variant = "grid", distanceKm, preview }: GameCardProps) => {
  const sport = getSport(game.sport);
  const status = getStatus(game.status);
  const scheduled = new Date(game.scheduledFor);
  const spotsLeft = Math.max(0, game.maxPlayers - game.participantCount);
  const isFull = spotsLeft === 0;
  const votingOpen = game.status === "proposed" && new Date(game.votingEndsAt).getTime() > Date.now();

  return (
    <article
      className={`${styles.card} ${variant === "row" ? styles.row : ""}`}
      style={{ "--tint": sport.color } as CSSProperties}
    >
      {preview ? null : (
        <Link href={`/games/${game.id}`} className={styles.overlayLink} aria-label={`Open ${game.title}`}>
          <span className="u-visually-hidden">Open {game.title}</span>
        </Link>
      )}

      <div className={styles.head}>
        <div className={styles.date}>
          <span className={styles.dateMonth}>
            {scheduled.toLocaleDateString(undefined, { month: "short" })}
          </span>
          <span className={styles.dateDay}>{scheduled.getDate()}</span>
          <span className={styles.dateWeekday}>
            {scheduled.toLocaleDateString(undefined, { weekday: "short" })}
          </span>
        </div>

        <div className={styles.headBody}>
          <div className={styles.badges}>
            <Badge tint={sport.color}>{sport.label}</Badge>
            <Badge tone={statusTone[status.tone]} dot pulse={status.value === "confirmed"}>
              {status.label}
            </Badge>
            {votingOpen ? (
              <Badge tone="muted" icon="clock">
                <Countdown deadline={game.votingEndsAt} />
              </Badge>
            ) : null}
          </div>

          <h3 className={styles.title}>{game.title}</h3>

          <p className={styles.venue}>
            <Icon name="mapPin" size={14} />
            <span className="u-truncate">{game.location.label}</span>
            <span aria-hidden="true">·</span>
            <span>{formatTime(scheduled)}</span>
            {typeof distanceKm === "number" ? (
              <>
                <span aria-hidden="true">·</span>
                <span className={styles.distance}>
                  <Icon name="compass" size={13} />
                  {formatDistance(distanceKm)}
                </span>
              </>
            ) : null}
          </p>
        </div>

        <SportMark sport={game.sport} size={28} className={styles.sportMark} />
      </div>

      <div className={styles.roster}>
        <div className={styles.rosterTop}>
          <span className={styles.rosterCount}>
            {game.participantCount}
            <span>/{game.maxPlayers}</span>
          </span>
          <span className={styles.rosterSpots}>
            {isFull ? (
              <span className={styles.rosterFull}>
                Full{game.waitlistCount > 0 ? ` · ${game.waitlistCount} waiting` : ""}
              </span>
            ) : (
              `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left`
            )}
          </span>
        </div>
        <Meter
          value={game.participantCount}
          max={game.maxPlayers}
          tint={sport.color}
          label={`${game.participantCount} of ${game.maxPlayers} players confirmed`}
        />
      </div>

      <div className={styles.foot}>
        <span className={styles.metric}>
          <Icon name="vote" size={14} />
          <span className={styles.metricStrong}>{game.voteCount}</span>
          {game.voteCount === 1 ? "vote" : "votes"}
        </span>
        <span className={styles.metric}>
          <Icon name="calendar" size={14} />
          {formatDate(scheduled)}
        </span>
        <span className={styles.cta}>
          View
          <Icon name="arrowRight" size={13} strokeWidth={2.4} />
        </span>
      </div>
    </article>
  );
};
