"use client";

import type { ReactNode } from "react";

import { Brand } from "@/components/layout/brand";
import { Icon } from "@/components/ui/icon";
import { SportMark } from "@/components/ui/sport-mark";
import { SPORTS } from "@/lib/sports";
import { useTheme } from "@/providers/theme-provider";
import styles from "./auth.module.css";

const HIGHLIGHTS = [
  "Propose a match and let the community vote it in",
  "Automatic waitlists, so a full roster stays full",
  "Private game chat for kit, lifts and last-minute changes"
];

interface AuthShellProps {
  headline: ReactNode;
  children: ReactNode;
}

export const AuthShell = ({ headline, children }: AuthShellProps) => {
  const { theme, toggle } = useTheme();

  return (
    <div className={styles.page}>
      <aside className={styles.showcase}>
        <Brand />

        <div className={styles.showcaseCopy}>
          <h2 className={styles.showcaseTitle}>{headline}</h2>
          <p className={styles.showcaseText}>
            BASE-0 turns “who&apos;s in?” into a real schedule. One vote each, transparent rosters,
            and a reputation that follows you from game to game.
          </p>

          <ul className={styles.showcaseList}>
            {HIGHLIGHTS.map((item) => (
              <li key={item} className={styles.showcaseItem}>
                <span className={styles.showcaseTick}>
                  <Icon name="check" size={13} strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.showcaseFooter}>
          <div className={styles.sportsRow}>
            {SPORTS.slice(0, 5).map((sport) => (
              <span key={sport.value} className={styles.sportChip} title={sport.label}>
                <SportMark sport={sport.value} size={20} />
              </span>
            ))}
          </div>
          <span>Six sports · one community</span>
        </div>
      </aside>

      <main className={styles.formSide}>
        <div className={styles.formTop}>
          <Brand compact size={28} />
          <button
            type="button"
            className={styles.themeButton}
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
          </button>
        </div>

        {children}

        <p className={styles.legal}>
          By continuing you agree to play fair, show up when you say you will, and keep the chat
          civil.
        </p>
      </main>
    </div>
  );
};
