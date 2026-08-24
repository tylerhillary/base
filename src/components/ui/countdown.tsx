"use client";

import { useEffect, useState } from "react";

import { durationUntil, formatDuration, type Duration } from "@/lib/format";
import { ProgressRing } from "./primitives";

/**
 * Ticks once a second while the deadline is near, and once a minute when it is
 * days away — a running seconds display is only useful in the final hour.
 */
const useCountdown = (deadline: string) => {
  const [duration, setDuration] = useState<Duration | null>(null);

  useEffect(() => {
    const tick = () => setDuration(durationUntil(deadline));
    tick();

    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [deadline]);

  return duration;
};

interface CountdownProps {
  deadline: string;
  /** Shown before hydration and after expiry. */
  expiredLabel?: string;
  className?: string;
}

export const Countdown = ({ deadline, expiredLabel = "Closed", className }: CountdownProps) => {
  const duration = useCountdown(deadline);

  if (!duration) {
    return <span className={className} suppressHydrationWarning>—</span>;
  }

  return (
    <span className={className} suppressHydrationWarning>
      {duration.expired ? expiredLabel : formatDuration(duration)}
    </span>
  );
};

interface CountdownRingProps {
  deadline: string;
  /** When voting opened, so the ring can show elapsed vs remaining. */
  openedAt: string;
  size?: number;
  tint?: string;
}

export const CountdownRing = ({ deadline, openedAt, size = 68, tint }: CountdownRingProps) => {
  const duration = useCountdown(deadline);

  if (!duration) {
    return <ProgressRing progress={0} size={size} tint={tint} value="—" unit="left" label="Voting window" />;
  }

  const window = Math.max(1, new Date(deadline).getTime() - new Date(openedAt).getTime());
  const progress = duration.expired ? 0 : duration.total / window;

  const value = duration.expired
    ? "0"
    : duration.days > 0
      ? String(duration.days)
      : duration.hours > 0
        ? String(duration.hours)
        : String(duration.minutes);

  const unit = duration.expired
    ? "closed"
    : duration.days > 0
      ? duration.days === 1 ? "day" : "days"
      : duration.hours > 0
        ? "hrs"
        : "min";

  return (
    <ProgressRing
      progress={progress}
      size={size}
      tint={duration.expired ? "var(--text-subtle)" : tint}
      value={value}
      unit={unit}
      label={`Voting ${duration.expired ? "closed" : `closes in ${formatDuration(duration)}`}`}
    />
  );
};
