import { cache, type CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Countdown, CountdownRing } from "@/components/ui/countdown";
import { Icon } from "@/components/ui/icon";
import { Badge, Panel, PanelBody, PanelHead, StatTile } from "@/components/ui/primitives";
import { SportMark } from "@/components/ui/sport-mark";
import { AppError } from "@/server/errors";
import { getGameById } from "@/server/games";
import { formatDateTime, formatLongDate, formatTime, friendlyDay } from "@/lib/format";
import { mapsLink } from "@/lib/geo";
import { getSport, getStatus } from "@/lib/sports";
import { GameActions } from "./game-actions";
import { GameChat } from "./game-chat";
import { GameRoster } from "./game-roster";
import styles from "./game-detail.module.css";

export const dynamic = "force-dynamic";

interface GameDetailsPageProps {
  params: Promise<{ gameId: string }>;
}

/**
 * `generateMetadata` and the page body both need the game. Caching per request
 * means one Firestore read instead of two.
 */
const loadGame = cache(getGameById);

export async function generateMetadata({ params }: GameDetailsPageProps): Promise<Metadata> {
  const { gameId } = await params;

  try {
    const game = await loadGame(gameId);
    return {
      title: game.title,
      description: `${getSport(game.sport).label} at ${game.location.label} · ${formatDateTime(game.scheduledFor)}`
    };
  } catch {
    return { title: "Game" };
  }
}

const statusTone = { live: "live", gold: "gold", muted: "muted", danger: "danger" } as const;

export default async function GameDetailsPage({ params }: GameDetailsPageProps) {
  const { gameId } = await params;

  let game;

  try {
    game = await loadGame(gameId);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      notFound();
    }

    return (
      <div className="u-shell u-stack">
        <Panel padded>
          <h1 className="u-section-title">We could not load this game</h1>
          <p className="u-section-sub">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
          </p>
          <p style={{ marginTop: "1.5rem" }}>
            <Link href="/" className={styles.crumbLink}>
              <Icon name="arrowLeft" size={15} />
              Back to all games
            </Link>
          </p>
        </Panel>
      </div>
    );
  }

  const sport = getSport(game.sport);
  const status = getStatus(game.status);
  const joined = game.participants.filter((participant) => participant.status === "joined");
  const waitlisted = game.participants.filter((participant) => participant.status === "waitlisted");
  const spotsLeft = Math.max(0, game.maxPlayers - game.participantCount);
  const votingOpen =
    game.status === "proposed" && new Date(game.votingEndsAt).getTime() > Date.now();
  const votesToGo = Math.max(0, game.voteThreshold - game.voteCount);

  return (
    <div
      className={`u-shell u-stack ${styles.page}`}
      style={{ "--tint": sport.color } as CSSProperties}
    >
      <div>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link href="/" className={styles.crumbLink}>
            <Icon name="arrowLeft" size={15} />
            All games
          </Link>
          <span aria-hidden="true">/</span>
          <span className={`${styles.crumbCurrent} u-truncate`}>{game.title}</span>
        </nav>

        {/* ------------------------------------------------------- Hero */}
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <Badge tint={sport.color} icon="ticket">
              {sport.label}
            </Badge>
            <Badge tone={statusTone[status.tone]} dot pulse={game.status === "confirmed"}>
              {status.headline}
            </Badge>
            {spotsLeft > 0 ? (
              <Badge tone="muted">
                {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left
              </Badge>
            ) : (
              <Badge tone="danger">Roster full</Badge>
            )}
          </div>

          <div className={styles.heroGrid}>
            <div>
              <h1 className={styles.heroTitle}>{game.title}</h1>
              <p className={styles.heroDescription}>
                {game.description || "A community pickup session. Bring your kit and show up on time."}
              </p>

              <div className={styles.heroFacts}>
                <span className={styles.fact}>
                  <Icon name="calendar" size={17} />
                  <b>{friendlyDay(game.scheduledFor)}</b> · {formatLongDate(game.scheduledFor)}
                </span>
                <span className={styles.fact}>
                  <Icon name="clock" size={17} />
                  <b>{formatTime(game.scheduledFor)}</b>
                </span>
                <span className={styles.fact}>
                  <Icon name="mapPin" size={17} />
                  <b>{game.location.label}</b>
                </span>
                <span className={styles.fact}>
                  <Icon name="user" size={17} />
                  Organised by <b>{game.createdByName ?? "a community member"}</b>
                </span>
              </div>
            </div>

            <div className={styles.heroAside}>
              {votingOpen ? (
                <>
                  <CountdownRing
                    deadline={game.votingEndsAt}
                    openedAt={game.createdAt}
                    tint={sport.color}
                    size={82}
                  />
                  <span className={styles.heroAsideLabel}>Voting closes</span>
                  <span className={styles.heroAsideValue}>
                    <Countdown deadline={game.votingEndsAt} />
                  </span>
                </>
              ) : (
                <>
                  <SportMark sport={game.sport} size={54} />
                  <span className={styles.heroAsideLabel}>{status.label}</span>
                  <span className={styles.heroAsideValue}>{formatDateTime(game.scheduledFor)}</span>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------- Stats */}
      <section className={styles.stats} aria-label="Game at a glance">
        <StatTile
          icon="users"
          value={`${game.participantCount}/${game.maxPlayers}`}
          label="Roster"
          hint={waitlisted.length > 0 ? `${waitlisted.length} on the waitlist` : "No waitlist yet"}
          tint={sport.color}
        />
        <StatTile
          icon="vote"
          value={game.voteCount}
          label="Votes"
          hint={
            game.status === "proposed"
              ? votesToGo > 0
                ? `${votesToGo} more to confirm`
                : "Threshold reached"
              : "Voting closed"
          }
          tint="var(--accent)"
        />
        <StatTile
          icon="clock"
          value={votingOpen ? <Countdown deadline={game.votingEndsAt} /> : status.label}
          label={votingOpen ? "Voting window" : "Status"}
          hint={formatDateTime(game.votingEndsAt)}
          tint="var(--signal-info)"
          textValue={!votingOpen}
        />
        <StatTile
          icon="shield"
          value={game.voteThreshold}
          label="Vote threshold"
          hint="Auto-confirms at this count"
          tint="var(--sport-other)"
        />
      </section>

      {/* ------------------------------------------------------ Layout */}
      <div className={styles.layout}>
        <div className={styles.column}>
          <Panel>
            <PanelHead
              title="Where you are playing"
              icon="mapPin"
              action={
                <a
                  href={mapsLink(game.location, game.location.label, game.location.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.crumbLink}
                >
                  Open in maps
                  <Icon name="arrowUpRight" size={14} />
                </a>
              }
            />
            <PanelBody>
              <div className={styles.location}>
                <span className={styles.locationPin}>
                  <Icon name="mapPin" size={22} />
                </span>
                <div className={styles.locationBody}>
                  <p className={styles.locationName}>{game.location.label}</p>
                  <p className={styles.locationAddress}>{game.location.address}</p>
                  <p className={styles.locationCoords}>
                    {game.location.lat.toFixed(4)}, {game.location.lng.toFixed(4)}
                  </p>
                </div>
              </div>
            </PanelBody>
          </Panel>

          <GameRoster game={game} />

          <GameChat game={game} />
        </div>

        <div className={styles.column}>
          <div className={styles.sidebar}>
            <GameActions game={game} />
          </div>
        </div>
      </div>
    </div>
  );
}
