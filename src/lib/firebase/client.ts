import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

/**
 * Every export here is nullable on purpose: a missing or malformed Firebase
 * config must degrade to "auth unavailable", never crash the module graph and
 * take the whole app down with it.
 */
let app: FirebaseApp | null = null;

if (firebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  } catch (error) {
    console.error("Firebase failed to initialise", error);
    app = null;
  }
}

const safely = <T>(factory: (instance: FirebaseApp) => T): T | null => {
  if (!app) return null;

  try {
    return factory(app);
  } catch (error) {
    console.error("Firebase service failed to initialise", error);
    return null;
  }
};

export const firebaseApp = app;
export const auth: Auth | null = safely(getAuth);
export const db: Firestore | null = safely(getFirestore);
