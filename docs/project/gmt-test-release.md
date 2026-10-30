# GMT test release and source of truth

GMT TEST: https://gmt.bluesapps.com. Customer LIVE: https://odysseus-gap.com. Publishing source here does not constitute a customer production deployment.

## Current implementation

The October 30, 2026 GMT test implementation includes scoped accounts/resets/user CSV import; configurable versioned NOFO applications/defaults; Award Details and application synchronization; EHP safeguards; GAN readiness/bulk drafts/private packages; recipient electronic signing/rejection; private signed uploads, correction/resubmission and NEMA verification.

Assistant Director countersignature, final execution/Documents/automatic activation, actual notification delivery, Action Items/tracker, full ISC award/budget imports and other client acceptance work remain unfinished. Read the scope and implementation notes under docs/project for details. Earlier notes saying GAN startup is unmounted describe a historical staged state: the GMT test runtime was activated on October 30. They do not describe an Odysseus deployment.

## Avoid the frontend regression

A later template-manager release replaced GMT test's served frontend with an older implementation even though the newer source and backend remained intact. The missing account/application/GAN features were restored by switching back to the verified build, without a database rollback or backend restart.

Use this repository's current reviewed source when preparing a release. Do not deploy artifacts built from an old checkout or unrelated temporary source tree. Include required backend route/migration wiring with a frontend that depends on it. Do not use a successful HTTP 200 or an index filename alone as proof of the release.

The restored test artifact was /assets/index-Z6cQrBVE.js, SHA-256 5dfd5eeef3155b0fbe8ebc4350ec32751e5fb4b4ac331e297c531154e99d62b9. These are release observations, not hardcoded requirements for every future valid build. Subsequent releases must record their own artifact identity.

Before switching an index, check the candidate contains the intended account/form/GAN UI and routes, including /reset-password, /change-password and /award-documents/:id. Publish referenced assets first, retain previous hashed assets for open clients, switch the index atomically, then fetch and hash the actual served bundle from the canonical test domain.

## Build and verify from source

Use the Node version supported by the current package lock and project dependencies. The October 30 build ran on Node 24.

    npm ci
    npm run build -- --outDir .git/gmt-candidate-dist

The build prepares the pinned pdfjs-dist support files in public/pdfjs/6.4.299 before Vite runs. Those generated dependency assets are intentionally ignored; the worker itself is imported by Vite. Do not omit this step when building from a fresh checkout, and update both the asset preparation version and viewer URLs when upgrading pdfjs-dist.

For backend development, install server/package-lock.json dependencies in server and provide the approved environment configuration securely. Never publish actual .env files or initialize/reset the active database.

The combined isolated test command is:

    cd server
    node --test --test-concurrency=1 tests/*.test.mjs

Inspect the test schema setup first and use only owned isolated schemas/fixtures. Before this release, 220 combined checks passed; the project-wide typecheck still had existing diagnostics and was not globally passing.

## Runtime and rollback

server/services/documents/ganRuntime.js mounts the GAN routes and guards. Its one-time transactional migration uses gmt_runtime_migrations entry gan-runtime-v1. Do not remove that ledger or call earlier GAN migrations individually on an upgraded schema: an older draft migration narrows states that signed uploads later extend.

Checkpoint source before edits and preserve current served assets before deployment. Back up the database before data changes; rehearse upgrade/restart behavior in isolation. Keep backups and runtime evidence private and local to the authorized project. Preserve unrelated work and concurrent legitimate data writes during rollback.

The test frontend restoration did not change the customer production server, root folders, shared services, database records or the GMT backend process. Authenticate browser checks normally with an approved test account. Routine QA must not perform real approvals/signatures/payments or send real notifications.
