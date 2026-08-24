import { NextResponse } from "next/server";

import { ensureUserProfile } from "@/server/users";
import { createSessionCookie, SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/server/session";

/**
 * Exchanges a Firebase ID token for an httpOnly session cookie.
 *
 * This is the one place the browser's Firebase credential crosses to the
 * server. Afterwards every Server Component and Server Action reads the user
 * from the cookie, so no uid is ever taken from the client.
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
  let idToken: string;
  let displayName = "";

  try {
    const body = (await request.json()) as { idToken?: unknown; displayName?: unknown };

    if (typeof body.idToken !== "string" || !body.idToken) {
      return NextResponse.json({ message: "Missing ID token" }, { status: 400 });
    }

    idToken = body.idToken;
    displayName = typeof body.displayName === "string" ? body.displayName : "";
  } catch {
    return NextResponse.json({ message: "Malformed request" }, { status: 400 });
  }

  try {
    // One verification, which also hands back the claims.
    const { cookie, uid, email, name } = await createSessionCookie(idToken);

    // First sign-in creates the Firestore profile that the rest of the app reads.
    await ensureUserProfile(uid, {
      displayName: displayName || name || email.split("@")[0] || "Player",
      email
    }).catch((error) => {
      // A profile hiccup must not block sign-in; the profile page heals it later.
      console.error("[auth] could not ensure profile", error);
    });

    const response = NextResponse.json({ ok: true });

    response.cookies.set({
      name: SESSION_COOKIE,
      value: cookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000
    });

    return response;
  } catch (error) {
    /*
     * Firebase surfaces the useful detail in `code` (expired token, wrong
     * project, clock skew). Log it so a failed sign-in is diagnosable, but keep
     * the response generic.
     */
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    console.error(`[auth] session creation failed${code ? ` (${code})` : ""}`, error);

    return NextResponse.json({ message: "Could not start a session" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return response;
}
