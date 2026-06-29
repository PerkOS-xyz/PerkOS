/**
 * Firebase client SDK shim — delegates to `@perkos/shared-client`.
 *
 * Phase 1.1 of the platform-extraction migration moved the lazy-init Firebase
 * helpers into the shared package. This file keeps App's existing call sites
 * (`firebaseAuth()`, `firebaseDb()`) unchanged by adapting the shared
 * `initFirebase` cache to the same getter shape.
 *
 * The browser-only `NEXT_PUBLIC_*` config still lives here — the shared
 * package is config-agnostic by design so it can also be used from Vite,
 * CLI tools, and Tauri.
 */
import { initFirebase } from "@perkos/shared-client";
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/**
 * Initialize Firestore with auto-detect long-polling BEFORE anything calls
 * `getFirestore(app)`.
 *
 * Why: the default WebChannel transport spams the console with benign 400s on
 * `…/Listen/channel?…&RID=rpc…` — stream teardown + listener re-handshake when
 * the Firebase auth token settles at sign-in, made worse by browser extensions
 * interfering with the streaming transport. Auto-detect long-polling avoids them.
 *
 * `initializeFirestore` must run before the first `getFirestore` for the app.
 * The shared-client's `initFirebase` creates the (getApps-guarded) default app
 * and then calls `getFirestore(app)`. We pre-create that same default app here
 * and configure Firestore, so when `initFirebase` runs it reuses our app and
 * `getFirestore` returns this long-polling instance. Call this as early as
 * possible on the client — the root <Providers> invokes it via a useState
 * lazy-init, which runs before any descendant's useFirebaseUser.
 */
let firestorePrepared = false;
export function prepareFirestore(): void {
  if (firestorePrepared || typeof window === "undefined") return;
  firestorePrepared = true;
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  try {
    initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    // Already initialized (HMR, or a getFirestore beat us to it) — keep the
    // existing instance; we just don't get long-polling this run.
  }
}

function handles() {
  prepareFirestore();
  return initFirebase(firebaseConfig);
}

export function firebaseAuth(): Auth {
  return handles().auth;
}

export function firebaseDb(): Firestore {
  return handles().db;
}

export function firebaseStorage(): FirebaseStorage {
  return getStorage(handles().app);
}
