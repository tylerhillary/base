import { NextResponse, type NextRequest } from "next/server";

/**
 * Route protection at the edge.
 *
 * The Firebase Admin SDK cannot run in the Edge runtime, so this cannot verify
 * a session cookie's *signature*. What it can do is reject cookies that are
 * obviously unusable — malformed, or past their own expiry — which covers the
 * everyday case of a session that simply aged out. Anything that survives here
 * is still verified properly by `getCurrentUser()` before it can read data.
 */

const SESSION_COOKIE = "base0_session";

/** Reachable without an account. */
const PUBLIC_ROUTES = new Set(["/login", "/signup"]);

/**
 * Reads `exp` out of a JWT payload without verifying it.
 * Returns false for anything that is not a well-formed, unexpired token.
 */
const looksUsable = (token: string): boolean => {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    // base64url -> base64, then decode. `atob` is available in the Edge runtime.
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")));

    if (typeof claims.exp !== "number") return false;

    return claims.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

/** Sends the visitor to sign in and drops the unusable cookie on the way out. */
const toLogin = (request: NextRequest, clearCookie: boolean) => {
  const { pathname, search } = request.nextUrl;
  const url = request.nextUrl.clone();

  url.pathname = "/login";
  url.search = "";

  // Remember where they were headed so sign-in can complete the journey.
  if (pathname !== "/") {
    url.searchParams.set("next", `${pathname}${search}`);
  }

  const response = NextResponse.redirect(url);

  if (clearCookie) {
    response.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  }

  return response;
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const isPublic = PUBLIC_ROUTES.has(pathname);
  const hasUsableSession = Boolean(token) && looksUsable(token);

  if (!hasUsableSession) {
    // A present-but-dead cookie is cleared so the browser stops sending it.
    if (!isPublic) return toLogin(request, Boolean(token));

    if (token) {
      const response = NextResponse.next();
      response.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
      return response;
    }

    return NextResponse.next();
  }

  if (isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Everything except Next internals, the auth endpoint (which must be callable
   * while signed out to create the session) and static assets.
   */
  matcher: [
    "/((?!_next/static|_next/image|api/auth|favicon.ico|img/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
};
