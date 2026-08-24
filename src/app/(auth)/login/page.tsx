"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Callout } from "@/components/ui/primitives";
import { authErrorCode, describeAuthError, useAuth } from "@/components/auth/auth-context";
import { useToast } from "@/providers/toast-provider";
import { AuthShell } from "../auth-shell";
import styles from "../auth.module.css";

/**
 * Where to land after signing in. Read from the URL at submit time rather than
 * with `useSearchParams`, which would force this page behind a Suspense
 * boundary for no benefit. Only same-site paths are honoured.
 */
/** Email carried over from the sign-up page when the account already existed. */
const prefilledEmail = (): string => {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("email") ?? "";
};

const redirectTarget = (): string => {
  if (typeof window === "undefined") return "/";

  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
};

export default function LoginPage() {
  const router = useRouter();
  const { signIn, resetPassword, configured } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  /** Set when no account exists, so we can offer sign-up instead. */
  const [noAccount, setNoAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  /*
   * Adopt ?email= after mount. An effect rather than a useState initialiser,
   * because arriving here from sign-up is a client-side navigation, where the
   * initialiser has already run. Starting empty also keeps hydration clean.
   */
  useEffect(() => {
    const carried = prefilledEmail();
    if (carried) setEmail(carried);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNoAccount(false);
    setLoading(true);

    try {
      await signIn(email, password);

      /*
       * `signIn` only resolves once the server session cookie exists, so this
       * navigation cannot race middleware back to /login. `loading` stays true
       * through the transition rather than flickering back to idle.
       */
      router.replace(redirectTarget());
      router.refresh();
    } catch (cause) {
      setError(describeAuthError(cause));
      setNoAccount(authErrorCode(cause) === "auth/user-not-found");
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      setError("Enter your email first, then request a reset link.");
      return;
    }

    setResetting(true);
    try {
      await resetPassword(email);
      toast.success("Reset link sent", `Check ${email.trim()} for a password reset email.`);
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setResetting(false);
    }
  };

  return (
    <AuthShell
      headline={
        <>
          Your next game
          <br />
          <span className={styles.showcaseAccent}>is already on the board.</span>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formHead}>
          <h1 className={styles.formTitle}>Welcome back</h1>
          <p className={styles.formSub}>Sign in to vote, join rosters and message your teams.</p>
        </div>

        {!configured ? (
          <Callout tone="warn">
            Firebase is not configured. Add your keys to <code>.env.local</code> and
            restart the dev server.
          </Callout>
        ) : null}

        {error ? (
          <Callout tone={noAccount ? "warn" : "danger"}>
            {error}
            {noAccount ? (
              <>
                {" "}
                <Link
                  href={`/signup?email=${encodeURIComponent(email.trim())}`}
                  className={styles.calloutLink}
                >
                  Create an account instead
                  <Icon name="arrowRight" size={13} strokeWidth={2.6} />
                </Link>
              </>
            ) : null}
          </Callout>
        ) : null}

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="player@example.com"
          autoComplete="email"
          icon="mail"
          autoFocus
          required
        />

        <PasswordField
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your password"
          autoComplete="current-password"
          required
        />

        <button
          type="button"
          className={styles.inlineLink}
          onClick={handleReset}
          disabled={resetting}
        >
          {resetting ? "Sending reset link…" : "Forgot your password?"}
        </button>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          busy={loading}
          busyLabel="Signing in…"
          disabled={!configured}
        >
          <Icon name="logIn" size={18} />
          Sign in
        </Button>

        <p className={styles.divider}>New here?</p>

        <p className={styles.switch}>
          <Link href="/signup" className={styles.switchLink}>
            Create an account
            <Icon name="arrowRight" size={14} strokeWidth={2.4} />
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
