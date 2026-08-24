"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { useAuth } from "@/components/auth/auth-context";
import {
  fetchNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction
} from "@/app/actions/account";
import type { NotificationItem } from "@/types/domain";

interface NotificationsContextValue {
  items: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const POLL_MS = 60_000;

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }

    setLoading(true);
    try {
      const result = await fetchNotificationsAction();

      if (result.ok) {
        setItems(result.data);
        setError("");
      } else {
        setError(result.message);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    if (!userId) return;

    // Poll quietly in the background; pause while the tab is hidden.
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    const interval = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh, userId]);

  // Both mutations update local state first — the badge should never lag a click.
  const markRead = useCallback(
    async (id: string) => {
      if (!userId) return;

      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, read: true } : item))
      );

      const result = await markNotificationReadAction(id);
      // Re-sync if the server disagreed with the optimistic update.
      if (!result.ok) void refresh();
    },
    [userId, refresh]
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;

    setItems((current) => current.map((item) => ({ ...item, read: true })));

    const result = await markAllNotificationsReadAction();
    if (!result.ok) void refresh();
  }, [userId, refresh]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      items,
      unreadCount: items.reduce((total, item) => total + (item.read ? 0 : 1), 0),
      loading,
      error,
      refresh,
      markRead,
      markAllRead
    }),
    [items, loading, error, refresh, markRead, markAllRead]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used inside a NotificationsProvider");
  }
  return context;
};
