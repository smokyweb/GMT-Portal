# Owned GAN issuance and recipient workflow backend

Status: backend/API, PDF and screen integration verified in isolated QA only. Production startup remains unmounted; the later screen evidence is in gmt-gan-workflow-screens.md. Updated 2026-10-29 America/New_York (2026-10-30 UTC evidence).

## Client contract and current behavior

The [client's GAN routing specification](https://app.basecamp.com/3102765/buckets/48972825/messages/10334117050#__recording_10349618188) requires Draft → Sent → Reviewed → Signed or Rejected, registered recipient identity, typed name/title and consent, immutable packages, audit/notifications, upload verification and NEMA countersignature before full execution. This milestone implements the owned send/open/electronic-sign/reject backend. Print/upload and NEMA verification are now implemented and tested in isolated QA; see gmt-gan-signed-returns.md. Countersignature, final Documents/activation and provider delivery remain unfinished.

Sending requires the latest saved package for the current Draft and an assigned administrator. The server reloads the authoritative sources and checks readiness plus body/template/source revisions against the recorded GAN; changed sources require regeneration. It builds an immutable issued package from the recorded GAN and exact attachment versions. The issued GAN has an issue-for-signature footer and no draft watermark. The original draft PDF/history remains unchanged. Later source/profile/settings edits do not re-merge an issued or signed copy.

Only the active registered official assigned on that issue, still belonging to the original organization, may review/sign/reject. A member of the same organization who was not assigned cannot act or fetch its issued PDF. Administrators cannot impersonate the recipient. The first recipient PDF open records Reviewed; repeat PDF downloads do not duplicate the first-open transition. Explicit repeat-open actions remain audited without another first-review notice.

Signing requires Reviewed, all three server-versioned consent statements, the name printed on the GAN, a title and the exact issued PDF SHA-256. Actor ID/email, observed HTTP IP and UTC time come from the server. It fills GAN blocks 10/12, preserves its legal/source fields and attachments, and appends an electronic signature record binding consent to the issued package hash. The date label explicitly identifies UTC. Unicode names are supported. The workflow becomes RecipientSigned and the legacy generated_documents status becomes Signed; fullyExecuted remains false. This does not activate the award.

Rejection requires notes. Owned regeneration changes Rejected to a new Draft revision, clears current legacy sent/signature fields and retains old issues/events/PDFs. A new send creates a new issue. The original assigned official can still read their earlier issued/rejected history while a newer draft is hidden.

## Persistence and guards

The explicit migration adds immutable gan_workflow_issues and gan_workflow_events, a guarded gan_workflows current-state record, immutable pending gan_workflow_delivery requests, and revisioned gan_signature_settings. It adds owned event/user markers to existing notifications. No production migration ran.

Each action uses one serializable transaction and a locked document. Stable request UUID/fingerprints make retries idempotent; changed payload reuse and stale/concurrent actions are rejected. Issue/event hashes, actor/recipient identity, consent evidence and current document state are checked. Deferred database checks require events, current state and document metadata to commit together. Audit, in-app alert or queue failures roll back the whole action. Generic writes cannot replace managed GAN data or forge its status.

Ordinary draft/package APIs now direct non-administrators to the issued workflow once an issue exists, preventing accidental delivery of a draft preview. Historical issue access is authorized against the recorded recipient. PDF bytes/manifests/signature evidence are checked on reads.

Shared template signing settings have an owned ISC-only, revision-checked API. Unconfigured templates default to electronic plus print/upload. Each issue freezes its allowed methods and settings revision; changing global settings cannot change an already issued package. The template settings UI/publishing integration remains pending.

## Notices and funding boundary

Actions create alerts in the existing notifications table and email delivery requests in the new pending queue. Existing workflow_rules storage is read for matching GAN event labels and role/channel preferences, including its encoded JSON form. Required parties are the assigned official on Sent, the sender on Reviewed/Rejected/Signed, and the configured portal approver on recipient signing. Rules do not broadcast private award information to unrelated accounts. Current role/state/agency membership is checked.

The new generic Notification guard scopes owned GAN alerts by registered user ID before filters/limits and allows only that user to change is_read. Legacy notifications retain their previous behavior. A companion guard restricts the new shared GAN notification-rule subset to ISC administrators. These guards must be mounted before generic entity routes on activation. The legacy Notification Rules screen and its trigger CHECK need an additive extension for the new GAN trigger choices. Tests exercise the existing trigger_event storage using an allowed legacy trigger; that is not a production rule-configuration handoff. The UI/schema extension remains work before configurable GAN rules are exposed. No global legacy authorization audit is claimed.

Delivery requests remain pending. There is no provider dispatcher or verified email delivery in this milestone. A later dispatcher must reauthorize the stored account/recipient and record delivery attempts/results before a delivery claim. No real email was sent. Reserved notification links target /award-documents/:documentId; that review route is now implemented and browser-tested in isolated QA.

The existing owned funding checks call a separate GAN gate only when the workflow schema exists and the application has a managed GAN. Draft/Sent/Reviewed/RecipientSigned/Rejected managed awards cannot submit or release funding until full execution. Existing grants without a managed GAN retain their current path. This is not a blanket migration/cutover policy for legacy awards, and no payment or financial balance changed.

## API handoff

- GET /api/gan/documents/:id/workflow returns the authorized state, assigned issue, identifiers, projects, activity and consent statements, without PDF byte arrays.
- POST /api/gan/documents/:id/actions/send takes requestId, expectedRevision and packageId.
- POST .../actions/open takes requestId and expectedRevision. Reject adds note. Sign adds name, title, consentElectronic, consentConditions, consentAuthority and issuedPdfSha256.
- GET /api/gan/issues/:id/pdf previews the immutable issued/current recipient-signed artifact; ?download=1 downloads it. Preview/download actions are separately audited. The recipient's first PDF request can increment the workflow revision, so the UI must refresh state after loading before enabling signature actions.
- GET/PUT /api/gan/templates/:id/signing-settings exposes ISC-owned allowed methods with a settings revision.

Expected workflow revision is separate from GAN/package revisions. The UI must refresh after an action/replay and use a stable request key only for the same payload. Recipient actions should start with unchecked consent boxes and enable only after actual PDF loading. The frontend now implements these controls and the reserved detail route; see gmt-gan-workflow-screens.md for the later browser evidence.

## Verified evidence

All 199 combined checks pass: 180 previous checks plus 19 workflow checks. Coverage includes stale source/package rejection, role/organization/active-account boundaries, issued snapshots, review-before-sign, exact consent/hash/name, Unicode signatures, rejection/regeneration/reissue, stable retries, atomic rollback at audit/alert/queue failure, concurrent sign versus reject, frozen signing methods, protected alerts/rules, first-open HTTP behavior, separate preview/download audit, corruption detection, database commit guards and funding protection. Five-project issuance/signing preserves full project IDs and its Schedule.

Strict changed-server Node lint, syntax and added-line whitespace checks pass. No frontend files/dependencies changed. The prior candidate build, 50 routes and frontend diagnostic baseline (1917 existing/global, zero new-feature diagnostics from the prior checked build) are retained; global typecheck is not passing.

Actual issued and recipient-signed PDFs were independently parsed and rendered. The checked outputs show no draft markings, Unicode name, typed title, UTC date, original award terms/amounts, blank NEMA approval, a consent/time/IP/hash record, and all five project IDs on Schedule/certificate. These are synthetic fixtures with no client legal/banking content. Evidence: .git/gmt-combined-gan-workflow-tests.log, .git/gmt-gan-workflow-lint.log, .git/gmt-gan-workflow-pdf-evidence.json, .git/gmt-gan-workflow-verification.json and .git/gmt-gan-workflow-live-verification.json. PDFs and rendered pages are under output/pdf/gan-workflow.

Test HTTP servers and owned schemas were removed. Public still has 8 users, no workflow tables or owned-notification columns, and the original live bundle/backend PID. Main index/router wiring, server configuration and root folders remain unchanged.

## Activation and remaining implementation

The workflow migration/router and notification/rule guards remain unmounted in production. The exact reviewed award startup patch is now approved and applied to staged source, with actual Application API integration tested. The earlier automatic review rejection was resolved by that explicit human approval. No production migration/restart/deployment occurred. GAN startup activation remains separate.

Administrator Preview/Send and recipient Review/Sign/Reject screens are now wired and tested in isolated QA. Private signed uploads, completeness and NEMA verification/return are now implemented and tested in isolated QA. Next: Assistant Director countersignature. Finish final executed PDFs/Documents/award activation, Action Items/tracker, template/rule settings UI and real notification delivery. Approved client attachment assets, production project/import paths, broader uploads, multi-org, reimbursement/compliance, design comparison and release checks remain. This backend milestone is not full GAN or 2.0 completion.
