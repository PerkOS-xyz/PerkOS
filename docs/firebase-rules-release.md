# Firebase rules release

This patch restores intended client authorization boundaries independently of
the Solana rollout. A Next.js deployment does not deploy Firebase rules.

## Before production

1. Use a valid, non-exposed CLI session. Never print account objects, OAuth
   tokens, credential files, or authentication JSON in logs or PRs.
2. Explicitly select project `perkos-app`; do not rely on the default alias.
3. Read the active Firestore release and its ruleset using the Firebase Rules
   API. Save the release name, ruleset name, source, timestamp and source hash
   in a restricted operational backup, not in a public repository.
4. Compare that source with this patch's base. Stop on unexplained drift and
   preserve unrelated production restrictions. Local repository tests do not
   prove which rules are currently deployed or establish past misuse.
5. Run `npm run test:rules` against the reconciled candidate using Node 22 and
   Java 17. The command uses only loopback emulators and a fixed demo project.
6. Obtain release review/approval for the exact candidate. Do not bundle login
   flags, indexes, data migrations, account changes, or agent operations.

## Release and verify

With the reviewed source in the release checkout, deploy only Firestore rules:

```sh
npx --yes --package=firebase-tools@13.35.1 firebase deploy --only firestore:rules --project perkos-app
```

Read the active release again, compare its source/hash with the approved
candidate, and record the release metadata. Verify ordinary owner and member
flows without attempting real balance, receipt, or private-message mutations.
Authorization-denial tests belong in the emulator, not in customer records.
Do not report production protected until this verification succeeds.

Storage behavior is unchanged by this patch, so no Storage deploy is required.
Storage download-token URLs remain bearer capabilities; these tests cover SDK
authorization and do not revoke already shared download links.

## Recovery

If a legitimate client flow fails, diagnose the denied path and release a
reviewed narrow correction. Do not restore the permissive owner wildcard as a
Solana rollback. Admin SDK writes bypass client rules and need separate server
authorization. Disabling an API login flag does not revoke issued Firebase
tokens. Keep the previous release backup for comparison and controlled recovery,
not as an instruction to weaken billing or private-chat boundaries.
