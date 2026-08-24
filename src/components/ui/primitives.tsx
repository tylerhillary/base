import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { hashString, initialsOf } from "@/lib/format";
import { Icon, type IconName } from "./icon";
import styles from "./primitives.module.css";

const cx = (...values: Array<string | false | undefined>) => values.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ Panel */

interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "article" | "div" | "aside";
  padded?: boolean;
}

export const Panel = ({ as: Tag = "section", padded, className, children, ...rest }: PanelProps) => (
  <Tag className={cx(styles.panel, padded && styles.panelPad, className)} {...rest}>
    {children}
  </Tag>
);

interface PanelHeadProps {
  title: ReactNode;
  icon?: IconName;
  action?: ReactNode;
}

export const PanelHead = ({ title, icon, action }: PanelHeadProps) => (
  <header className={styles.panelHead}>
    <h2 className={styles.panelTitle}>
      {icon ? <Icon name={icon} size={18} /> : null}
      {title}
    </h2>
    {action}
  </header>
);

export const PanelBody = ({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cx(styles.panelBody, className)} {...rest}>
    {children}
  </div>
);

/* ------------------------------------------------------------------ Badge */

export type BadgeTone = "gold" | "live" | "danger" | "muted" | "info" | "neutral";

interface BadgeProps {
  tone?: BadgeTone;
  solid?: boolean;
  dot?: boolean;
  pulse?: boolean;
  icon?: IconName;
  /** Overrides the tone with an explicit colour (used for per-sport tinting). */
  tint?: string;
  className?: string;
  children: ReactNode;
}

const badgeToneClass: Record<BadgeTone, string> = {
  gold: styles.badgeGold,
  live: styles.badgeLive,
  danger: styles.badgeDanger,
  muted: styles.badgeMuted,
  info: styles.badgeInfo,
  neutral: ""
};

export const Badge = ({
  tone = "neutral",
  solid,
  dot,
  pulse,
  icon,
  tint,
  className,
  children
}: BadgeProps) => (
  <span
    className={cx(styles.badge, badgeToneClass[tone], solid && styles.badgeSolid, className)}
    style={tint ? ({ "--badge-tint": tint } as CSSProperties) : undefined}
  >
    {dot ? <span className={cx(styles.dot, pulse && styles.dotPulse)} /> : null}
    {icon ? <Icon name={icon} size={12} strokeWidth={2.2} /> : null}
    {children}
  </span>
);

/* ----------------------------------------------------------------- Avatar */

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  name?: string | null;
  /** Stable identity (uid/email). Drives the generated gradient. */
  seed?: string | null;
  size?: AvatarSize;
  ring?: boolean;
  className?: string;
  title?: string;
}

const avatarSizeClass: Record<AvatarSize, string> = {
  xs: styles.avatarXs,
  sm: styles.avatarSm,
  md: "",
  lg: styles.avatarLg,
  xl: styles.avatarXl
};

/** Two-stop gradient derived from the seed, so a person looks the same everywhere. */
const gradientFor = (seed: string) => {
  const hash = hashString(seed || "base-0");
  const hue = hash % 360;
  const partner = (hue + 42 + (hash % 40)) % 360;
  return `linear-gradient(135deg, hsl(${hue} 72% 68%), hsl(${partner} 78% 54%))`;
};

export const Avatar = ({ name, seed, size = "md", ring, className, title }: AvatarProps) => (
  <span
    className={cx(styles.avatar, avatarSizeClass[size], ring && styles.avatarRing, className)}
    style={{ "--avatar-bg": gradientFor(seed || name || "") } as CSSProperties}
    title={title ?? name ?? undefined}
    aria-hidden={title ? undefined : true}
  >
    {initialsOf(name)}
  </span>
);

interface AvatarStackProps {
  people: Array<{ id: string; name: string }>;
  max?: number;
  size?: AvatarSize;
}

export const AvatarStack = ({ people, max = 4, size = "sm" }: AvatarStackProps) => {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <span className={styles.avatarStack}>
      {shown.map((person) => (
        <Avatar key={person.id} name={person.name} seed={person.id} size={size} ring />
      ))}
      {overflow > 0 ? (
        <span className={cx(styles.avatar, avatarSizeClass[size], styles.avatarMore)}>
          +{overflow}
        </span>
      ) : null}
    </span>
  );
};

/* --------------------------------------------------------------- Skeleton */

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string;
  className?: string;
}

export const Skeleton = ({ width, height = "1rem", radius, className }: SkeletonProps) => (
  <span
    className={cx(styles.skeleton, className)}
    style={{ display: "block", width: width ?? "100%", height, borderRadius: radius }}
    aria-hidden="true"
  />
);

export const Spinner = ({ large, className }: { large?: boolean; className?: string }) => (
  <span className={cx(styles.spinner, large && styles.spinnerLg, className)} role="status" aria-label="Loading" />
);

/* -------------------------------------------------------------- Stat tile */

interface StatTileProps {
  icon: IconName;
  value: ReactNode;
  label: string;
  hint?: string;
  tint?: string;
  pulse?: boolean;
  textValue?: boolean;
  className?: string;
}

export const StatTile = ({
  icon,
  value,
  label,
  hint,
  tint,
  pulse,
  textValue,
  className
}: StatTileProps) => (
  <div
    className={cx(styles.stat, className)}
    style={tint ? ({ "--stat-tint": tint } as CSSProperties) : undefined}
  >
    <span className={styles.statIcon}>
      {pulse ? <span className={cx(styles.dot, styles.dotPulse)} style={{ position: "absolute", top: 6, right: 6 }} /> : null}
      <Icon name={icon} size={20} />
    </span>
    <span className={styles.statBody}>
      <span className={cx(styles.statValue, textValue && styles.statValueText, "u-truncate")}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {hint ? <span className={styles.statHint}>{hint}</span> : null}
    </span>
  </div>
);

/* ------------------------------------------------------------------ Meter */

interface MeterProps {
  value: number;
  max?: number;
  tint?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export const Meter = ({ value, max = 100, tint, label, className, style }: MeterProps) => {
  const percent = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div
      className={cx(styles.meter, className)}
      style={{ ...style, ...(tint ? ({ "--meter-tint": tint } as CSSProperties) : {}) }}
      role="meter"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={styles.meterFill} style={{ width: `${percent}%` }} />
    </div>
  );
};

/* ------------------------------------------------------------ Empty state */

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  actions?: ReactNode;
  inline?: boolean;
  className?: string;
}

export const EmptyState = ({
  icon = "sparkle",
  title,
  description,
  actions,
  inline,
  className
}: EmptyStateProps) => (
  <div className={cx(styles.empty, inline && styles.emptyInline, className)}>
    <span className={styles.emptyArt}>
      <Icon name={icon} size={inline ? 22 : 28} />
    </span>
    <h3 className={styles.emptyTitle}>{title}</h3>
    {description ? <p className={styles.emptyText}>{description}</p> : null}
    {actions ? <div className={styles.emptyActions}>{actions}</div> : null}
  </div>
);

/* ---------------------------------------------------------------- Callout */

type CalloutTone = "info" | "success" | "warn" | "danger" | "gold";

const calloutToneClass: Record<CalloutTone, string> = {
  info: "",
  success: styles.calloutSuccess,
  warn: styles.calloutWarn,
  danger: styles.calloutDanger,
  gold: styles.calloutGold
};

const calloutIcon: Record<CalloutTone, IconName> = {
  info: "sparkle",
  success: "checkCircle",
  warn: "warning",
  danger: "warning",
  gold: "trophy"
};

interface CalloutProps {
  tone?: CalloutTone;
  icon?: IconName;
  className?: string;
  children: ReactNode;
}

export const Callout = ({ tone = "info", icon, className, children }: CalloutProps) => (
  <p
    className={cx(styles.callout, calloutToneClass[tone], className)}
    role={tone === "danger" ? "alert" : "status"}
  >
    <Icon name={icon ?? calloutIcon[tone]} size={16} />
    <span>{children}</span>
  </p>
);

/* ----------------------------------------------------------- Progress ring */

interface ProgressRingProps {
  /** 0–1. */
  progress: number;
  size?: number;
  thickness?: number;
  tint?: string;
  value?: string;
  unit?: string;
  label?: string;
}

export const ProgressRing = ({
  progress,
  size = 64,
  thickness = 5,
  tint,
  value,
  unit,
  label
}: ProgressRingProps) => {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <div
      className={styles.ring}
      style={{ width: size, height: size, ...(tint ? ({ "--ring-tint": tint } as CSSProperties) : {}) }}
      role="img"
      aria-label={label}
    >
      <svg className={styles.ringSvg} width={size} height={size}>
        <circle
          className={styles.ringTrack}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
        />
        <circle
          className={styles.ringValue}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
        />
      </svg>
      {value ? (
        <span className={styles.ringLabel}>
          <span className={styles.ringLabelValue}>{value}</span>
          {unit ? <span className={styles.ringLabelUnit}>{unit}</span> : null}
        </span>
      ) : null}
    </div>
  );
};
