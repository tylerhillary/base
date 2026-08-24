import type { ReactNode } from "react";
import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/icon";
import styles from "./page-header.module.css";

interface PageHeaderProps {
  eyebrow?: string;
  eyebrowIcon?: IconName;
  title: string;
  /** Rendered as a pill beside the title — used for unread and queue counts. */
  count?: number;
  lede?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}

export const PageHeader = ({
  eyebrow,
  eyebrowIcon,
  title,
  count,
  lede,
  actions,
  backHref,
  backLabel = "Back to all games"
}: PageHeaderProps) => (
  <header className={styles.header}>
    {backHref ? (
      <Link href={backHref} className={styles.back}>
        <Icon name="arrowLeft" size={15} />
        {backLabel}
      </Link>
    ) : null}

    <div className={styles.row}>
      <div>
        {eyebrow ? (
          <p className={styles.eyebrow}>
            {eyebrowIcon ? <Icon name={eyebrowIcon} size={13} strokeWidth={2.2} /> : null}
            {eyebrow}
          </p>
        ) : null}

        <h1 className={styles.title}>
          {title}
          {typeof count === "number" && count > 0 ? (
            <span className={styles.count}>{count}</span>
          ) : null}
        </h1>

        {lede ? <p className={styles.lede}>{lede}</p> : null}
      </div>

      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  </header>
);
