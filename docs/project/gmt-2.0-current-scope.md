# GMT Portal 2.0 — current implementation scope

Updated 2026-10-29. Work is confined to /var/www/gmt.bluesapps.com on the GMT server. Root folders, siblings, server configuration and the live process were not changed. The source alignment previously approved by the user is complete. New work below is staged source plus isolated QA, not a live release.

## Source of scope

The [client's priority decision](https://app.basecamp.com/3102765/buckets/48972825/messages/10351366111#__recording_10351911537) places NOFO applications, bulk imports, core award identifiers, GAN generation/signatures/notifications and password resets in P0. It explicitly defers advanced template editing, multi-org access, other templates, reimbursement/vouchers/compliance and project transfers.

Detailed acceptance sources: [client section/screenshots](https://app.basecamp.com/3102765/buckets/48972825/messages/10365835263#__recording_10366449604), [NOFO application details](https://app.basecamp.com/3102765/buckets/48972825/messages/10334123579#__recording_10349620727), [award fields](https://app.basecamp.com/3102765/buckets/48972825/messages/10334130057#__recording_10349629862), [GAN generation, routing and token dictionary](https://app.basecamp.com/3102765/buckets/48972825/messages/10334117050#__recording_10349618188), and [client GAN templates](https://app.basecamp.com/3102765/buckets/48972825/messages/10347763710#__recording_10349650669). Approved wireframe comparison remains a release task; functional browser QA is not proof of Figma parity.

## P0: required to finish the first usable award release

| Area | Implemented and checked in isolated QA | Work remaining |
|---|---|---|
| Accounts and password reset | Scoped invites/resets, hashed expiring links, forced password change, revocation, bulk role/status actions, CSV dry-run/audit and safe self-profile contact edits | Configure/test actual delivery without notifying real users during QA; verify the final role flows against approved screens |
| NOFO application builder | Configurable steps/fields, required checks, visibility/show-hide, repeaters, match/files, immutable started-form pins, program/state defaults and section copy; review and exports | Configure the actual FY2026 EMPG field/content set from client resources; final approved-screen and complete applicant/admin acceptance pass |
| Award identifiers | FAIN, subaward number, CFDA, federal/award dates and status, with snapshots, overrides, validation/revisions, admin editor/read-only recipient view | The specifically reviewed startup/sync patch is approved and applied to staged source, with actual Application API integration tested; reconcile/import real awards safely before production activation |
| ISC bulk upload | Account CSV tools and validation foundations exist | Finish ISC-only organization/user/application-award/budget-line spreadsheet import as one reviewed workflow; mapping, duplicate/reference checks, dry-run row errors, atomic/retry-safe saving, application numbers, registered contacts and explicit POETE. Account CSV alone does not satisfy this requirement |
| GAN source data | Authoritative record resolver; exact monetary/POETE/project checks; saved organization official/grantee settings and registered agency approver; correction reasons; stale source protection | Finish production project/budget entry/import path. Do not rely on QA-only project fixtures. Enforce applicable caps/eligibility at issuance |
| GAN generation | Four canonical program bodies, thirteen-block one-page PDF, attached one-page Project Schedule when needed, draft watermark/overflow checks, immutable PDF/merged-data/hash/template version, durable bulk generation/retry UI, private Conditions/optional blank deposit uploads and immutable draft packages, page previews/history/required-return mapping | Configure approved attachment assets; individual Applications → Review → Award Documents tab; reviewed contractual templates and approved actual attachment configuration |
| Signature workflow | Verified owned send/review/electronic-sign/reject APIs and administrator/recipient screens, private issued catalog/detail links, rendered/hash-checked PDFs, first-open tracking, unchecked consent/name/title/UTC time/IP and signed evidence PDF, immutable history, rejection/regeneration/reissue, private signed uploads, completeness, NEMA accept/return and correction/resubmission; recipient signing and upload verification stay pending countersignature | Assistant Director countersignature, final executed PDF/Documents and activation |
| Delivery, audit and task tracking | Transactional audit, owned in-app alerts and pending email requests for implemented workflow actions; existing rule channel format respected; managed funding remains blocked before full execution | Provider dispatcher/delivery results, rule UI, Action Items/tracker, countersign audit, fully executed award activation and funding opening; legacy cutover policy |
| Release integration | Candidate builds and current 220 automated checks pass; browser checks of implemented modules; all 50 previous registered routes retained plus the new detail route (51 total) | Approved backend/migration wiring, data backup/reconciliation, final role/browser/Figma regression checks and resolution/triage of global type baseline, deployment approval, migration/restart and live route/provider verification |

The user approved and the agent applied the exact reviewed 60-line Award Details startup/sync patch to staged source. Actual Application API integration is tested. This does not authorize GAN/settings activation, executing production migrations, a restart, deployment, or sending messages. Those production integration changes must be made concrete and reviewed separately.

## P1: next capability layer

- Template library/block editor with live preview and token checks, publish/version history, allowed signing methods and delivery/record/trigger/routing settings. Canonical GAN source files are not a published template library. Do not render arbitrary custom contractual bodies through the fixed canonical layout.
- Multi-organization/site contacts and organization switching. Until implemented, retain the client's temporary one-login-per-organization approach.
- POETE entry/import and grouping for budgets; analytics can follow. The resolver supports explicit categories but does not create a complete data-entry/import flow.
- Blank NOFO application forms: download the correct template, complete it, upload it to the correct step, validate required submissions and retain association/version.
- Reuse the document routing model for agreements and later document types rather than creating disconnected status implementations.

## P2: broader 2.0 completion

- Compliance/AEL details, budget tracker, vouchers and associated reports.
- Reimbursement cover sheet on submission, recipient signature, grants verification, Federal Aid Administrator, Assistant Director and Accounting routing; paid date and authoritative balance updates.
- Multiple production projects under an application/award, funding requests per project, project transfers/approval thresholds, amended GANs where total/scope changes, project-level reporting and history.
- Budget modifications, closeout letters, final-report conditions and award closure; all applicable delivery/audit/version handling.
- Complete final client-design comparison and end-to-end acceptance across these broader flows.

## Current evidence and next implementation order

The latest signed-return/verification milestone has 220 passing combined checks, clean scoped lint/syntax/whitespace, a passing candidate build and zero new-feature type diagnostics. Global typecheck remains at 1917 existing diagnostics and is not passing. Browser QA verifies private upload completeness, typed signer/confirmation, correction/resubmission, six-check NEMA acceptance, original-versus-upload PDF comparison/hash gating, immutable history downloads, recorded checks on reload, template methods, optional deposit and 390px layouts. Electronic-only signing/download regression passes. Owned QA schemas/processes were removed. Live remains at its original bundle and backend PID, with eight users and no new award/GAN tables.

Next independent source work: Assistant Director countersigning, final executed PDF/Documents/award activation and Action Items/tracker. Approved client attachments and template-level defaults still need configuration. Complete ISC bulk upload to supply usable awards/budget data. The award source wiring is now approved/applied, but GAN activation, production migrations/restart/deployment and provider sending remain separate release work. No timeframe or completion percentage is claimed while material workflows remain unbuilt.

Detailed implementation/evidence: gmt-2.0-progress.md, gmt-award-wiring-review.md, gmt-gan-pdf-preview.md, gmt-gan-draft-snapshots.md, gmt-gan-bulk-drafts.md, gmt-gan-contact-settings.md, gmt-gan-draft-packages.md gmt-gan-owned-workflow.md gmt-gan-workflow-screens.md and gmt-gan-signed-returns.md. Current checkpoint manifest: .git/gmt-award-stage-checkpoint.json.
