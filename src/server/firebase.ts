import "server-only";

import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Firebase Admin, initialised once per server process.
 *
 * `server-only` makes importing this from a Client Component a build error, so
 * the service-account credentials can never be pulled into a browser bundle.
 */

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId) {
  throw new Error(
    "FIREBASE_PROJECT_ID is missing. Copy .env.example to .env.local and fill in your Firebase project details."
  );
}

const createApp = (): App => {
  // Next.js re-evaluates modules on hot reload; never initialise twice.
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

export const firebaseApp = createApp();
export const db = getFirestore(firebaseApp);
export const adminAuth = getAuth(firebaseApp);

export const collections = {
  games: db.collection("games"),
  users: db.collection("users"),
  notifications: db.collection("notifications")
} as const;

export const participantsOf = (gameId: string) =>
  collections.games.doc(gameId).collection("participants");

export const votesOf = (gameId: string) => collections.games.doc(gameId).collection("votes");

export const chatOf = (gameId: string) => collections.games.doc(gameId).collection("chat");
