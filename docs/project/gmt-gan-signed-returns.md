# Signed GAN uploads and NEMA verification

Status: backend, private HTTP APIs and recipient/NEMA screens verified in isolated QA on the GMT server. Not activated or deployed. Updated October 29, 2026 America/New_York.

## Client sources

The [client GAN specification](https://app.basecamp.com/3102765/buckets/48972825/messages/10334117050#__recording_10349618188) and its mockups 1-E (Print, sign & upload) and 1-F (NEMA verification) were inspected. They require signed GAN and Special Conditions pages, optional Direct Deposit, upload verification before countersigning, full application/subaward/project identifiers, correction notes, notifications and audit.

The screens follow those workflow compositions within the existing GMT shell. This is not full Figma parity. New visuals are small isolated components; state, validation, formatting and PDF logic live in separate hooks/helpers/services. The existing state header remains crowded at 390px; this milestone did not restyle that unrelated shell.

## Implemented

The assigned active registered official can download the issued package, choose print/upload when the issued template permits it, and privately save original signed PDFs. Upload-only, electronic-only and both-method templates are respected from the immutable issue, regardless of later template changes.

Each PDF records its original filename, exact bytes/hash, version and an explicit mapping of uploaded pages to the original document's page numbers. One declared original page is required per uploaded PDF page. Submission requires the GAN and every declared Special Conditions signature page, the latest selected versions, printed official name/title, date signed and an unchecked confirmation. Direct Deposit is optional and is offered only if the issued package includes it. Replacing any upload clears the prior confirmation.

This validates completeness declarations and file structure. NEMA's human comparison determines whether signatures, dates, identifiers, amounts and terms are correct; automated signature authenticity, legal compliance and PDF certificate validation are not claimed. Original signed files remain unchanged. An assembled viewing copy is separate and does not preserve a digital certificate's validity.

Submission freezes its exact set of originals and assembled review PDF. The workflow is Uploaded, then either UploadReturned with required notes or Verified after all six checks:
- Award number and amount match.
- Project amounts match every issued project/Schedule.
- Block 10 is signed by the authorized official.
- Blocks 11 and 12 are complete.
- All required Conditions signature pages are included.
- Award terms have not changed.

Only assigned active NEMA grants staff (admin/reviewer/ISC, with applicable state/grantee scope) can accept or return the current submission. Both issued and uploaded PDF hashes must match. Acceptance does not countersign or activate the award. Fully executed remains false and managed funding stays blocked. Verified signature metadata identifies the submitting recipient and server receipt time; the user's claimed date signed is separately retained.

The UI requires actual generated and uploaded PDF rendering before verification, checks downloaded bytes against record/header hashes, starts verification boxes unchecked, requires correction notes, and displays recorded checks on reload. Previous submitted copies and all original versions remain available through private history downloads after correction/resubmission. Full identifiers remain in the shared header and immutable manifests. The recipient sees the returned note and can replace affected files, reconfirm and resubmit.

## Integrity, privacy and notices

The extension adds immutable gan_return_uploads and gan_return_submissions. Owned uploads and transitions use serializable transactions, document locks, revision checks, stable request IDs, hash-bound requests and audit. SQL guards protect originals/submissions/status and require submission plus event/state/document metadata to commit together. Audit or pending-delivery failure rolls back the whole action. Concurrent accept versus return commits one winner.

New files are database-backed private PDFs; they are not placed in the public upload directory. Download routes authenticate and scope access, send private/no-store and nosniff headers, verify hashes and audit preview/download separately. Conflicting grantee assignments cannot list/read private returns, and their workflow response redacts upload metadata/history. Inactive or moved recipients cannot act.

Ordinary PDFs with visible handwritten or external signatures are supported. Signed PDF dictionaries are allowed for returns while blank template attachments still reject existing signatures. Structural checks reject encrypted, malformed, oversized, scripted/embedded/unsupported PDFs. Originals are preserved even when a separate flattened review copy is assembled.

New workflow notices cover uploaded, returned and verified states. Submission notifies the sender; return notifies the recipient; acceptance notifies the recipient, sender and configured approver, subject to existing rule channels and current access. Requests stay pending; no provider sends or delivery claims occur. Shared GAN rule guards include the new event labels, but the legacy rule trigger constraint/settings UI still needs its separate extension before configurable rules are exposed.

## API handoff

The existing owned /api/gan workflow router handles these JSON actions with requestId and expectedRevision:
- submit_upload: uploadIds, name, title, signedDate (YYYY-MM-DD), confirmed:true, issuedPdfSha256.
- accept_upload: submissionId, issuedPdfSha256, uploadedPdfSha256, six true checklist fields and optional note.
- return_upload: submissionId, both hashes and required note.

The new unmounted returns router provides:
- POST /documents/:id/return-uploads: multipart file plus requestId, expectedRevision, kind (gan/special_conditions/direct_deposit) and sourcePages JSON array. Limit: one PDF, 10 MB, 1–150 pages.
- GET /return-uploads/:id/pdf: exact private original; ?download=1 uses attachment disposition.
- GET /return-submissions/:id/pdf: immutable assembled submission; ?download=1 downloads it.

GET /documents/:id/workflow includes returns.parts, uploads, submissions, checklist, canUpload and canVerify. These additions are null when the extension is not installed. Workflow phases are Uploaded, UploadReturned and Verified alongside the prior states. The migration extends generated_documents statuses only for managed GANs.

## Verified evidence

220 combined tests pass. These include actual Application API award integration and 17 signed-return checks including their parent: identity/state/grantee boundaries, page completeness, optional deposit, frozen methods, immutable original/read hashes, retries, malformed/encrypted/active/oversized files, stale/foreign versions, correction/resubmission, six-check acceptance, audit/queue rollback, orphan-commit rejection, concurrent decisions, raw multipart HTTP and private downloads/corruption guards.

Scoped strict lint, server syntax, changed-line whitespace and the candidate build pass. All 51 registered routes are retained. Global typecheck remains at 1917 existing diagnostics, with none in this feature; it is not globally passing.

Headless Chromium verified the complete upload → return → corrected resubmission → accept path. Earlier failure checks covered out-of-range/missing signature page mappings, missing required documents/confirmation, corrupted PDF gating, unchecked verification and required correction notes. A fresh preview on the final candidate repeated the full path, historical original/submission downloads and persisted verification checks after reload. It also verified upload-only mode, optional deposit not blocking and then uploading it, 390px upload/verification layouts, all PDF pages and an electronic-only signing/download regression.

The final synthetic database had two Verified workflows, one RecipientSigned, three submissions, six original uploads and 15 pending delivery requests. Actual downloads matched stored immutable hashes. Earlier and corrected copies differ, while the original download equals its original file. Independent PDF parsing/rendering confirmed preserved GAN content, filled recipient blocks, Conditions pages and the electronic regression certificate. These fixtures are explicitly synthetic and contain no real banking information.

Evidence: .git/gmt-gan-return-ui-tests.log, .git/gmt-gan-returns-tests.log, .git/gmt-gan-return-ui-lint.log, .git/gmt-gan-returns-lint.log, .git/gmt-typecheck-gan-return-ui.log, .git/gmt-gan-return-ui-build.log, .git/gmt-gan-return-ui-browser-evidence.json, .git/gmt-gan-return-ui-pdf-evidence.json, .git/gmt-gan-return-ui-scope-evidence.json and .git/gmt-gan-return-ui-live-verification.json. Screenshots/downloads are under output/playwright; standalone backend PDF evidence is under output/pdf/gan-returns.

Owned browsers, HTTP test servers and schemas were cleaned up. Public remains at eight users, no new award/GAN/return tables and the original live asset/backend PID.

## Approved award wiring and remaining work

The user explicitly approved the separate reviewed Award Details source wiring. Its exact 60-line patch is applied; actual Application API approval/edit/sync/rollback tests pass. See gmt-award-wiring-review.md and .git/gmt-approved-award-wiring-verification.json. It has not run a production migration or restarted the server.

This approval does not activate the GAN workflow/returns/settings migrations or routers, which remain absent from production startup. The current candidate must not be deployed alone.

Next: registered Assistant Director countersignature (portal and upload), block 9/final executed PDF, final Documents/Active award and funding opening, Action Items/tracker, provider delivery and rule/template UI, approved real attachment configuration, individual Application integration, ISC imports/production projects and the broader GMT 2.0 work. This is not full GAN or 2.0 completion.
