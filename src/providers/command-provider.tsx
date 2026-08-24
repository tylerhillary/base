"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useRouter } from "next/navigation";

import { Icon, type IconName } from "@/components/ui/icon";
import { listGamesAction } from "@/app/actions/games";
import { friendlyDay } from "@/lib/format";
import { SPORTS } from "@/lib/sports";
import type { GameSummary } from "@/types/domain";
import { useTheme } from "./theme-provider";
import styles from "./command-palette.module.css";

interface CommandContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const CommandContext = createContext<CommandContextValue | null>(null);

interface CommandItem {
  id: string;
  group: string;
  title: string;
  hint?: string;
  meta?: string;
  icon: IconName;
  keywords: string;
  run: () => void;
}

export const CommandProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { theme, setPreference } = useTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [games, setGames] = useState<GameSummary[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);
  const open = useCallback(() => {
    setTerm("");
    setActiveIndex(0);
    setIsOpen(true);
  }, []);

  // Global shortcut.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      /*
       * `key` is typed as a string but is genuinely absent on synthetic events —
       * password managers, autofill and extensions all dispatch keydowns without
       * it — so this has to be checked before any string method is called.
       */
      if (typeof event.key !== "string") return;

      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Load the game list lazily, only once the palette is actually opened.
  useEffect(() => {
    if (!isOpen) return;

    inputRef.current?.focus();
    document.body.style.overflow = "hidden";

    void listGamesAction(60).then((result) => {
      setGames(result.ok ? result.data : []);
    });

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const navigate = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  const items = useMemo<CommandItem[]>(() => {
    const actions: CommandItem[] = [
      {
        id: "nav-home",
        group: "Go to",
        title: "Browse games",
        icon: "compass",
        keywords: "home games browse discover",
        run: () => navigate("/")
      },
      {
        id: "nav-create",
        group: "Go to",
        title: "Create a game",
        hint: "Propose a new match",
        icon: "plus",
        keywords: "create new game propose organise organize",
        run: () => navigate("/create-game")
      },
      {
        id: "nav-votes",
        group: "Go to",
        title: "Vote queue",
        icon: "vote",
        keywords: "vote queue proposals",
        run: () => navigate("/votes")
      },
      {
        id: "nav-notifications",
        group: "Go to",
        title: "Notifications",
        icon: "bell",
        keywords: "notifications alerts updates inbox",
        run: () => navigate("/notifications")
      },
      {
        id: "nav-profile",
        group: "Go to",
        title: "Your profile",
        icon: "user",
        keywords: "profile account me stats",
        run: () => navigate("/profile")
      },
      {
        id: "theme",
        group: "Preferences",
        title: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: theme === "dark" ? "sun" : "moon",
        keywords: "theme dark light appearance mode",
        run: () => {
          setPreference(theme === "dark" ? "light" : "dark");
          close();
        }
      },
      {
        id: "theme-system",
        group: "Preferences",
        title: "Match system theme",
        icon: "settings",
        keywords: "theme system auto appearance",
        run: () => {
          setPreference("system");
          close();
        }
      }
    ];

    const sportFilters: CommandItem[] = SPORTS.map((sport) => ({
      id: `sport-${sport.value}`,
      group: "Filter by sport",
      title: sport.label,
      hint: sport.blurb,
      icon: "filter",
      keywords: `${sport.value} ${sport.label} filter sport`,
      run: () => navigate(`/?sport=${sport.value}`)
    }));

    const gameItems: CommandItem[] = games.map((game) => ({
      id: `game-${game.id}`,
      group: "Games",
      title: game.title,
      hint: `${game.location.label} · ${game.sport}`,
      meta: friendlyDay(game.scheduledFor),
      icon: "ticket",
      keywords: `${game.title} ${game.sport} ${game.location.label} ${game.location.address} ${game.status}`,
      run: () => navigate(`/games/${game.id}`)
    }));

    return [...actions, ...sportFilters, ...gameItems];
  }, [games, navigate, theme, setPreference, close]);

  const results = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return items.filter((item) => item.group !== "Games").slice(0, 9).concat(
      items.filter((item) => item.group === "Games").slice(0, 5)
    );

    return items
      .filter((item) => `${item.title} ${item.hint ?? ""} ${item.keywords}`.toLowerCase().includes(needle))
      .slice(0, 24);
  }, [items, term]);

  useEffect(() => {
    setActiveIndex(0);
  }, [term]);

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    if (!isOpen) return;
    listRef.current
      ?.querySelectorAll<HTMLElement>("[data-command-item]")
      ?.[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen, results.length]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (results.length ? (current + 1) % results.length : 0));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (results.length ? (current - 1 + results.length) % results.length : 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      results[activeIndex]?.run();
    }
  };

  const value = useMemo<CommandContextValue>(() => ({ open, close, isOpen }), [open, close, isOpen]);

  let lastGroup = "";

  return (
    <CommandContext.Provider value={value}>
      {children}

      {isOpen ? (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className={styles.panel} onKeyDown={onKeyDown}>
            <div className={styles.searchRow}>
              <Icon name="search" size={18} className={styles.searchIcon} />
              <input
                ref={inputRef}
                className={styles.input}
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search games, jump to a page, change settings…"
                aria-label="Search commands and games"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className={styles.escape}>ESC</kbd>
            </div>

            <div className={styles.results} ref={listRef}>
              {results.length === 0 ? (
                <p className={styles.emptyResults}>Nothing matches “{term}”.</p>
              ) : (
                results.map((item, index) => {
                  const showGroup = item.group !== lastGroup;
                  lastGroup = item.group;

                  return (
                    <div key={item.id}>
                      {showGroup ? <p className={styles.groupLabel}>{item.group}</p> : null}
                      <button
                        type="button"
                        data-command-item
                        className={`${styles.item} ${index === activeIndex ? styles.itemActive : ""}`}
                        onMouseMove={() => setActiveIndex(index)}
                        onClick={item.run}
                      >
                        <span className={styles.itemIcon}>
                          <Icon name={item.icon} size={16} />
                        </span>
                        <span className={styles.itemBody}>
                          <span className={styles.itemTitle}>{item.title}</span>
                          {item.hint ? <span className={styles.itemHint}>{item.hint}</span> : null}
                        </span>
                        {item.meta ? <span className={styles.itemMeta}>{item.meta}</span> : null}
                        <Icon name="arrowRight" size={15} className={styles.itemArrow} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className={styles.footer}>
              <span className={styles.footerKey}>
                <b>↑</b>
                <b>↓</b> navigate
              </span>
              <span className={styles.footerKey}>
                <b>↵</b> open
              </span>
              <span className={styles.footerKey}>
                <b>esc</b> close
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </CommandContext.Provider>
  );
};

export const useCommandPalette = () => {
  const context = useContext(CommandContext);
  if (!context) {
    throw new Error("useCommandPalette must be used inside a CommandProvider");
  }
  return context;
};
