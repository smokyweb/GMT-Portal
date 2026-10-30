# Saved GAN contacts and grantee settings

Status: implemented and verified in isolated QA only. The main production index imports none of this migration/router/guard. This candidate must not be deployed alone. Updated 2026-10-29.

## Client source and behavior

The [GAN specification and token dictionary](https://app.basecamp.com/3102765/buckets/48972825/messages/10334117050#__recording_10349618188) identifies the authorized official as a registered user and the pass-through/approving contacts as grantee settings. Organization Profile now lets the assigned state or ISC administrator choose an active registered recipient official and default state grantee. My Organization shows the saved designations read-only to members. It links the designated official to their profile; administrators can maintain the registered user's title/phone in User Management.

Admin Hub now has a scoped Grantee award settings panel for agency/contact name, title, email and phone, plus a registered same-state/agency portal approver. The registered approver name is canonical and read-only in the form. The GAN-specific approving title can be configured. Explicit print-only name/title remains possible when no portal approver is assigned; no account is invented for that person. These are configuration choices, not a completed signing/countersigning workflow.

The existing profile Save action now uses the existing authenticated PUT /api/auth/me whitelist instead of the administrator-only generic User update endpoint. Only the signed-in user's name/title/phone/department are submitted. Existing roles and organization assignment remain controlled by account management.

## Persistence, access and source resolution

The explicit migrateGanSettings adds nullable organization official/grantee IDs and revision fields, plus grantee contact title and portal approver ID/name/title. It preserves legacy manual contact text and makes no automatic person assignments. No production migration has run. Missing/deactivated/moved people are reported as stale assignments, rather than replaced by another account. No foreign account contact details or credential fields are returned in settings responses.

Owned settings saves validate role/state/agency and registered account membership, take a row lock, compare expectedRevision and write the existing audit log in the same transaction. A failed audit rolls back the settings. Database triggers protect new assignment fields; the generic guard allows unchanged fields in existing full-record editors, strips them, and rejects attempts to bypass the owned workflow. Legacy ISC grantee branding edits preserve the returned revision; contact changes require the current revision. This scoped work is not a complete authorization audit of every legacy organization endpoint.

New GAN contexts resolve saved defaults when explicit draft choices are omitted. Actual resolved IDs, canonical contact fields and settings revisions enter the immutable snapshot. One-draft overrides remain possible without changing organization settings. Bulk catalogs preselect saved officials and a common grantee; plans freeze per-row choices and organization/grantee settings revisions. A later settings edit blocks an old plan with a correction reason. Existing PDF revisions remain unchanged after settings/profile edits. Drafts are still not sent or signed.

## Evidence

- All 168 combined automated checks pass, including 11 settings checks: state/role/member boundaries, registered identities, stale/concurrent saves, inactive/moved people, print-only details, immutable documents, batch revision changes, audit rollback, SQL guards, real HTTP settings/generic compatibility and safe self-profile updates.
- Strict changed-feature Node/browser lint and Node syntax checks pass. Seven changed legacy files add zero lint messages relative to the pre-change checkpoint. New visual files contain 5-24 lines each; state and mapping live in hooks/helpers.
- Frontend build passes. New-feature type diagnostics are zero; global typecheck remains failing with the existing 1917 diagnostics. Added-line whitespace checks pass. All 50 current route entries remain; no routes were added in this settings milestone. This is source parity, not browser QA of every old route.
- Browser QA used synthetic accounts and one owned loopback schema. It saved organization and grantee assignments, checked scoped agency choices and a read-only canonical approver name, confirmed default batch prefill/readiness, saved one ready draft, and downloaded the actual PDF. Download SHA-256 ca1bb1b36e71a505f0c43eeccd15ab5b9b1bf72d2a71102a33f0d90be1706237 matched stored revision 1.
- The member saw disabled designation controls and no save-designation button. Their title/phone update returned HTTP 200 and survived reload without changing role/organization. Administrators and new GAN previews saw the updated contact, while the stored PDF still contained the original contact and kept its hash. Grantee settings at 390px had document width 390px. The actual desktop/mobile panel screenshots were visually inspected.
- Browser and preview process were closed, its schema dropped, and runtime metadata removed. No QA schemas remain. The production user count is still 8; public has no award table, GAN managed fields or settings revision columns. Backend PID 371491 and live asset /assets/index-r8PQloGP.js remain unchanged; live bundle SHA-256 is 5e3d4e5874318808bc75618061bd569b06e9cdfbfdeb77afac60435e9f64e567.

Evidence: .git/gmt-gan-settings-browser-evidence.json, .git/gmt-gan-settings-verification.json, .git/gmt-gan-settings-live-verification.json, .git/gmt-gan-settings-shared-lint-results.json, .git/gmt-combined-gan-settings-tests.log, .git/gmt-gan-settings-strict-lint.log, .git/gmt-typecheck-gan-settings.log and .git/gmt-gan-settings-build.log. Screenshots and PDF paths are recorded in the browser evidence. Existing preview-only ReportSchedule/SystemSettings warnings remain outside this change.

## Activation and remaining work

The migration, /api/gan/settings router, GAN context/draft/batch routers and generic guards remain unmounted in production. The reviewed award startup patch remains unchanged and unapplied. Its pending approval is separate from the already completed source-alignment approval. Automatic approval review rejected startup migration wiring because a later restart could change production data. Do not connect it through another path, restart, or deploy without the applicable approval.

Remaining GAN work: production project entry/import model; Special Conditions and optional Direct Deposit attachments; individual Award Documents integration; preview/send/review/sign/reject; print/upload verification; Assistant Director countersignature; final PDF/Documents/award activation; alerts, email delivery and tracker/Action Items. Template publishing/settings/versions and other document routes also remain. Broader imports, multi-org, POETE/compliance, reimbursement, project transfers/reporting, design comparison and release checks remain in the full 2.0 scope.
