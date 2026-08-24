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

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

const STORAGE_KEY = "base0:theme";

interface ThemeContextValue {
  preference: ThemePreference;
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Runs before paint so the first frame is already in the right theme.
 * Kept in sync with `ThemeProvider` below — both read the same storage key.
 */
export const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    var theme = stored === 'light' || stored === 'dark' ? stored : (prefersLight ? 'light' : 'dark');
    document.documentElement.dataset.theme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
`.trim();

const systemTheme = (): ResolvedTheme =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [theme, setTheme] = useState<ResolvedTheme>("dark");

  // Adopt whatever the bootstrap script already decided.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const resolvedPreference: ThemePreference =
      stored === "light" || stored === "dark" ? stored : "system";

    setPreferenceState(resolvedPreference);
    setTheme(resolvedPreference === "system" ? systemTheme() : resolvedPreference);
  }, []);

  // Follow the OS while the user has not made an explicit choice.
  useEffect(() => {
    if (preference !== "system") return;

    const query = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => setTheme(query.matches ? "light" : "dark");

    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [preference]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);

    if (next === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
      setTheme(systemTheme());
    } else {
      window.localStorage.setItem(STORAGE_KEY, next);
      setTheme(next);
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      theme,
      setPreference,
      toggle: () => setPreference(theme === "dark" ? "light" : "dark")
    }),
    [preference, theme, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return context;
};
