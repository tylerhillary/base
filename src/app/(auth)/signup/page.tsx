"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Callout } from "@/components/ui/primitives";
import { authErrorCode, describeAuthError, useAuth } from "@/components/auth/auth-context";
import { AuthShell } from "../auth-shell";
import styles from "../auth.module.css";

const STRENGTH_LABELS = ["Too short", "Weak", "Decent", "Strong"] as const;

/**
 * Where to land after signing in. Read from the URL at submit time rather than
 * with `useSearchParams`, which would force this page behind a Suspense
 * boundary for no benefit. Only same-site paths are honoured.
 */
/** Email carried over from the login page when no account existed. */
const prefilledEmail = (): string => {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("email") ?? "";
};

const redirectTarget = (): string => {
  if (typeof window === "undefined") return "/";

  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
};

/** Rough 0–3 score: length first, then variety. */
const scorePassword = (value: string): number => {
  if (value.length < 6) return 0;

  let score = 1;
  if (value.length >= 10) score += 1;
  if (/[^a-zA-Z]/.test(value) && /[a-zA-Z]/.test(value)) score += 1;

  return Math.min(3, score);
};

export default function SignupPage() {
  const router = useRouter();
  const { signUp, configured } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  /** Set when the email is already registered, so we can offer a way forward. */
  const [emailTaken, setEmailTaken] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);
  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;

  /*
   * Adopt ?email= after mount. An effect rather than a useState initialiser,
   * because arriving here from login is a client-side navigation, where the
   * initialiser has already run. Starting empty also keeps hydration clean.
   */
  useEffect(() => {
    const carried = prefilledEmail();
    if (carried) setEmail(carried);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setEmailTaken(false);

    if (displayName.trim().length < 2) {
      setError("Tell us what to call you — at least two characters.");
      return;
    }

    if (password.length < 6) {
      setError("Passwords need at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Those passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, displayName);

      /*
       * `signUp` only resolves once the server session cookie exists, so this
       * navigation cannot race middleware back to /login. `loading` stays true
       * through the transition — the button should not flicker back to idle
       * while the next page is being fetched.
       */
      router.replace(redirectTarget());
      router.refresh();
    } catch (cause) {
      setError(describeAuthError(cause));
      setEmailTaken(authErrorCode(cause) === "auth/email-already-in-use");
      setLoading(false);
    }
  };

  return (
    <AuthShell
      headline={
        <>
          Stop chasing the group chat.
          <br />
          <span className={styles.showcaseAccent}>Start playing.</span>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formHead}>
          <h1 className={styles.formTitle}>Create your account</h1>
          <p className={styles.formSub}>Free, takes a minute, and no app to install.</p>
        </div>

        {!configured ? (
          <Callout tone="warn">
            Firebase is not configured. Add your keys to <code>.env.local</code> and restart the
            dev server.
          </Callout>
        ) : null}

        {error ? (
          <Callout tone={emailTaken ? "warn" : "danger"}>
            {error}
            {emailTaken ? (
              <>
                {" "}
                <Link
                  href={`/login?email=${encodeURIComponent(email.trim())}`}
                  className={styles.calloutLink}
                >
                  Sign in as {email.trim()}
                  <Icon name="arrowRight" size={13} strokeWidth={2.6} />
                </Link>
              </>
            ) : null}
          </Callout>
        ) : null}

        <TextField
          label="Your name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Taylor Adams"
          autoComplete="name"
          autoFocus
          icon="user"
          hint="Shown on every roster you join"
          required
        />

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="player@example.com"
          autoComplete="email"
          icon="mail"
          required
        />

        <PasswordField
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 6 characters"
          autoComplete="new-password"
          minLength={6}
          required
        >
          {password ? (
            <div className={styles.strengthWrap}>
              <div className={styles.strength} aria-hidden="true">
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={`${styles.strengthBar} ${
                      index <= strength ? styles[`strengthOn${strength}`] : ""
                    }`}
                  />
                ))}
              </div>
              {/* Announced politely so it does not interrupt typing. */}
              <p className={styles.strengthLabel} aria-live="polite">
                {STRENGTH_LABELS[strength]}
              </p>
            </div>
          ) : null}
        </PasswordField>

        <PasswordField
          label="Confirm password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Type it once more"
          autoComplete="new-password"
          error={mismatch ? "Passwords do not match" : undefined}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          busy={loading}
          busyLabel="Creating account…"
          disabled={!configured}
        >
          <Icon name="userPlus" size={18} />
          Create account
        </Button>

        <p className={styles.divider}>Already playing?</p>

        <p className={styles.switch}>
          <Link href="/login" className={styles.switchLink}>
            Sign in instead
            <Icon name="arrowRight" size={14} strokeWidth={2.4} />
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
