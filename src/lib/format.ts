/** Deterministic 32-bit hash — same input always yields the same colour/angle. */
export const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
};

export const initialsOf = (name: string | null | undefined, fallback = "?"): string => {
  const cleaned = (name ?? "").trim();
  if (!cleaned) return fallback;

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const pad = (value: number) => String(value).padStart(2, "0");

export const toDate = (value: string | number | Date): Date =>
  value instanceof Date ? value : new Date(value);

export const formatDate = (value: string | number | Date, opts?: Intl.DateTimeFormatOptions) =>
  toDate(value).toLocaleDateString(undefined, opts ?? { month: "short", day: "numeric" });

export const formatTime = (value: string | number | Date) =>
  toDate(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export const formatDateTime = (value: string | number | Date) =>
  toDate(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

export const formatLongDate = (value: string | number | Date) =>
  toDate(value).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

const DAY_MS = 86_400_000;

/** Midnight-aligned difference in days, so "tomorrow" is stable regardless of clock time. */
export const daysUntil = (value: string | number | Date): number => {
  const target = toDate(value);
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / DAY_MS);
};

/** "Today", "Tomorrow", "Sat 14 Jun" — the phrasing people actually use. */
export const friendlyDay = (value: string | number | Date): string => {
  const offset = daysUntil(value);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";
  if (offset > 1 && offset < 7) {
    return toDate(value).toLocaleDateString(undefined, { weekday: "long" });
  }
  return formatDate(value, { weekday: "short", month: "short", day: "numeric" });
};

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", DAY_MS],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1000]
];

export const relativeTime = (value: string | number | Date): string => {
  const delta = toDate(value).getTime() - Date.now();
  const absolute = Math.abs(delta);

  if (absolute < 45_000) return "just now";

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (absolute >= ms || unit === "second") {
      return formatter.format(Math.round(delta / ms), unit);
    }
  }

  return "just now";
};

export interface Duration {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

export const durationUntil = (value: string | number | Date): Duration => {
  const total = Math.max(0, toDate(value).getTime() - Date.now());
  return {
    total,
    days: Math.floor(total / DAY_MS),
    hours: Math.floor((total % DAY_MS) / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1000),
    expired: total <= 0
  };
};

/** Compact countdown: "3d 04h", "07:12", "0:42". */
export const formatDuration = ({ days, hours, minutes, seconds, expired }: Duration): string => {
  if (expired) return "Closed";
  if (days > 0) return `${days}d ${pad(hours)}h`;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
};

/** Local-time value for `<input type="datetime-local">`. */
export const toDateTimeLocal = (value: Date): string =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;

export const pluralise = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;
