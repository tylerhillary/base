"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { Segmented } from "@/components/ui/field";
import { useToast } from "@/providers/toast-provider";
import { daysUntil } from "@/lib/format";
import { distanceKm, hasCoordinates, readBrowserPosition, type LatLng } from "@/lib/geo";
import { SPORTS, STATUSES, isSportType } from "@/lib/sports";
import type { GameStatus, GameSummary, SportType } from "@/types/domain";
import { GameCard } from "./game-card";
import styles from "./games-browser.module.css";

type SortKey = "soonest" | "popular" | "nearest" | "newest";
type ViewMode = "grid" | "list";
type SportFilter = SportType | "all";
type StatusFilter = GameStatus | "all";

const SORT_OPTIONS = [
  { value: "soonest" as const, label: "Soonest", icon: "clock" as const },
  { value: "popular" as const, label: "Most voted", icon: "trendingUp" as const },
  { value: "nearest" as const, label: "Nearest", icon: "compass" as const },
  { value: "newest" as const, label: "Newest", icon: "sparkle" as const }
];

/** Groups games into the buckets people actually plan around. */
const bucketFor = (game: GameSummary): { key: string; label: string; order: number } => {
  const offset = daysUntil(game.scheduledFor);

  if (offset < 0) return { key: "past", label: "Already played", order: 4 };
  if (offset === 0) return { key: "today", label: "Today", order: 0 };
  if (offset === 1) return { key: "tomorrow", label: "Tomorrow", order: 1 };
  if (offset <= 7) return { key: "week", label: "This week", order: 2 };
  return { key: "later", label: "Later on", order: 3 };
};

interface GamesBrowserProps {
  games: GameSummary[];
  /** Locks the status filter, e.g. the vote queue only shows proposals. */
  lockedStatus?: GameStatus;
  emptyTitle?: string;
  emptyDescription?: string;
}

export const GamesBrowser = ({
  games,
  lockedStatus,
  emptyTitle = "No games match that",
  emptyDescription = "Try widening the filters, or be the one who proposes the next match."
}: GamesBrowserProps) => {
  const searchParams = useSearchParams();
  const toast = useToast();

  const sportParam = searchParams.get("sport");
  const [sport, setSport] = useState<SportFilter>(
    sportParam && isSportType(sportParam) ? sportParam : "all"
  );
  const [status, setStatus] = useState<StatusFilter>(lockedStatus ?? "all");
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<SortKey>("soonest");
  const [view, setView] = useState<ViewMode>("grid");
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);

  // Deep links from the command palette change the query, not the component.
  useEffect(() => {
    setSport(sportParam && isSportType(sportParam) ? sportParam : "all");
  }, [sportParam]);

  useEffect(() => {
    setView(window.matchMedia("(max-width: 640px)").matches ? "list" : "grid");
  }, []);

  const sportCounts = useMemo(() => {
    const counts = new Map<SportType, number>();
    for (const game of games) {
      counts.set(game.sport, (counts.get(game.sport) ?? 0) + 1);
    }
    return counts;
  }, [games]);

  const withDistance = useMemo(
    () =>
      games.map((game) => ({
        game,
        // Games whose organiser never pinned a spot have no meaningful distance.
        distance:
          origin && hasCoordinates(game.location)
            ? distanceKm(origin, game.location)
            : undefined
      })),
    [games, origin]
  );

  const results = useMemo(() => {
    const needle = term.trim().toLowerCase();

    const filtered = withDistance.filter(({ game }) => {
      if (sport !== "all" && game.sport !== sport) return false;
      if (status !== "all" && game.status !== status) return false;
      if (!needle) return true;

      return `${game.title} ${game.description} ${game.location.label} ${game.location.address} ${game.sport}`
        .toLowerCase()
        .includes(needle);
    });

    const sorted = [...filtered];
    sorted.sort((left, right) => {
      switch (sort) {
        case "popular":
          return (
            right.game.voteCount - left.game.voteCount ||
            right.game.participantCount - left.game.participantCount
          );
        case "nearest":
          return (left.distance ?? Infinity) - (right.distance ?? Infinity);
        case "newest":
          return new Date(right.game.createdAt).getTime() - new Date(left.game.createdAt).getTime();
        default:
          return (
            new Date(left.game.scheduledFor).getTime() - new Date(right.game.scheduledFor).getTime()
          );
      }
    });

    return sorted;
  }, [withDistance, sport, status, term, sort]);

  // Day grouping only makes sense while the list is in chronological order.
  const groups = useMemo(() => {
    if (sort !== "soonest") {
      return [{ key: "all", label: "", order: 0, items: results }];
    }

    const map = new Map<string, { key: string; label: string; order: number; items: typeof results }>();

    for (const entry of results) {
      const bucket = bucketFor(entry.game);
      const existing = map.get(bucket.key);

      if (existing) {
        existing.items.push(entry);
      } else {
        map.set(bucket.key, { ...bucket, items: [entry] });
      }
    }

    return [...map.values()].sort((left, right) => left.order - right.order);
  }, [results, sort]);

  const hasFilters = sport !== "all" || (!lockedStatus && status !== "all") || term.trim() !== "";

  const resetFilters = () => {
    setSport("all");
    setStatus(lockedStatus ?? "all");
    setTerm("");
  };

  const toggleNearMe = async () => {
    if (origin) {
      setOrigin(null);
      if (sort === "nearest") setSort("soonest");
      return;
    }

    setLocating(true);
    try {
      setOrigin(await readBrowserPosition());
      setSort("nearest");
      toast.success("Sorted by distance", "Games closest to you are listed first.");
    } catch (error) {
      toast.error(
        "Could not use your location",
        error instanceof Error ? error.message : undefined
      );
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className={styles.browser}>
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Icon name="search" size={16} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search by title, venue or sport"
            aria-label="Search games"
            type="search"
          />
          {term ? (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setTerm("")}
              aria-label="Clear search"
            >
              <Icon name="close" size={14} strokeWidth={2.2} />
            </button>
          ) : null}
        </div>

        <div className={styles.toolbarGroup}>
          <Segmented
            options={SORT_OPTIONS.filter((option) => option.value !== "nearest" || origin)}
            value={sort}
            onChange={setSort}
            label="Sort games"
          />
        </div>

        <div className={styles.toolbarGroup}>
          <button
            type="button"
            className={`${styles.nearMe} ${origin ? styles.nearMeOn : ""}`}
            onClick={toggleNearMe}
            disabled={locating}
            aria-pressed={Boolean(origin)}
          >
            <Icon name="compass" size={15} />
            {locating ? "Locating…" : origin ? "Near me on" : "Near me"}
          </button>

          <div className={styles.viewToggle} role="group" aria-label="Layout">
            <button
              type="button"
              className={`${styles.viewButton} ${view === "grid" ? styles.viewActive : ""}`}
              onClick={() => setView("grid")}
              aria-label="Grid layout"
              aria-pressed={view === "grid"}
            >
              <Icon name="grid" size={16} />
            </button>
            <button
              type="button"
              className={`${styles.viewButton} ${view === "list" ? styles.viewActive : ""}`}
              onClick={() => setView("list")}
              aria-label="List layout"
              aria-pressed={view === "list"}
            >
              <Icon name="list" size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className={styles.rail}>
        <button
          type="button"
          className={`${styles.pill} ${sport === "all" ? styles.pillActive : ""}`}
          onClick={() => setSport("all")}
          aria-pressed={sport === "all"}
        >
          All sports
          <span className={styles.pillCount}>{games.length}</span>
        </button>

        {SPORTS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.pill} ${sport === option.value ? styles.pillActive : ""}`}
            style={{ "--pill-tint": option.color } as CSSProperties}
            onClick={() => setSport(option.value)}
            aria-pressed={sport === option.value}
          >
            {option.label}
            <span className={styles.pillCount}>{sportCounts.get(option.value) ?? 0}</span>
          </button>
        ))}

        {!lockedStatus ? (
          <>
            <span className={styles.railDivider} aria-hidden="true" />
            <button
              type="button"
              className={`${styles.pill} ${status === "all" ? styles.pillActive : ""}`}
              onClick={() => setStatus("all")}
              aria-pressed={status === "all"}
            >
              Any status
            </button>
            {STATUSES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.pill} ${status === option.value ? styles.pillActive : ""}`}
                onClick={() => setStatus(option.value)}
                aria-pressed={status === option.value}
              >
                {option.label}
              </button>
            ))}
          </>
        ) : null}
      </div>

      <div className={styles.resultMeta} aria-live="polite">
        <span>
          {results.length} {results.length === 1 ? "game" : "games"}
          {origin ? " · sorted by distance" : ""}
        </span>
        {hasFilters ? (
          <button type="button" className={styles.resetLink} onClick={resetFilters}>
            Clear filters
          </button>
        ) : null}
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon="search"
          title={emptyTitle}
          description={emptyDescription}
          actions={
            hasFilters ? (
              <ButtonLink href="/create-game" variant="primary">
                <Icon name="plus" size={16} />
                Propose a game
              </ButtonLink>
            ) : (
              <ButtonLink href="/create-game" variant="primary">
                <Icon name="plus" size={16} />
                Create the first game
              </ButtonLink>
            )
          }
        />
      ) : (
        <div className={styles.groups}>
          {groups.map((group) => (
            <section key={group.key} className={styles.group}>
              {group.label ? (
                <header className={styles.groupHead}>
                  <h3 className={styles.groupTitle}>{group.label}</h3>
                  <span className={styles.groupRule} />
                  <span className={styles.groupCount}>
                    {group.items.length} {group.items.length === 1 ? "game" : "games"}
                  </span>
                </header>
              ) : null}

              <div className={view === "grid" ? styles.grid : styles.list}>
                {group.items.map(({ game, distance }, index) => (
                  <div
                    key={game.id}
                    className={styles.item}
                    style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                  >
                    <GameCard
                      game={game}
                      variant={view === "grid" ? "grid" : "row"}
                      distanceKm={distance}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
