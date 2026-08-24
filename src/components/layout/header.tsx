"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth/auth-context";
import { Avatar } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { useCommandPalette } from "@/providers/command-provider";
import { useNotifications } from "@/providers/notifications-provider";
import { useTheme } from "@/providers/theme-provider";
import { Brand } from "./brand";
import styles from "./header.module.css";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Shown in the mobile tab bar only. */
  shortLabel?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Discover", icon: "compass" },
  { href: "/votes", label: "Vote queue", icon: "vote", shortLabel: "Votes" },
  { href: "/create-game", label: "Create", icon: "plus" },
  { href: "/notifications", label: "Updates", icon: "bell" },
  { href: "/profile", label: "Profile", icon: "user" }
];

const isActiveRoute = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

export const Header = () => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { open: openCommandPalette } = useCommandPalette();
  const { theme, toggle: toggleTheme } = useTheme();

  const [stuck, setStuck] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Player";

  return (
    <>
      <header className={`${styles.header} ${stuck ? styles.stuck : ""}`}>
        <div className={`u-shell ${styles.bar}`}>
          <Brand />

          <nav className={styles.nav} aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              const showCount = item.href === "/notifications" && unreadCount > 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink} ${active ? styles.navActive : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon name={item.icon} size={15} />
                  {item.label}
                  {showCount ? (
                    <span className={styles.navCount}>{unreadCount > 9 ? "9+" : unreadCount}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className={styles.actions}>
            <button type="button" className={styles.search} onClick={openCommandPalette}>
              <Icon name="search" size={16} />
              <span className={styles.searchLabel}>Search games</span>
              <kbd className={styles.kbd}>⌘K</kbd>
            </button>

            <button
              type="button"
              className={styles.iconButton}
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
            </button>

            {user ? (
              <>
                <Link
                  href="/notifications"
                  className={styles.iconButton}
                  aria-label={
                    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
                  }
                >
                  <Icon name="bell" size={17} />
                  {unreadCount > 0 ? (
                    <span className={styles.badgeDot}>{unreadCount > 9 ? "9+" : unreadCount}</span>
                  ) : null}
                </Link>

                <div className={styles.account} ref={accountRef}>
                  <button
                    type="button"
                    className={styles.accountTrigger}
                    onClick={() => setMenuOpen((current) => !current)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                  >
                    <Avatar name={displayName} seed={user.uid} size="sm" />
                    <span className={`${styles.accountName} u-truncate`}>{displayName}</span>
                    <Icon name="chevronDown" size={14} />
                  </button>

                  {menuOpen ? (
                    <div className={styles.menu} role="menu">
                      <div className={styles.menuHeader}>
                        <Avatar name={displayName} seed={user.uid} />
                        <span className={styles.menuIdentity}>
                          <span className={`${styles.menuName} u-truncate`}>{displayName}</span>
                          <span className={`${styles.menuEmail} u-truncate`}>{user.email}</span>
                        </span>
                      </div>

                      <Link href="/profile" className={styles.menuItem} role="menuitem">
                        <Icon name="user" size={16} />
                        Profile &amp; stats
                      </Link>
                      <Link href="/create-game" className={styles.menuItem} role="menuitem">
                        <Icon name="plus" size={16} />
                        Create a game
                      </Link>
                      <button
                        type="button"
                        className={styles.menuItem}
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          openCommandPalette();
                        }}
                      >
                        <Icon name="command" size={16} />
                        Command palette
                        <span className={styles.menuHint}>⌘K</span>
                      </button>

                      <div className={styles.menuDivider} />

                      <button
                        type="button"
                        className={`${styles.menuItem} ${styles.menuDanger}`}
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          void logout();
                        }}
                      >
                        <Icon name="logOut" size={16} />
                        Sign out
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <ButtonLink href="/login" variant="primary" size="sm">
                Sign in
              </ButtonLink>
            )}
          </div>
        </div>
      </header>

      {user ? (
        <nav className={styles.tabbar} aria-label="Primary mobile">
          {NAV_ITEMS.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const isCreate = item.href === "/create-game";
            const showCount = item.href === "/notifications" && unreadCount > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.tab} ${active ? styles.tabActive : ""} ${isCreate ? styles.tabCreate : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={item.icon} size={18} />
                <span className={styles.tabLabel}>{item.shortLabel ?? item.label}</span>
                {showCount ? (
                  <span className={styles.tabCount}>{unreadCount > 9 ? "9+" : unreadCount}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </>
  );
};
