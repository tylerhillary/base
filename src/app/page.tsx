import type { CSSProperties } from "react";
import Link from "next/link";

import { GamesBrowser } from "@/components/games/games-browser";
import { ButtonLink } from "@/components/ui/button";
import { Countdown } from "@/components/ui/countdown";
import { Icon } from "@/components/ui/icon";
import { Badge, Callout, Meter, StatTile } from "@/components/ui/primitives";
import { SportMark } from "@/components/ui/sport-mark";
import { listGames } from "@/server/games";
import { formatDateTime, friendlyDay } from "@/lib/format";
import { SPORTS, getSport } from "@/lib/sports";
import type { GameSummary } from "@/types/domain";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";

const HOW_IT_WORKS = [
  {
    icon: "plus" as const,
    title: "Propose the match",
    text: "Pick a sport, a venue and a time. Set the roster size and how long voting stays open."
  },
  {
    icon: "vote" as const,
    title: "The crowd decides",
    text: "One player, one vote. Once the proposal hits its threshold the game locks in automatically."
  },
  {
    icon: "trophy" as const,
    title: "Show up and play",
    text: "Roster fills first-come, overflow moves to the waitlist, and everyone talks in the game chat."
  }
];

export default async function HomePage() {
  let games: GameSummary[] = [];
  let loadError = "";

  try {
    games = await listGames({ limit: 120 });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load games";
  }

  const now = Date.now();
  const upcoming = games.filter((game) => new Date(game.scheduledFor).getTime() >= now);
  const openVotes = games.filter(
    (game) => game.status === "proposed" && new Date(game.votingEndsAt).getTime() > now
  );
  const confirmed = upcoming.filter((game) => game.status === "confirmed");
  const playersIn = games.reduce((total, game) => total + game.participantCount, 0);
  const spotsLeft = upcoming.reduce(
    (total, game) => total + Math.max(0, game.maxPlayers - game.participantCount),
    0
  );

  // Spotlight the next confirmed game, or failing that the next game of any kind.
  const spotlight =
    [...confirmed].sort(
      (left, right) =>
        new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime()
    )[0] ??
    [...upcoming].sort(
      (left, right) =>
        new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime()
    )[0];

  const spotlightSport = spotlight ? getSport(spotlight.sport) : null;

  return (
    <div>
      {/* ---------------------------------------------------------- Hero */}
      <section className={styles.hero}>
        <div className={`u-shell ${styles.heroInner}`}>
          <div className={styles.heroCopy}>
            <span className={styles.heroBadge}>
              <span className={styles.heroBadgeDot}>
                <Icon name="zap" size={12} strokeWidth={2.4} />
              </span>
              {openVotes.length > 0
                ? `${openVotes.length} ${openVotes.length === 1 ? "proposal" : "proposals"} open for voting`
                : "Community-run pickup sports"}
            </span>

            <h1 className={styles.heroTitle}>
              <span>Find players.</span>
              <span className={styles.heroAccent}>Vote. Play.</span>
            </h1>

            <p className={styles.heroLede}>
              BASE-0 turns a group chat full of “who&apos;s in?” into a real schedule. Propose a
              match, let the community vote it in, and arrive to a roster that is already full.
            </p>

            <div className={styles.heroActions}>
              <ButtonLink href="/create-game" variant="primary" size="lg">
                <Icon name="plus" size={18} strokeWidth={2.2} />
                Create a game
              </ButtonLink>
              <ButtonLink href="/votes" variant="secondary" size="lg">
                <Icon name="vote" size={18} />
                Open the vote queue
              </ButtonLink>
            </div>

            <div className={styles.heroProof}>
              <div className={styles.proofItem}>
                <span className={styles.proofValue}>{upcoming.length}</span>
                <span className={styles.proofLabel}>Upcoming</span>
              </div>
              <div className={styles.proofItem}>
                <span className={styles.proofValue}>{playersIn}</span>
                <span className={styles.proofLabel}>Players in</span>
              </div>
              <div className={styles.proofItem}>
                <span className={styles.proofValue}>{SPORTS.length}</span>
                <span className={styles.proofLabel}>Sports</span>
              </div>
              <div className={styles.proofItem}>
                <span className={styles.proofValue}>{spotsLeft}</span>
                <span className={styles.proofLabel}>Spots open</span>
              </div>
            </div>
          </div>

          <div className={styles.heroVisual} aria-hidden="true">
            <span className={styles.orbit} />
            <span className={`${styles.orbit} ${styles.orbit2}`} />
            <span className={`${styles.orbit} ${styles.orbit3}`} />

            {SPORTS.slice(0, 5).map((sport, index) => (
              <span key={sport.value} className={`${styles.orbitBall} ${styles[`ball${index + 1}`]}`}>
                <SportMark sport={sport.value} size={24} />
              </span>
            ))}

            <span className={styles.heroCore}>
              <span className={styles.heroCoreValue}>{games.length}</span>
              <span className={styles.heroCoreLabel}>
                games
                <br />
                on the board
              </span>
            </span>
          </div>
        </div>
      </section>

      <div className="u-shell u-stack" style={{ paddingTop: 0 }}>
        {loadError ? (
          <Callout tone="danger">
            {loadError}. Check that the API is running on{" "}
            <code>{process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api"}</code>, then
            reload — the board fills in as soon as it responds.
          </Callout>
        ) : null}

        {/* ------------------------------------------------------ Pulse */}
        <section className={styles.pulse} aria-label="Community pulse">
          <StatTile
            icon="zap"
            value={upcoming.length}
            label="Live games"
            hint="Scheduled and still ahead"
            tint="var(--signal-live)"
            pulse={upcoming.length > 0}
          />
          <StatTile
            icon="vote"
            value={openVotes.length}
            label="Open votes"
            hint="Waiting on the community"
            tint="var(--accent)"
          />
          <StatTile
            icon="checkCircle"
            value={confirmed.length}
            label="Confirmed"
            hint="Locked in and ready"
            tint="var(--signal-info)"
          />
          <StatTile
            icon="users"
            value={spotsLeft}
            label="Spots open"
            hint="Across every roster"
            tint="var(--sport-running)"
          />
        </section>

        {/* -------------------------------------------------- Spotlight */}
        {spotlight && spotlightSport ? (
          <section
            className={styles.spotlight}
            style={{ "--tint": spotlightSport.color } as CSSProperties}
            aria-label="Next up"
          >
            <Link href={`/games/${spotlight.id}`} className={styles.spotlightLink}>
              <span className="u-visually-hidden">Open {spotlight.title}</span>
            </Link>

            <div className={styles.spotlightBody}>
              <p className={styles.spotlightEyebrow}>
                <Icon name="flame" size={14} strokeWidth={2.2} />
                {spotlight.status === "confirmed" ? "Next confirmed match" : "Next up"}
              </p>

              <h2 className={styles.spotlightTitle}>{spotlight.title}</h2>

              <div className={styles.spotlightMeta}>
                <span className={styles.spotlightMetaItem}>
                  <SportMark sport={spotlight.sport} size={16} />
                  {spotlightSport.label}
                </span>
                <span className={styles.spotlightMetaItem}>
                  <Icon name="calendar" size={15} />
                  {friendlyDay(spotlight.scheduledFor)} · {formatDateTime(spotlight.scheduledFor)}
                </span>
                <span className={styles.spotlightMetaItem}>
                  <Icon name="mapPin" size={15} />
                  {spotlight.location.label}
                </span>
                {spotlight.status === "proposed" ? (
                  <span className={styles.spotlightMetaItem}>
                    <Icon name="clock" size={15} />
                    Voting closes in <Countdown deadline={spotlight.votingEndsAt} />
                  </span>
                ) : null}
              </div>
            </div>

            <div className={styles.spotlightAside}>
              <div className={styles.spotlightRoster}>
                <span className={styles.spotlightRosterTop}>
                  <b>{spotlight.participantCount}</b>
                  <span>/ {spotlight.maxPlayers} players</span>
                </span>
                <Meter
                  value={spotlight.participantCount}
                  max={spotlight.maxPlayers}
                  tint={spotlightSport.color}
                  label="Roster fill"
                />
                <Badge tone="gold" icon="vote">
                  {spotlight.voteCount} {spotlight.voteCount === 1 ? "vote" : "votes"}
                </Badge>
              </div>

              <ButtonLink href={`/games/${spotlight.id}`} variant="primary">
                View game
                <Icon name="arrowRight" size={16} strokeWidth={2.2} />
              </ButtonLink>
            </div>
          </section>
        ) : null}

        {/* ---------------------------------------------------- Browser */}
        <section aria-label="All games">
          <header className="u-section-head">
            <div>
              <p className="u-eyebrow">The board</p>
              <h2 className="u-section-title">Every game in your community</h2>
              <p className="u-section-sub">
                Filter by sport, sort by what matters, and jump straight into a roster.
              </p>
            </div>
            <ButtonLink href="/create-game" variant="outline">
              <Icon name="plus" size={16} />
              Propose a match
            </ButtonLink>
          </header>

          <GamesBrowser
            games={games}
            emptyTitle={
              loadError
                ? "The board could not be loaded"
                : games.length === 0
                  ? "The board is empty"
                  : "No games match that"
            }
            emptyDescription={
              loadError
                ? "This is a connection problem, not an empty community. Reload once the API is back up."
                : games.length === 0
                  ? "Be the first to put a match on the board and invite your community to vote."
                  : "Try a different sport, clear the search, or widen the status filter."
            }
          />
        </section>

        {/* ------------------------------------------------ How it works */}
        <section aria-label="How BASE-0 works">
          <header className="u-section-head">
            <div>
              <p className="u-eyebrow">How it works</p>
              <h2 className="u-section-title">Three steps from idea to kickoff</h2>
            </div>
          </header>

          <div className={styles.steps}>
            {HOW_IT_WORKS.map((step) => (
              <article key={step.title} className={styles.step}>
                <span className={styles.stepIcon}>
                  <Icon name={step.icon} size={20} />
                </span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepText}>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------- Closing */}
        <section className={styles.cta}>
          <div>
            <h2 className={styles.ctaTitle}>Got a pitch booked and nobody to fill it?</h2>
            <p className={styles.ctaText}>
              Put it on the board. Voting settles the schedule, the waitlist handles the overflow,
              and reliability scores keep the regulars honest.
            </p>
          </div>
          <ButtonLink href="/create-game" variant="primary" size="lg">
            <Icon name="plus" size={18} strokeWidth={2.2} />
            Create a game
          </ButtonLink>
        </section>
      </div>
    </div>
  );
}
