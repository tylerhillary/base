import type { GameSummary } from "@/types/domain";

const stamp = (value: Date) => `${value.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;

/** Escapes the characters iCalendar treats as structure. */
const escapeText = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545 caps content lines at 75 octets; continuations start with a space. */
const fold = (line: string): string => {
  if (line.length <= 74) return line;

  const parts: string[] = [line.slice(0, 74)];
  let rest = line.slice(74);

  while (rest.length > 73) {
    parts.push(` ${rest.slice(0, 73)}`);
    rest = rest.slice(73);
  }

  if (rest) parts.push(` ${rest}`);
  return parts.join("\r\n");
};

/** Best-guess duration per sport, since games only store a start time. */
const DURATION_MINUTES: Record<string, number> = {
  football: 90,
  basketball: 90,
  tennis: 90,
  volleyball: 90,
  running: 60,
  other: 90
};

export const buildCalendarEvent = (game: GameSummary): string => {
  const start = new Date(game.scheduledFor);
  const end = new Date(start.getTime() + (DURATION_MINUTES[game.sport] ?? 90) * 60_000);

  const description = [
    game.description,
    `Sport: ${game.sport}`,
    `Roster: ${game.participantCount}/${game.maxPlayers}`,
    "Organised on BASE-0"
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BASE-0//Pickup Sports//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:base0-${game.id}@base-0`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(game.title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(`${game.location.label}, ${game.location.address}`)}`,
    `GEO:${game.location.lat};${game.location.lng}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(`${game.title} starts in 2 hours`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  return lines.map(fold).join("\r\n");
};

/** Triggers a download of the event as an .ics file. */
export const downloadCalendarEvent = (game: GameSummary) => {
  const blob = new Blob([buildCalendarEvent(game)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${game.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "base-0-game"}.ics`;
  document.body.append(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
};
