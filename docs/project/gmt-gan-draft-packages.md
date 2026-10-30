# Private GAN draft packages and attachment versions

Status: implemented and checked in isolated QA only, 2026-10-29. No production migration/router activation, restart, sending, signing, publishing or email delivery occurred.

## Client requirement and source limits

The [client GAN specification](https://app.basecamp.com/3102765/buckets/48972825/messages/10334117050#__recording_10349618188) requires a GAN plus Special Conditions, the Project Schedule for more than four projects, optional Direct Deposit, and mandatory signed GAN/Conditions signature pages for print/upload. [Template requirements](https://app.basecamp.com/3102765/buckets/48972825/messages/10334120689#__recording_10349622995) also require attachment settings and retained versions. Basecamp searches and the checked project vault did not yield an approved standalone Special Conditions or blank Direct Deposit PDF. The upload path is implemented; QA uses explicitly synthetic files and does not invent client legal text.

Existing legacy uploads use public file links. This scoped addition does not rewrite that older system. New GAN attachment assets and assembled packages are stored privately in owned database tables with authenticated, scoped downloads; no new legal/banking files are put in the public assets folder.

## Implemented behavior

After generating a draft, an administrator can choose Prepare award package in the Award Documents table. The panel shows the application/GAN revision, required Special Conditions and optional blank Direct Deposit versions, upload controls, saved package history, page ranges and required signature page numbers. Uploading identifies the NOFO, attachment type/title, actual PDF and one-based signature pages. Conditions require at least one valid signature page. The chosen immutable source ID/version is explicit in each package.

The service assembles every GAN page, including its Project Schedule, followed by the selected Conditions and optional deposit form. Required return metadata maps original signature pages to package page numbers. Direct Deposit is optional and never enters the mandatory return list. Filled form appearances are flattened in the assembled print preview; the original source bytes remain separately retained. All package pages are marked as draft previews. This is not an issued or executable package.

Saved package revisions include the GAN revision/hash, application/subaward/project IDs, recipient/NOFO, template version, all source IDs/versions/hashes, complete PDF bytes/hash, manifest hash and required return pages. Existing source and package rows cannot be updated/deleted through the owned workflow or normal SQL. Later attachment uploads, organization changes and GAN regeneration do not alter an earlier package. Stored files/manifests are checked on reads. Stable request UUIDs make successful retries idempotent; changed/reused requests, stale revisions and concurrent overwrites are rejected. Audit failures roll back the new source/package and the audit together.

Library uploads/listing require scoped NOFO administrators. Preparing a package requires an assigned award administrator; draft packages remain inaccessible to recipients and reviewers until a future owned sending workflow permits access. An attachment selected from another NOFO or of the wrong type is rejected. Package part downloads require access to that actual package and membership in its recorded parts. Private/no-store PDF responses include the stored SHA-256. New source upload, package preparation, preview and download actions use the existing Audit Log.

PDF inputs are parsed, bounded to 10 MB and 1–150 pages, checked against declared signature pages, and reject malformed/encrypted/unsupported active-content exports. The complete package is limited to 200 pages/24 MB. This validation is not a malware-scanning claim.

## Browser PDF viewer and dependencies

The native embedded browser PDF control produced a download/blank panel during QA. The panel now renders the actual private package with a local PDF.js worker, previous/next page controls and fit/150%/200% zoom. Render status is tied to the completed page-and-zoom render so a page change cannot report success while its canvas is still blank. The viewer reads an authenticated PDF blob; it does not send the package to an external renderer. Existing application font/logo requests remain outside this change.

Server pdf-lib is pinned to 1.17.1; browser pdfjs-dist is pinned to 6.4.299. Both package/lock changes are restricted to the new dependencies; existing lock entries are unchanged. The worker is a built asset, and the matching official font/CMap/decoder files and licenses are versioned under public/pdfjs/6.4.299. These are library assets only. New visual components are isolated files of 6–26 lines; parsing, state, calculations and rendering work live in separate helpers/hooks/services.

## Verification and evidence

All 180 combined tests pass: 168 prior checks plus 12 package checks. Coverage includes actual PDF page counts/order; form appearance flattening; required-return page offsets; five-project Schedule placement/IDs; optional deposit; retained original bytes; source/package retries and versions; changed/wrong-NOFO selections; concurrent/stale saves; role/state restrictions; audit rollback; SQL immutability; corruption detection in rolled-back isolated transactions; and real authenticated HTTP multipart uploads, PDF/part downloads, cache/hash headers and audit entries.

Strict scoped browser/Node lint, syntax, added-line whitespace and frontend build checks pass. New-feature type diagnostics are zero; the existing global baseline remains 1917 and global typecheck is not passing. All 50 route entries remain; the package editor uses the existing page.

Synthetic browser QA confirmed: save disabled without Conditions; invalid signature-page correction; actual source upload; a three-page Conditions-only package; a four-page version including optional deposit; old/new downloads matching their stored hashes; history restoration after reload; all four full canvas bitmaps rendering actual content; navigation boundaries; zoom; 390px layout with no outer overflow; and a recipient redirect with no editor/navigation. The first native preview and a render-status timing issue were corrected before the final canvas checks. Isolated PDFs were independently parsed for page text, Schedule IDs, flattened form content and draft markings. Full GAN, Conditions, deposit and Schedule render images were inspected.

Browser package r1 hash: f15912198fb153c863d2bca4087a03e99d0b0396e9ab50b01a6dd1c1a8cfa671. Browser package r2 hash: ad77b581fc110da618b7452ac23d986aef4049d3b48e4d9e7d964f95ebfe0b1c. These identify synthetic QA artifacts, not client awards. A subsequent label correction distinguishes GAN-only source parts from GAN+Schedule parts; automated package tests cover that correction.

Evidence files: .git/gmt-gan-package-browser-evidence.json, .git/gmt-gan-package-pdf-evidence.json, .git/gmt-gan-package-verification.json, .git/gmt-gan-package-live-verification.json, .git/gmt-combined-gan-packages-tests.log, .git/gmt-gan-package-strict-lint.log, .git/gmt-typecheck-gan-packages.log and .git/gmt-gan-package-build.log. Synthetic PDFs/manifests are under output/pdf/gan-packages; browser downloads/full canvas images and UI screenshots are under output/playwright/gan-package-* and gan-browser-package-*. Partial element screenshots can contain scroll-container/header clipping; the complete rendered canvas PNGs are the PDF-viewer content evidence.

The owned browser/process/schema were removed after QA. Public still has 8 users, no award/package/source tables and no GAN activation. Backend PID 371491 and the live bundle hash remain unchanged.

## Activation and remaining work

The explicit package migration and router factory are mounted only by the isolated preview. Main startup imports neither. Production GAN/settings/draft/batch/package wiring remains unactivated. The separate reviewed award startup patch is still unchanged and unapplied; the earlier source-alignment approval does not cover it. Automatic review rejected startup migration wiring because a future restart could modify production data. No alternate activation path was added.

Next: owned send/first-open/review/sign/reject, consent and identity capture, recipient signed-upload completeness and NEMA verification/return, Assistant Director countersigning, final issued/executed PDF, Documents, award activation, Action Items/tracker and real delivery/audit handling. A final issue renderer must replace the draft watermark path and retain the exact accepted package sources. Actual approved attachment assets must be configured before issuance. Template-level attachment defaults/routing/publishing, individual application integration, real project/import paths, broader uploads and the remaining 2.0 scope are still unfinished. Package previews do not satisfy signature acceptance or release gates.
