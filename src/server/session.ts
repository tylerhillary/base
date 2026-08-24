import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { adminAuth } from "./firebase";
import { unauthorized } from "./errors";

/**
 * Server-side auth built on Firebase session cookies.
 *
 * The browser signs in with the Firebase Web SDK and posts the resulting ID
 * token to `/api/auth/session`, which exchanges it for a signed, httpOnly
 * session cookie. From then on the server knows who the caller is on every
 * request — Server Components can render personalised pages directly, and
 * Server Actions derive the acting user from the cookie rather than trusting a
 * uid sent by the client.
 */

export const SESSION_COOKIE = "base0_session";

/** Firebase caps session cookies at 14 days. */
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  uid: string;
  email: string;
  displayName: string;
}

/**
 * The signed-in user, or null.
 *
 * `cache` dedupes this across a single render pass, so a layout, a page and
 * three actions all share one cookie verification instead of five.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;

  if (!session) return null;

  try {
    // `true` also checks the token against revoked/disabled accounts.
    const claims = await adminAuth.verifySessionCookie(session, true);

    return {
      uid: claims.uid,
      email: claims.email ?? "",
      displayName: (claims.name as string | undefined) ?? claims.email?.split("@")[0] ?? "Player"
    };
  } catch {
    // Expired, revoked or tampered-with: treat exactly like being signed out.
    return null;
  }
});

/**
 * For Server Actions: throws, so the action returns a failure result the UI can
 * show as a message rather than a crash.
 */
export const requireUser = async (): Promise<SessionUser> => {
  const user = await getCurrentUser();

  if (!user) {
    throw unauthorized("Sign in to continue");
  }

  return user;
};

/**
 * For pages: redirects instead of throwing.
 *
 * Middleware already turns away visitors with no cookie, but a cookie can be
 * present and still fail verification — revoked, tampered with, or signed for a
 * different project. Rendering an error page for that is wrong; the honest
 * answer is "you are signed out", so send them to sign in.
 */
export const requireUserOrRedirect = async (next?: string): Promise<SessionUser> => {
  const user = await getCurrentUser();

  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }

  return user;
};

export interface MintedSession {
  cookie: string;
  uid: string;
  email: string;
  name: string;
}

/**
 * Verifies an ID token and mints a session cookie from it.
 *
 * The claims are returned alongside the cookie so the caller does not have to
 * verify the same token a second time — each verification is a network call, so
 * doing it once halves the cost of every sign-in.
 */
export const createSessionCookie = async (idToken: string): Promise<MintedSession> => {
  // Verified first so a forged token never reaches cookie minting.
  const claims = await adminAuth.verifyIdToken(idToken);

  const cookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS
  });

  return {
    cookie,
    uid: claims.uid,
    email: claims.email ?? "",
    name: (claims.name as string | undefined) ?? ""
  };
};
