"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";

import { firebaseAuth } from "./firebase";

type FirebaseUserState = {
  user: User | null;
  loading: boolean;
};

/**
 * Subscribe to Firebase auth state. `loading` is `true` until the first
 * `onAuthStateChanged` callback fires — useful for guarded routes that
 * shouldn't redirect before we know if there's a persisted session.
 */
export function useFirebaseUser(): FirebaseUserState {
  const [state, setState] = useState<FirebaseUserState>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth(), (user) => {
      setState({ user, loading: false });
    });
  }, []);

  return state;
}
