import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

import styles from "./button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface SharedProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  iconOnly?: boolean;
  className?: string;
  children?: ReactNode;
}

const classesFor = ({ variant = "secondary", size = "md", block, iconOnly, className }: SharedProps) =>
  [
    styles.btn,
    styles[variant],
    size !== "md" ? styles[size] : "",
    block ? styles.block : "",
    iconOnly ? styles.icon : "",
    className ?? ""
  ]
    .filter(Boolean)
    .join(" ");

export interface ButtonProps extends SharedProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  busy?: boolean;
  busyLabel?: string;
}

export const Button = ({
  variant,
  size,
  block,
  iconOnly,
  className,
  busy,
  busyLabel,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) => (
  <button
    type={type}
    className={classesFor({ variant, size, block, iconOnly, className })}
    disabled={disabled || busy}
    aria-busy={busy || undefined}
    {...rest}
  >
    {busy ? (
      <>
        <span className={styles.spinner} />
        {busyLabel ?? children}
      </>
    ) : (
      children
    )}
  </button>
);

export interface ButtonLinkProps extends SharedProps {
  href: string;
  prefetch?: boolean;
  target?: string;
  rel?: string;
  "aria-label"?: string;
  onClick?: () => void;
}

export const ButtonLink = ({
  href,
  variant,
  size,
  block,
  iconOnly,
  className,
  children,
  ...rest
}: ButtonLinkProps) => (
  <Link href={href} className={classesFor({ variant, size, block, iconOnly, className })} {...rest}>
    {children}
  </Link>
);
