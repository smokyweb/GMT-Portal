# GAN Preview/Send and Review/Sign screens

Status: implemented and verified in isolated QA on the GMT server. Not activated or deployed. Updated 2026-10-29 America/New_York.

## Resources and scope

The client's [GAN routing specification and mockups](https://app.basecamp.com/3102765/buckets/48972825/messages/10334117050#__recording_10349618188) define Preview & Send (1-B) and Review & Sign (1-D). Both images were inspected. The approved admin and recipient Figma files were checked using native design context/screenshots. Their Award Documents navigation references were available; no separate editable Preview/Send or Review/Sign frame was found in the inspected files. This implementation follows the Basecamp composition within GMT's existing shell. It is not a claim of complete Figma parity.

New visual pieces are isolated files below 150 lines. Request state, validation, formatting, PDF work and source checks are in hooks, clients or services. Only the GAN workflow, its route/navigation, package integration and isolated QA fixture changed. A full source checkpoint preceded edits. Source/package lock files and unrelated dirty work were preserved.

## Implemented behavior

Administrators can review the latest saved package beside the token/source check and registered recipient. Readiness uses a read-only, repeatable-read transaction and the same validation used inside issuance. Missing fields, changed sources, inactive recipients, old packages and scope failures block sending. The PDF must actually render before the review acknowledgement can be checked. Sending rechecks the sources and records the immutable issued version. The issued-award link reloads correctly even when already on its detail URL.

Award Documents now has a private issued-award catalog for assigned administrators and the named recipient. The new /award-documents/:id route shows full application, subaward and project IDs, actual authenticated PDF pages/downloads and immutable activity. Administrator draft detail opens the existing package editor. The recipient navigation includes Award Documents. Other legacy routes remain.

The first authorized recipient PDF request records Reviewed, then the hook refreshes the workflow revision before enabling action controls. The browser checks PDF bytes against the server SHA-256 header before rendering. Missing, failed or corrupted PDFs leave signing/rejection disabled. Cross-document asynchronous results cannot replace the current route's state.

The recipient enters the printed registered name and a title, then explicitly checks all three server consent statements. None are preselected. Blank fields, wrong names or missing consent produce visible errors. Stable request IDs preserve safe retries of the same action. A successful signature loads the recipient-signed PDF including its evidence page and removes further signing controls. The screen and catalog state that NEMA verification/countersignature is pending; fullyExecuted remains false.

Rejection requires a note and retains it in activity. A regenerated/reissued package gets a fresh issue and unchecked consent controls while the prior rejection remains visible. The browser regeneration fixture used owned backend services; an individual application regeneration UI is not claimed. Upload-only templates explicitly explain that the upload/verification screen is still pending.

Email delivery is never labeled delivered. Alerts and pending delivery requests are retained by the backend; no provider dispatch occurred.

## Verification

- 201 combined automated checks pass, including read-only readiness and exact recipient/admin catalog access, plus 21 focused workflow checks on the final backend source.
- Scoped strict frontend/server lint, changed-line whitespace and candidate build pass. All 50 previous registered routes remain; the detail route brings the count to 51.
- Global typecheck still has the 1917 existing diagnostics, with zero in this feature. It is not a globally passing typecheck.
- Headless Chromium exercised admin Preview/Send, real three-page PDF navigation, recipient catalog/nav, first-open Reviewed, blank/wrong-name/missing-consent errors, unchecked consent, signing and a real four-page download.
- Rejection required a note; regeneration/reissue preserved prior history; the reissued GAN was signed through the current candidate UI.
- Blocked network PDF requests and deliberately corrupted synthetic bytes prevented signing. Restoring the PDF allowed review again.
- Administrator screens expose no recipient Sign action. Security tests separately cover other members, other state administrators and inactive accounts.
- Desktop and 390px mobile screenshots were inspected. The mobile document did not overflow the viewport. PDF text and independent page renders verified filled blocks 10/12, UTC date, blank NEMA signature, original terms, attachment pages and consent/time/IP/hash evidence.
- Browser database evidence has two RecipientSigned workflows, three immutable issues, one rejection and nine pending delivery requests. No email delivery is verified.

Evidence: .git/gmt-gan-ui-tests.log, .git/gmt-gan-ui-workflow-final-tests.log, .git/gmt-gan-ui-lint.log, .git/gmt-typecheck-gan-ui.log, .git/gmt-gan-ui-build.log, .git/gmt-gan-ui-candidate.json, .git/gmt-gan-ui-browser-evidence.json, .git/gmt-gan-ui-pdf-evidence.json, .git/gmt-gan-ui-scope-diff.json and .git/gmt-gan-ui-live-verification.json. Screenshots and the synthetic downloaded PDF are under output/playwright.

The owned browser/preview/schema were cleaned up. Production still has eight users, no workflow tables/notification markers and the unchanged original asset/backend PID. Dependencies and startup files were preserved.

## Remaining

Private signed uploads, required-return completeness and the NEMA accept/return checklist are now verified; see gmt-gan-signed-returns.md. Remaining: Assistant Director countersignature; final executed PDF/Documents/Active award and funding opening; Action Items/tracker; template signing settings and rule UI; actual provider dispatcher/results; approved client attachment configuration; individual application integration; production project/import paths and the broader 2.0 scope.

The workflow migration/router/guards remain unmounted in production. The separate reviewed award startup patch is now explicitly approved and applied to staged source, with actual Application API tests. This does not activate GAN startup or execute any production migration, restart or deployment. This screen milestone does not complete GAN or GMT 2.0.
