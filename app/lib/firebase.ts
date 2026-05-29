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
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

function handles() {
  return initFirebase({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  });
}

export function firebaseAuth(): Auth {
  return handles().auth;
}

export function firebaseDb(): Firestore {
  return handles().db;
}
