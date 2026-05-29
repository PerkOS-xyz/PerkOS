"use client";

/**
 * Thin wrapper over `@perkos/shared-client/hooks#useFirebaseUser` that
 * supplies App's Firebase Auth instance so call sites stay arg-less.
 */
import { useFirebaseUser as sharedUseFirebaseUser } from "@perkos/shared-client/hooks";

import { firebaseAuth } from "./firebase";

export function useFirebaseUser() {
  return sharedUseFirebaseUser(firebaseAuth());
}
