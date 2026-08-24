"use client";

import { useId, useState, type KeyboardEvent } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";

import { Icon, type IconName } from "./icon";
import styles from "./field.module.css";

const cx = (...values: Array<string | false | undefined>) => values.filter(Boolean).join(" ");

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  full?: boolean;
  counter?: string;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/**
 * Wraps a control with its label, hint, counter and error message, and wires up
 * the aria relationships between them.
 */
export const Field = ({
  label,
  hint,
  error,
  optional,
  full,
  counter,
  className,
  children
}: FieldShellProps) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx(styles.field, full && styles.full, className)}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {optional ? <span className={styles.optional}>optional</span> : null}
      </label>

      {children({ id, describedBy, invalid: Boolean(error) })}

      {hint || counter || error ? (
        <div className={styles.footer}>
          {error ? (
            <span className={styles.error} id={errorId}>
              <Icon name="warning" size={13} strokeWidth={2.2} />
              {error}
            </span>
          ) : hint ? (
            <span className={styles.hint} id={hintId}>
              {hint}
            </span>
          ) : null}
          {counter ? <span className={styles.counter}>{counter}</span> : null}
        </div>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ Input */

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  full?: boolean;
  icon?: IconName;
}

export const TextField = ({ label, hint, error, optional, full, icon, ...rest }: TextFieldProps) => (
  <Field label={label} hint={hint} error={error} optional={optional} full={full}>
    {({ id, describedBy, invalid }) => (
      <span className={styles.shell}>
        {icon ? <Icon name={icon} size={16} className={styles.icon} /> : null}
        <input
          id={id}
          className={cx(styles.control, icon && styles.withIcon)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          {...rest}
        />
      </span>
    )}
  </Field>
);

/* --------------------------------------------------------------- Password */

interface PasswordFieldProps extends Omit<TextFieldProps, "type" | "icon"> {
  /** Rendered under the field — used for the sign-up strength meter. */
  children?: ReactNode;
}

/**
 * A password input people can actually use.
 *
 * Two things cause most failed sign-ins: typos you cannot see, and Caps Lock.
 * So the value can be revealed, and Caps Lock is called out the moment it
 * matters rather than after a rejected attempt.
 */
export const PasswordField = ({ label, hint, error, full, children, ...rest }: PasswordFieldProps) => {
  const [revealed, setRevealed] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const trackCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    // getModifierState is unavailable on some synthetic events; treat as "off".
    setCapsLock(event.getModifierState?.("CapsLock") ?? false);
  };

  return (
    <Field
      label={label}
      hint={hint}
      error={error ?? (capsLock ? "Caps Lock is on" : undefined)}
      full={full}
    >
      {({ id, describedBy, invalid }) => (
        <>
          <span className={styles.shell}>
            <Icon name="lock" size={16} className={styles.icon} />
            <input
              id={id}
              type={revealed ? "text" : "password"}
              className={cx(styles.control, styles.withIcon, styles.withAction)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              onKeyUp={trackCapsLock}
              onKeyDown={trackCapsLock}
              onBlur={() => setCapsLock(false)}
              {...rest}
            />
            <button
              type="button"
              className={styles.reveal}
              onClick={() => setRevealed((current) => !current)}
              // The control is optional sugar; its state is announced, not its icon.
              aria-label={revealed ? "Hide password" : "Show password"}
              aria-pressed={revealed}
              tabIndex={-1}
            >
              <Icon name={revealed ? "eyeOff" : "eye"} size={16} />
            </button>
          </span>
          {children}
        </>
      )}
    </Field>
  );
};

/* --------------------------------------------------------------- Textarea */

interface TextAreaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className"> {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  full?: boolean;
  showCounter?: boolean;
}

export const TextAreaField = ({
  label,
  hint,
  error,
  optional,
  full = true,
  showCounter,
  maxLength,
  value,
  ...rest
}: TextAreaFieldProps) => {
  const length = typeof value === "string" ? value.length : 0;

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      full={full}
      counter={showCounter && maxLength ? `${length}/${maxLength}` : undefined}
    >
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          className={cx(styles.control, styles.textarea)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          maxLength={maxLength}
          value={value}
          {...rest}
        />
      )}
    </Field>
  );
};

/* ----------------------------------------------------------------- Select */

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className"> {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  full?: boolean;
  children: ReactNode;
}

export const SelectField = ({
  label,
  hint,
  error,
  optional,
  full,
  children,
  ...rest
}: SelectFieldProps) => (
  <Field label={label} hint={hint} error={error} optional={optional} full={full}>
    {({ id, describedBy, invalid }) => (
      <span className={styles.shell}>
        <select
          id={id}
          className={cx(styles.control, styles.select)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          {...rest}
        >
          {children}
        </select>
        <Icon name="chevronDown" size={16} className={styles.selectChevron} />
      </span>
    )}
  </Field>
);

/* ------------------------------------------------------------ Chip picker */

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  tint?: string;
  icon?: ReactNode;
}

interface ChipGroupProps<T extends string> {
  options: ReadonlyArray<ChipOption<T>>;
  selected: readonly T[];
  onToggle: (value: T) => void;
  label?: string;
  className?: string;
}

export const ChipGroup = <T extends string>({
  options,
  selected,
  onToggle,
  label,
  className
}: ChipGroupProps<T>) => (
  <div className={cx(styles.chips, className)} role="group" aria-label={label}>
    {options.map((option) => {
      const isSelected = selected.includes(option.value);

      return (
        <button
          key={option.value}
          type="button"
          className={cx(styles.chip, isSelected && styles.chipSelected)}
          style={option.tint ? { ["--chip-tint" as string]: option.tint } : undefined}
          aria-pressed={isSelected}
          onClick={() => onToggle(option.value)}
        >
          {isSelected ? (
            <Icon name="check" size={13} strokeWidth={2.6} className={styles.chipCheck} />
          ) : (
            option.icon
          )}
          {option.label}
        </button>
      );
    })}
  </div>
);

/* ------------------------------------------------------ Segmented control */

interface SegmentedProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string; icon?: IconName }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

export const Segmented = <T extends string>({
  options,
  value,
  onChange,
  label,
  className
}: SegmentedProps<T>) => (
  <div className={cx(styles.segmented, className)} role="tablist" aria-label={label}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="tab"
        aria-selected={option.value === value}
        className={cx(styles.segment, option.value === value && styles.segmentActive)}
        onClick={() => onChange(option.value)}
      >
        {option.icon ? <Icon name={option.icon} size={15} /> : null}
        {option.label}
      </button>
    ))}
  </div>
);
