import Link from "next/link";

import styles from "./brand.module.css";

interface BrandMarkProps {
  size?: number;
  className?: string;
}

/** The diamond home-plate mark: a base, drawn as a zero. */
export const BrandMark = ({ size = 32, className }: BrandMarkProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="base0-mark" x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--gold-200)" />
        <stop offset="0.55" stopColor="var(--gold-400)" />
        <stop offset="1" stopColor="var(--gold-600)" />
      </linearGradient>
    </defs>
    <path
      d="M20 3.2 33.6 11v18L20 36.8 6.4 29V11Z"
      fill="url(#base0-mark)"
      fillOpacity="0.16"
      stroke="url(#base0-mark)"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="M20 12.4 26.4 16v8L20 27.6 13.6 24v-8Z"
      stroke="url(#base0-mark)"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <circle cx="20" cy="20" r="2.1" fill="url(#base0-mark)" />
  </svg>
);

interface BrandProps {
  href?: string;
  size?: number;
  compact?: boolean;
  className?: string;
}

export const Brand = ({ href = "/", size = 30, compact, className }: BrandProps) => {
  const content = (
    <>
      <BrandMark size={size} className={styles.mark} />
      {!compact ? (
        <span className={styles.word}>
          BASE<span className={styles.zero}>-0</span>
        </span>
      ) : null}
    </>
  );

  return (
    <Link href={href} className={`${styles.brand} ${className ?? ""}`} aria-label="BASE-0 home">
      {content}
    </Link>
  );
};
