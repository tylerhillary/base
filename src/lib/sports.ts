import type { GameStatus, SportType } from "@/types/domain";

export interface SportMeta {
  value: SportType;
  label: string;
  /** CSS custom property holding this sport's identity colour. */
  color: string;
  /** Short line shown in filter menus and the create-game picker. */
  blurb: string;
  defaultPlayers: number;
}

export const SPORTS: readonly SportMeta[] = [
  { value: "football", label: "Football", color: "var(--sport-football)", blurb: "5-a-side to full pitch", defaultPlayers: 10 },
  { value: "basketball", label: "Basketball", color: "var(--sport-basketball)", blurb: "Half court or full court", defaultPlayers: 10 },
  { value: "tennis", label: "Tennis", color: "var(--sport-tennis)", blurb: "Singles or doubles", defaultPlayers: 4 },
  { value: "volleyball", label: "Volleyball", color: "var(--sport-volleyball)", blurb: "Indoor or beach", defaultPlayers: 12 },
  { value: "running", label: "Running", color: "var(--sport-running)", blurb: "Group runs and track sets", defaultPlayers: 20 },
  { value: "other", label: "Other", color: "var(--sport-other)", blurb: "Anything else you play", defaultPlayers: 8 }
] as const;

const sportsByValue = new Map(SPORTS.map((sport) => [sport.value, sport]));

export const getSport = (value: SportType | string): SportMeta =>
  sportsByValue.get(value as SportType) ?? SPORTS[SPORTS.length - 1];

export const isSportType = (value: string): value is SportType => sportsByValue.has(value as SportType);

export interface StatusMeta {
  value: GameStatus;
  label: string;
  /** Verb-first phrasing for the game header. */
  headline: string;
  tone: "live" | "gold" | "muted" | "danger";
}

export const STATUSES: readonly StatusMeta[] = [
  { value: "proposed", label: "Voting", headline: "Open for voting", tone: "gold" },
  { value: "confirmed", label: "Confirmed", headline: "Locked in", tone: "live" },
  { value: "completed", label: "Played", headline: "Wrapped up", tone: "muted" },
  { value: "cancelled", label: "Cancelled", headline: "Called off", tone: "danger" }
] as const;

const statusesByValue = new Map(STATUSES.map((status) => [status.value, status]));

export const getStatus = (value: GameStatus | string): StatusMeta =>
  statusesByValue.get(value as GameStatus) ?? STATUSES[0];

export const isGameStatus = (value: string): value is GameStatus =>
  statusesByValue.has(value as GameStatus);
