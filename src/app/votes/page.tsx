import type { Metadata } from "next";

import { GamesBrowser } from "@/components/games/games-browser";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Callout, StatTile } from "@/components/ui/primitives";
import { listGames } from "@/server/games";
import type { GameSummary } from "@/types/domain";
import styles from "./votes.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vote queue",
  description: "Cast your vote on proposed games. One player, one vote."
};

export default async function VotesPage() {
  let proposals: GameSummary[] = [];
  let loadError = "";

  try {
    proposals = await listGames({ status: "proposed", limit: 120 });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load proposals";
  }

  const now = Date.now();
  const open = proposals.filter((game) => new Date(game.votingEndsAt).getTime() > now);
  const closingSoon = open.filter(
    (game) => new Date(game.votingEndsAt).getTime() - now < 24 * 3600_000
  );
  const totalVotes = proposals.reduce((total, game) => total + game.voteCount, 0);

  return (
    <div className="u-shell u-stack">
      <PageHeader
        eyebrow="Community decision"
        eyebrowIcon="vote"
        title="Vote queue"
        count={open.length}
        lede="One player, one vote. A proposal confirms itself the moment it reaches half its roster in votes — no organiser has to chase anyone."
        backHref="/"
        actions={
          <ButtonLink href="/create-game" variant="primary">
            <Icon name="plus" size={16} />
            Propose a game
          </ButtonLink>
        }
      />

      {loadError ? <Callout tone="danger">{loadError}</Callout> : null}

      {closingSoon.length > 0 ? (
        <Callout tone="warn">
          {closingSoon.length} {closingSoon.length === 1 ? "proposal closes" : "proposals close"} in
          the next 24 hours. Vote before the window shuts.
        </Callout>
      ) : null}

      <section className={styles.stats} aria-label="Voting summary">
        <StatTile
          icon="vote"
          value={open.length}
          label="Open proposals"
          hint="Still accepting votes"
          tint="var(--accent)"
          pulse={open.length > 0}
        />
        <StatTile
          icon="trendingUp"
          value={totalVotes}
          label="Votes cast"
          hint="Across every proposal"
          tint="var(--signal-live)"
        />
        <StatTile
          icon="clock"
          value={closingSoon.length}
          label="Closing soon"
          hint="Within 24 hours"
          tint="var(--signal-warn)"
        />
        <StatTile
          icon="shield"
          value="1"
          label="Vote per player"
          hint="Withdrawable while open"
          tint="var(--sport-other)"
        />
      </section>

      <section aria-label="Proposals">
        <header className="u-section-head">
          <div>
            <p className="u-eyebrow">On the ballot</p>
            <h2 className="u-section-title">Games waiting on the community</h2>
            <p className="u-section-sub">
              Sorted by kickoff. Open any proposal to vote, join, or share it around.
            </p>
          </div>
        </header>

        <GamesBrowser
          games={proposals}
          lockedStatus="proposed"
          emptyTitle={loadError ? "The ballot could not be loaded" : "Nothing on the ballot"}
          emptyDescription={
            loadError
              ? "This is a connection problem, not an empty ballot. Reload once the API is back up."
              : "Every proposal has been settled. Put a new one up and get the next match moving."
          }
        />
      </section>
    </div>
  );
}
