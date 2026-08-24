"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AuthProvider, type SessionUser } from "@/components/auth/auth-context";
import { CommandProvider } from "@/providers/command-provider";
import { NotificationsProvider } from "@/providers/notifications-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { Brand } from "./brand";
import { Header } from "./header";
import styles from "./app-shell.module.css";

const Backdrop = () => (
  <div className={styles.backdrop} aria-hidden="true">
    <div className={`${styles.aurora} ${styles.auroraGold}`} />
    <div className={`${styles.aurora} ${styles.auroraCool}`} />
    <div className={`${styles.aurora} ${styles.auroraWarm}`} />
    <div className={styles.grid} />
    <div className={styles.noise} />
  </div>
);

const Footer = () => (
  <footer className={styles.footer}>
    <div className={`u-shell ${styles.footerInner}`}>
      <div>
        <div className={styles.footerBrand}>
          <Brand />
        </div>
        <p className={styles.footerTag}>
          Community-run pickup sports. Propose a game, let the crowd vote, and show up to a full roster.
        </p>
      </div>

      <nav className={styles.footerLinks} aria-label="Footer">
        <Link href="/" className={styles.footerLink}>
          Discover
        </Link>
        <Link href="/votes" className={styles.footerLink}>
          Vote queue
        </Link>
        <Link href="/create-game" className={styles.footerLink}>
          Create a game
        </Link>
        <Link href="/profile" className={styles.footerLink}>
          Your profile
        </Link>
      </nav>
    </div>
    <div className={`u-shell ${styles.footerMeta}`}>
      © {new Date().getFullYear()} BASE-0 · Built for players, not spectators
    </div>
  </footer>
);

/** Routes that render edge-to-edge, without header or footer. */
const CHROMELESS = new Set(["/login", "/signup"]);

/** Chrome for signed-in routes; auth screens render edge-to-edge without it. */
const Chrome = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();

  if (CHROMELESS.has(pathname)) {
    return <div className={styles.shell}>{children}</div>;
  }

  return (
    <div className={styles.shell}>
      <Header />
      <main className={styles.main} id="main-content">
        {children}
      </main>
      <Footer />
    </div>
  );
};

interface AppShellProps {
  children: ReactNode;
  /** Verified server-side in the root layout. */
  user: SessionUser | null;
}

/*
 * There is deliberately no client-side auth gate here: `src/middleware.ts`
 * redirects signed-out visitors before the page is ever rendered, so the shell
 * never has to show a splash screen while it works out who you are.
 */
export const AppShell = ({ children, user }: AppShellProps) => (
  <ThemeProvider>
    <AuthProvider initialUser={user}>
      <NotificationsProvider>
        <ToastProvider>
          <CommandProvider>
            <Backdrop />
            <Chrome>{children}</Chrome>
          </CommandProvider>
        </ToastProvider>
      </NotificationsProvider>
    </AuthProvider>
  </ThemeProvider>
);
