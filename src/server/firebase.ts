import "server-only";

import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type CollectionReference, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin, initialised lazily on first use.
 *
 * Nothing here runs at import time. That matters because `next build` imports
 * every route to collect page data, and a build machine has no reason to hold
 * production credentials — a module-level throw would fail the build rather
 * than the request that actually needed Firestore.
 *
 * `server-only` makes importing this from a Client Component a build error, so
 * the service-account credentials can never reach a browser bundle.
 */

interface AdminHandles {
  app: App;
  db: Firestore;
  auth: Auth;
}

let handles: AdminHandles | null = null;

const initialise = (): AdminHandles => {
  if (handles) return handles;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId) {
    throw new Error(
      "FIREBASE_PROJECT_ID is not set. Copy .env.example to .env.local for local development, " +
        "or add the Firebase environment variables to your hosting provider."
    );
  }

  const createApp = (): App => {
    // Next re-evaluates modules on hot reload; never initialise twice.
    const [existing] = getApps();
    if (existing) return existing;

    if (process.env.FIRESTORE_EMULATOR_HOST) {
      return initializeApp({ projectId });
    }

    if (clientEmail && privateKey) {
      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          // Keys are stored with escaped newlines so they survive a .env line.
          privateKey: privateKey.replace(/\\n/g, "\n")
        })
      });
    }

    // Falls back to GOOGLE_APPLICATION_CREDENTIALS / workload identity.
    return initializeApp({ credential: applicationDefault(), projectId });
  };

  const app = createApp();
  handles = { app, db: getFirestore(app), auth: getAuth(app) };

  return handles;
};

export const getDb = (): Firestore => initialise().db;
export const getAdminAuth = (): Auth => initialise().auth;
export const getFirebaseApp = (): App => initialise().app;

/**
 * Top-level collections.
 *
 * Getters rather than plain values, so touching `collections` from a module
 * body does not trigger initialisation — only actually reading one does.
 */
export const collections = {
  get games(): CollectionReference {
    return getDb().collection("games");
  },
  get users(): CollectionReference {
    return getDb().collection("users");
  },
  get notifications(): CollectionReference {
    return getDb().collection("notifications");
  }
};

export const participantsOf = (gameId: string) =>
  collections.games.doc(gameId).collection("participants");

export const votesOf = (gameId: string) => collections.games.doc(gameId).collection("votes");

export const chatOf = (gameId: string) => collections.games.doc(gameId).collection("chat");
