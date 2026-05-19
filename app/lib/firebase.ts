/**
 * Firebase client SDK. Browser-safe (uses only NEXT_PUBLIC_* config).
 *
 * The web `apiKey` looks secret but is treated by Firebase as an identifier —
 * security lives in Firestore rules and Authorized Domains, not in hiding it.
 *
 * Use:
 *   import { firebaseAuth, firebaseDb } from "@/app/lib/firebase";
 *   const user = firebaseAuth().currentUser;
 *   const snap = await getDoc(doc(firebaseDb(), "allowlist", addr));
 *
 * Both helpers are lazy and singleton-safe across hot reloads.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();

  if (!config.apiKey || !config.projectId || !config.appId) {
    throw new Error(
      "Missing Firebase web config. Set NEXT_PUBLIC_FIREBASE_API_KEY / _PROJECT_ID / _APP_ID."
    );
  }

  return initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
    measurementId: config.measurementId,
  });
}

export function firebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function firebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}
