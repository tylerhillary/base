"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser
} from "firebase/auth";

import { auth, firebaseConfigured } from "@/lib/firebase/client";

/**
 * Bridges Firebase's browser-side auth to the server's session cookie.
 *
 * Firebase issues credentials in the browser; the server needs to know who is
 * calling. Whenever the ID token changes we hand it to `/api/auth/session`,
 * which verifies it and sets an httpOnly cookie. From then on every Server
 * Component and Server Action reads the user from that cookie.
 *
 * `user` here is the *server-verified* identity passed down from the root
 * layout, so the first paint already knows who is signed in — no auth flash,
 * no loading spinner over the whole app.
 */

export interface SessionUser {
  uid: string;
  email: string;
  displayName: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  /** False when Firebase env vars are missing — the UI explains instead of failing silently. */
  configured: boolean;
  /** True while a sign-in/sign-up round trip is in flight. */
  pending: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Firebase error codes are not something a player should ever have to read. */
const FRIENDLY_ERRORS: Record<string, string> = {
  "auth/invalid-email": "That email address does not look right.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/user-not-found": "No account exists for that email.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/email-already-in-use": "An account already exists with that email.",
  "auth/weak-password": "Choose a password with at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "Network problem — check your connection and retry.",
  "auth/operation-not-allowed": "Email sign-in is not enabled for this project."
};

export const authErrorCode = (error: unknown): string =>
  typeof error === "object" && error && "code" in error ? String(error.code) : "";

export const describeAuthError = (error: unknown): string => {
  const code = authErrorCode(error);
  if (code && FRIENDLY_ERRORS[code]) return FRIENDLY_ERRORS[code];
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
};

const requireAuth = () => {
  if (!auth) {
    throw new Error(
      "Authentication is not configured. Add your Firebase keys to .env.local and restart."
    );
  }
  return auth;
};

interface AuthProviderProps {
  children: ReactNode;
  /** Verified server-side from the session cookie. */
  initialUser: SessionUser | null;
}

export const AuthProvider = ({ children, initialUser }: AuthProviderProps) => {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [pending, setPending] = useState(false);

  // The server is authoritative: adopt whatever a re-render tells us.
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  /** Tracks the token we last exchanged, so refreshes do not re-post needlessly. */
  const lastToken = useRef<string | null>(null);

  /**
   * Trades a Firebase credential for the server session cookie.
   *
   * Sign-in and sign-up await this before they resolve, so by the time a caller
   * navigates, the cookie already exists and middleware will not bounce them
   * straight back to /login. The listener below only handles later refreshes.
   */
  const establishSession = useCallback(async (firebaseUser: FirebaseUser, name?: string) => {
    // `true` forces a refresh so a display name set moments ago is in the token.
    const idToken = await firebaseUser.getIdToken(true);
    lastToken.current = idToken;

    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, displayName: name ?? firebaseUser.displayName ?? "" })
    });

    if (!response.ok) {
      throw new Error("Signed in, but the session could not be started. Please try again.");
    }

    setUser({
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? "",
      displayName: name || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Player"
    });
  }, []);

  useEffect(() => {
    if (!auth) return;

    return onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        lastToken.current = null;
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();

        // Sign-in and sign-up already exchanged this one; only refreshes get here.
        if (idToken === lastToken.current) return;

        await establishSession(firebaseUser);
        router.refresh();
      } catch {
        // Offline or blocked: the user simply stays signed out server-side.
      }
    });
  }, [router, establishSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setPending(true);
      try {
        const credential = await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
        await establishSession(credential.user);
      } finally {
        setPending(false);
      }
    },
    [establishSession]
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      setPending(true);
      try {
        const credential = await createUserWithEmailAndPassword(
          requireAuth(),
          email.trim(),
          password
        );
        const name = displayName.trim();

        // Set the name before minting the session so the Firestore profile the
        // session route creates carries it from the very first write.
        if (name) {
          await updateProfile(credential.user, { displayName: name });
        }

        await establishSession(credential.user, name);
      } finally {
        setPending(false);
      }
    },
    [establishSession]
  );

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(requireAuth(), email.trim());
  }, []);

  const logout = useCallback(async () => {
    lastToken.current = null;
    await signOut(requireAuth()).catch(() => undefined);
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);

    setUser(null);
    // Middleware sends them to /login once the cookie is gone.
    router.replace("/login");
    router.refresh();
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      configured: firebaseConfigured,
      pending,
      signIn,
      signUp,
      resetPassword,
      logout
    }),
    [user, pending, signIn, signUp, resetPassword, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
};
