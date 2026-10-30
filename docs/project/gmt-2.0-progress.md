# GMT Portal 2.0 implementation progress

Updated October 29 2026. All project work is on the server in /var/www/gmt.bluesapps.com.

## Requirements and implementation boundaries

- Consolidated scope: https://app.basecamp.com/3102765/buckets/48972825/messages/10365835263
- Client's 26 screenshots across ten sections: https://app.basecamp.com/3102765/buckets/48972825/messages/10365835263#__recording_10366449604
- Priorities: https://app.basecamp.com/3102765/buckets/48972825/messages/10351366111#__recording_10351911537
- Approved wireframes: https://app.basecamp.com/3102765/buckets/48972825/messages/10432287384#__recording_10433499414
- Account regressions: https://app.basecamp.com/3102765/buckets/48972825/messages/10449332500
- NOFO form acceptance criteria: https://app.basecamp.com/3102765/buckets/48972825/messages/10334123579#__recording_10349620727

Use the later client model: one application/award contains projects P1, P2 and so on; transfers preserve the award total. Follow client screenshots and approved layouts. New visual components stay below 150 lines, with data logic in separate helpers, hooks, and services.

No root folders, sibling projects, server configuration, or production customer records have been changed. Existing dirty backend/package work is preserved. No live release or real email delivery is claimed.

## Approved source alignment: complete

The April checkout fe0d070 could not reproduce the live frontend: it lacked 16 live routes, Admin Hub, and the seven-step application wizard.

The user explicitly approved alignment inside GMT with source from GMT's own configured GitHub remote at 1b3d2267b1cce61cc36c0fe45a55b0b5f987358f. The approved operation updated 57 existing src files and added 61 missing src files; 71 already matched. The review manifest is .git/gmt-source-alignment-review.json.

The operation copied src only. It did not replace backend work, package scripts, dependencies, live dist, or configuration. The newer remote package scripts invoke canary.js; those scripts were not copied or executed. The existing Vite build script was retained.

The matching baseline preserves the live bundle route references. A direct comparison of Route declarations with GMT source ref 1b3d2267b1cce61cc36c0fe45a55b0b5f987358f confirms all 47 baseline entries are retained; the candidate has 49 entries including /reset-password and /change-password. These counts include wildcard entries and establish registration parity, not complete functional QA.

The earlier automatic-review rejection is resolved by the user's explicit approval. Do not report alignment as pending or blocked.

## Checkpoints

- Original project and live dist: .git/gmt-checkpoints/before-gmt-2-account-access-20261029T170335Z/project.tar.gz.
- Account work before alignment: .git/gmt-checkpoints/account-foundation-final-20261029T173414Z.tar.gz.
- Immediately before approved alignment: .git/gmt-checkpoints/before-approved-source-alignment-20261029T173721Z/account-source.tar.gz.
- Source before final account UI checks/fixes: .git/gmt-checkpoints/before-account-final-ui-20261029T175324Z.tar.gz.
- Other task checkpoints are retained in .git/gmt-checkpoints.

Checkpoints contain existing dirty work as well as this task's changes. Do not reset the whole checkout to Git HEAD or discard unrelated work.

## Account foundation implemented and ported

Backend:
- Dedicated account endpoints for scoped list/context, editing, invitations, resends, reset choices, one-time password links, and required temporary-password changes.
- Invitations preserve the administrator's session and send a set-password link; no shared/default password.
- Tokens are hashed, expire after 24 hours, and are single-use; issuance and redemption are serialized against concurrent reuse.
- State admins manage assigned-state subrecipients; ISC admins manage the wider account role set.
- Email reset or a one-time displayed temporary password, with optional active-session revocation.
- Current account role/status/session version are checked on authenticated requests. Preexisting version-zero sessions remain compatible.
- Generic User mutations cannot bypass the account permission rules. Public registration cannot create administrative roles.
- Organization/status edits use a scoped transaction; security-sensitive edits revoke stale sessions.
- Bulk status/role edits are atomic.
- CSV user invitations have a dry run, existing/duplicate account checks, a fingerprint to reject stale previews, per-row results, and mail-failure rollback.
- Audit entries exclude credentials and reset tokens.
- Actual last_login is set at sign-in and displayed separately from account creation.

Frontend:
- Account work is integrated into the newer User Management screen.
- Search, role/status filters, sorting, organization/state/phone editing, status controls, selection/bulk actions, and existing two summary cards are retained.
- Invitation and reset dialogs, set-password screen, and forced temporary-password change are isolated components.
- CSV template/download, quoted-field parser, preview, valid-row import, and error export replace the unsafe bulk registration flow.
- Successful resets that revoke an administrator's own session retain the temporary password until the dialog closes, then require sign-in.
- Multipart UploadFile adapter is implemented separately. The broader document-upload workflow still needs integration verification.

Backend modules are under server/services/account*.js, server/routes/accountAccess.js, server/middleware/auth.js and userEntityAccess.js. Existing auth/entity routes and server startup are wired to the new modules. Mail uses the existing transporter and distinguishes provider acceptance from delivery.

## Verified account-only checkpoint

- 26 tests pass: node --test tests/account-access.test.mjs tests/account-csv.test.mjs from server/.
- Tests cover state boundaries, privilege escalation, single-use/expired/replaced links, concurrent resets/redemption, mail rollback, temporary-password requirements, stale-session revocation, generic User endpoint bypasses, organization/status editing, actual login time, atomic bulk editing, CSV dry runs, stale fingerprints, partial provider failures, parser edge cases, and audit credential leakage.
- Candidate build passes using the existing Vite build script and .git/gmt-candidate-dist output.
- Scoped account lint: zero errors and zero warnings.
- Account-specific type diagnostics: zero. Matching newer-source baseline: 2167 total project diagnostics; final candidate: 2039. Existing project-wide type issues remain.
- Scoped tracked diff whitespace check passes; new account files have no trailing whitespace. A whole-checkout whitespace check also reports preexisting CRLF/whitespace in unrelated dirty backend files and upstream source; those files were not reformatted.
- New account visual components are all under 150 lines.

Account-only checkpoint JS: /assets/index-3oWLCF2_.js
SHA256: 51ba7d2b304cd0c62427ff96dc10ee0dca5546159d0d7b536497b1706886f173
Account-only route/build evidence: .git/gmt-candidate-routes.json. The current candidate now includes the NOFO core; its separate evidence is below.
Build, lint, and type logs: .git/gmt-account-build.log, .git/gmt-account-lint.log, .git/gmt-typecheck-final.log.

Browser verification used loopback-only preview with an isolated PostgreSQL schema and simulated email:
- Invite creates the intended user without switching the administrator.
- Invited users show Never signed in.
- Phone editing, user search, and sorting work.
- CSV preview identifies an existing account; commit imports only the valid row and reports the skipped duplicate.
- Bulk status update changes only the selected user.
- Reset email reaches set-password; completion returns to login; the new password authenticates the intended subrecipient.
- Administrator self-reset with session revocation displays the temporary password, closes to login, forces the password-change screen, and permits sign-in after the change.
- Updated User Management screen was visually inspected. Screenshot: output/playwright/gmt-aligned-account-screen.png.

Browser tooling and shared libraries were extracted only inside project .git; no system packages were installed. Production user count remains 8. The live API process and dist have not been replaced. Full portal QA and real provider delivery remain separate gates.

## NOFO form core implemented in staged source

The new Application Form tab on Edit NOFO now configures enabled/reordered/renamed sections, standard field visibility/labels/help/required settings, custom fields, conditions, reviewer/export visibility, field limits, repeating table columns, document requirements and match rules. Core visual components are isolated files under src/components/nofo-form and src/components/application-form, all below 150 lines. New Application and ApplicationDocumentsStep have been split into small visual components, hooks and data helpers. PDF drawing/data logic is separated from its visual export dialog.

The applicant wizard renders the selected NOFO definition. It supports text, long text, number, currency, date/date range, dropdown, multi-select, checkbox, yes/no, upload and repeating-table controls. Organization fields use assigned organization data. EMPG defaults include a structured work plan, personnel names/positions/percent time/NIMS training/exercise participation, federal/match line amounts, and a 50 percent match rule measured against total project cost.

Backend services assign an immutable form version when the first draft is saved. Admin edits after that create a version for future starts. Existing unversioned applications are pinned to a legacy definition when their NOFO is first configured. Document requirements are also versioned. Stale concurrent edits are rejected; form version IDs cannot be substituted through generic Application/Nofo writes. Application and budget mutations enforce organization/state access. Server submission checks required/conditional values, document files, line totals and match, with exact cent-level percentage comparisons. It assigns unique application numbers and sends state-scoped in-app reviewer notifications in the transaction.

Yes or Unsure in EHP trigger questions requires review and the EHP screening document. Subrecipients cannot approve their own EHP. Affected reimbursement-line classification, blocking and the approval recording workflow are now implemented and verified in staged source as described below. Live activation remains outstanding.

Copying an application starts it against the target NOFO's current form, rather than reusing the source version ID. Existing project details and budget lines are retained. Reviewer/applicant details show the configured values. CSV, PDF and audit ZIP exports include the form data and respect export visibility. Audit ZIP requests now require authentication and application scope, and the client sends its session token. File validation supports the actual /api/files URL contract as well as legacy /uploads references.

Routes, permission guards and additive migrations are wired in source. The live process has not restarted, so production migrations have not run. No production form columns exist yet. No real email was sent. Preview uploads use simulated storage; real production file delivery remains unverified.

## Core verification and release state

Combined command from server/: node --test tests/account-access.test.mjs tests/account-csv.test.mjs tests/nofo-forms.test.mjs tests/form-exports.test.mjs.

All 54 tests pass against isolated schemas or pure data helpers. New coverage includes concurrent/stale form edits, immutable version assignment, legacy applications, field validation, EHP Unsure, file requirements, exact fractional match boundaries, cost-share enforcement when the budget step is disabled, document versioning, distinct concurrent submission numbers, state-specific notifications, generic endpoint bypass attempts, scoped/authenticated audit ZIP export, and field exclusion in export JSON/CSV/PDF inputs.

The current build passes. Scoped feature lint passes with zero errors/warnings. Scoped account/form type diagnostics are zero. Existing project-wide diagnostics remain; the matching upstream baseline had 2167 and the latest checked candidate had 1934. No unrelated global type cleanup was performed.

Current candidate output: .git/gmt-candidate-dist. Its exact asset hash, all 50 route names, missing-route comparison, and original live hash are in .git/gmt-nofo-candidate-routes.json. All 48 existing routes remain; reset/change-password add two routes. These checks establish route presence, not full functional QA of every portal screen.

Browser QA of the core used loopback-only fixtures and synthetic records:
- Built and reopened a required custom dropdown through the NOFO editor.
- Created/saved an applicant draft and showed required-field errors.
- Entered EMPG personnel, including training/exercise details.
- Rejected insufficient match, then accepted equal federal and match amounts.
- Treated EHP Unsure as review-required, blocked submission for a missing EHP document, linked an uploaded document to the saved application ID, and submitted successfully with an application number.
- Downloaded actual CSV and PDF files, inspected their contents for custom/personnel fields and confirmed an excluded field was absent.
- Created form version 2 through the editor after version 1 had been used, confirmed the original submitted application still showed version 1, and confirmed fields hidden from reviewers were omitted.
- Copied the application through the existing Copy dialog and confirmed its new draft used version 2 with copied project/custom values and its own copied budget row.
- Reloaded the original submitted application and confirmed its fields were read only; reloaded the copied draft and confirmed it remained editable.

Evidence is under output/playwright (synthetic QA artifacts only), including gmt-nofo-form-editor.png, gmt-nofo-application-submitted.png, gmt-nofo-version-two-draft.png, gmt-form-values.csv and gmt-form-values.pdf. Logs are .git/gmt-combined-tests.log, .git/gmt-nofo-build.log, .git/gmt-nofo-lint.log and .git/gmt-typecheck-forms.log.

Public live asset identity was rechecked and remains 5e3d4e5874318808bc75618061bd569b06e9cdfbfdeb77afac60435e9f64e567. The live port 3045 listener remains PID 371491. Production user count remains 8. No root folders, server configuration or live dist have changed. Final staged checkpoint metadata is .git/gmt-core-checkpoint.json.

## Remaining GMT 2.0 work

1. Account foundation: aligned source and candidate verified; live activation and live checks remain.
2. NOFO form builder: core source and isolated flow verified as above. Program defaults and cross-program section reuse are now implemented and verified below. EHP approval and affected-cost holds are also implemented and verified below. Remaining: final approved-design comparison and production activation/verification.
3. Award data: required NOFO/award/organization/authorized-official fields, inheritance/overrides, Award Details and Documents.
4. Bulk imports: dictionary/workbook, organizations/users/applications-awards/budgets, CSV/XLSX mapping, dry run, idempotent commit and audit. The user CSV invitation tool is only a subset.
5. GAN workflow: complete token resolution, missing-token guards, immutable PDF/version/hash, bulk generation, sign/reject, print/upload verification, countersign, notifications/audit/tracker.
6. Template management: library/editor/preview/token picker/settings/versions and required NOFO forms.
7. Multi-organization access: memberships, authorized switcher, consistent permissions.
8. Budget/compliance: POETE/AEL/equipment, federal/match amounts, tracker fields, elapsed-period compliance rules.
9. Reimbursements: cover sheet, verified voucher generation, NEMA/Federal Aid/Assistant Director/Accounting routing, payment and balance updates.
10. Projects/transfers/reporting: projects per application, allocations/balances, controlled transfers/amendments, milestones, exports, GAN rollups and closeout.

Do not mark the full objective complete based on this first foundation. Preserve the verified account candidate before starting subsequent features.

Preview cleanup is complete: no gmt_qa_ schemas remain. Production still has 8 users and no form_version_id/form_values columns. The preview process and browser session were stopped.


## Program defaults, legacy preservation and section reuse verified

Grant Programs cards now have an Application Defaults editor. ISC administrators can configure all-state defaults or a state override. State administrators are limited to their own state. New unconfigured NOFO forms inherit their program and state defaults; explicit NOFO forms retain their own version until an administrator selects Use Current Program Defaults and saves. Default versions are immutable, scope-checked, audited, and guarded against stale concurrent edits. The NOFO version records which program default it used.

A one-time additive activation migration preserves pre-2.0 applications on legacy snapshots before new defaults can change their fields. Legacy snapshots retain the old wizard labels and optional project fields and exclude new EMPG personnel requirements. Re-running the migration is idempotent. Started applications retain their version when a new NOFO version adopts modern defaults. Production has not run this migration.

Section reuse now works across programs. Foreign standard fields become custom fields; target standard storage fields are retained hidden, field IDs and conditions are remapped, and invalid dangling dependencies are rejected. Whole-form copying remains limited to the same program.

All 69 automated checks pass, including the 54 prior account/form/export checks plus program defaults, scoped permissions, concurrent saves/application starts, legacy migration idempotence, stale adoption, provenance, and section-copy dependencies. Current feature lint passes; scoped account/form type diagnostics remain zero, with 1934 preexisting project-wide diagnostics. The candidate build passes and retains all 48 prior route strings plus the two account routes. Route-string checks include navigation constants and do not establish that every link is a functioning route.

Loopback browser checks with synthetic data confirmed global and Nebraska saves, inherited global custom fields in a Nebraska override, state-admin scope restriction, state-admin editing, NOFO inheritance, explicit adoption of newer defaults, cross-program section copying, and applicant draft version assignment. The draft was joined to its saved NOFO and Nebraska program-default version 3 in the isolated database. Screenshots: output/playwright/program-defaults-ne.png, nofo-program-section-reuse.png, nofo-apply-program-defaults.png, program-defaults-applicant-inheritance.png. Preview email and file storage remain simulated. Preview-only DocumentTemplate lookup warnings do not verify template management.

Build and test logs: .git/gmt-program-build.log, .git/gmt-program-lint.log, .git/gmt-combined-tests.log, .git/gmt-typecheck-forms.log. Public live asset hash remains unchanged. The synthetic preview and browser were stopped and their isolated schema removed before this checkpoint.


## EHP approval and affected reimbursement costs implemented and verified

Assigned state/ISC administrators can classify application budget lines as affected or not affected by EHP. The review panel appears in both Application Review and Funding Request Review. Administrators record an external approval reference, date and notes; immutable decision history records the actor and time. They can reopen a review or require review for a newly identified activity. Stale concurrent administrator changes are rejected. Classification changes reopen an existing required approval. Screening or custom-value changes invalidate a stale approval. Generic Application writes cannot forge approval, approval date, manual requirement or review revision. Generic budget writes cannot bypass the dedicated classification action.

Funding requests and their expenditure lines now submit together in a server transaction. The form and existing reimbursement CSV import use the same endpoint. CSV preview includes a budget-line/EHP mapping control for each row and preserves the preview with a visible error when a row is held. An affected cost waits for recorded EHP approval; a cost linked to a budget line classified as not affected can proceed while EHP review is still pending. Unknown or foreign budget mappings are rejected when EHP review requires classification. Linked budget classification is checked on the server, so a caller cannot mark an affected line false to bypass the hold. Reimbursement approval, finance routing and payment-status changes recheck the hold. A request cannot change its grant or type to bypass validation. Approved or paid expenditure lines are locked.

The previous review screen updated grant balances before attempting to save the funding decision. Approval amounts, balance changes, application/request audit entries and the subrecipient's in-app decision notification now commit together on the server after EHP checks. Repeated approval or payment edits do not add expenditure twice. This preserves the existing convention that an approved funding amount contributes to total_expended; the broader accounting/payment workflow is still workstream 9. No real payment provider or email was invoked.

All 81 combined automated tests pass. Added coverage includes state/organization boundaries, admin-only approval, stale and concurrent decisions, foreign/unknown mappings, affected versus unaffected costs, rollback on missing files/invalid amounts, approval/reopen/payment holds, generic endpoint bypasses, concurrent request numbers, balance idempotence, manual review requirements, HTTP authentication, and approval references/linked expenditure lines in the authenticated audit ZIP. The audit package now includes ehp_decisions.json and funding_request_line_items.json.

Browser QA used synthetic grants, costs and accounts on loopback with an isolated schema. It verified: classification controls; an affected request rejected with a visible inline explanation; an unaffected request accepted; external EHP approval recorded; an affected request accepted afterward; reopening review blocking a reviewer approval; rerecording approval allowing it; and the existing CSV upload/preview path mapping rows, holding an affected row and approving an unaffected row while EHP remained pending. A final database read confirmed the CSV request amount 15, grant expenditure 15 and remaining balance 985, with both audit entries and the intended in-app recipient notification. No production records were used.

Evidence: output/playwright/ehp-held-reimbursement.png, ehp-unaffected-submitted.png, ehp-approval-recorded.png, ehp-approved-cost-submitted.png, ehp-reviewer-approved.png, ehp-csv-hold.png and ehp-csv-submitted.png. The final CSV browser run used the updated server decision/audit transaction. The original review callback depended on a client-side audit write unsupported by the preview fixture; moving that write and its notification into the server transaction also removed that partial-success failure path.

Feature lint and scoped type results, current build hash and checkpoint are recorded in .git/gmt-core-checkpoint.json. Test log: .git/gmt-combined-ehp-tests.log. Build/lint/type logs: .git/gmt-ehp-build.log, .git/gmt-ehp-lint.log, .git/gmt-typecheck-ehp.log. All new EHP visual components are isolated files below 150 lines. Existing unrelated screens and preexisting global type/lint issues were not cleaned up.

The additive activation migration adds EHP revision/manual-review fields, line classification/linkage, decision history and the Draft funding status. It was exercised only in isolated schemas. Production still has 8 users and none of these new form/EHP/default tables or columns. The loopback previews and schemas have been removed. The live API process, dist, domain routing, root folders and server configuration remain unchanged.

The full 2.0 objective remains in progress. Account/form/default/EHP source is staged; GAN, template management, broad imports, award/project models, multi-organization access, budget/compliance details, reimbursement/voucher routing, design comparison and live activation/verification remain.


## Award fields implemented in isolated preview; startup wiring awaits approval

Client requirements: https://app.basecamp.com/3102765/buckets/48972825/messages/10334130057#__recording_10349629862. The P0 dependency order is the client's own: NOFO builder, award identifiers and imports before GAN generation/signing.

NOFO Create/Edit now relabels the existing grant_number as Federal Grant Number (FAIN), keeping the data in place. It adds State Grant Number; funding stream; CFDA/Assistance Listing and title; grant year; retained M&A percentage; per-organization cap and total federal award; federal award/PoP/close dates; and Award Terms (statutory authority, federal description, indirect rate, R&D, method of payment and statement). Grant Programs has a configurable M&A limit. Saving checks FAIN/CFDA format, valid federal dates, percentages, money precision, the configured M&A limit and stale NOFO revisions. The existing form-version pointer is removed from the metadata payload so editing metadata does not attempt to replace the locked form.

Award Details is a new tab between Budget and Documents in the administrator review modal, and a readonly tab for subrecipients. It includes the full requested identifier/status/match/M&A/date fields. The separate award_details record snapshots shared data, tracks origins and explicit overrides, rejects stale edits and duplicate subaward numbers within a NOFO, and synchronizes edited award amount, match and dates with the application. Existing expenditure is preserved; an award cannot be reduced below expenditure already approved. The migration preserves an existing application FAIN override and is idempotent. Explicitly clearing an award FAIN stays cleared until restored, rather than silently taking the NOFO value.

Browser QA confirmed state-admin editing, a configured program limit, rejection of 6% when the limit was 5%, saving 3%, preserving the old award snapshot after changing its NOFO FAIN, an individual award override, explicit restoration from the current NOFO, and readonly subrecipient access. The program's existing match and caps remained 50%, 100000 and 100. The QA award changed to 600 with 100 expenditure retained and 500 remaining. Screenshots: output/playwright/award-nofo-federal-fields.png, award-details-admin-override.png, award-details-subrecipient-readonly.png. The preview schema and browser were removed.

The new service/router/migration files are present, and the isolated preview mounts them. The main server index and generic application-save service have NOT yet been wired for awards. Automatic approval review rejected that step because adding the migration to startup creates a persistent path to future production data changes. The user has a pending explicit approval question for the reviewed 60-line patch, .git/gmt-award-startup-wiring.patch. Details and limits are in docs/project/gmt-award-wiring-review.md. Do not apply it, change startup through another path, restart, or deploy while that specific approval is pending.

The pending patch also connects the tested application-to-award sync hook and removes the review screen's expenditure reset during approval. The hook is database-tested in a transaction, including rollback, preservation of identifiers/expenditure and audit. Its actual generic Application API integration must be checked after the user approves and the patch is applied. Until then, the new frontend is a preview candidate and is not ready for production deployment.

## GAN token resolver and client template preparation

The four client Markdown reference templates are preserved under docs/project/basecamp-gan. Prepared copies under server/templates/gan replace fixed FY2025/FY2023 and federal award examples with record tokens, retain the thirteen numbered blocks and client-provided terms, and add project-breakdown placement. They are not published templates.

Pure helpers under src/lib/documents build the flat token data from NOFO, award snapshot, application, organization, registered authorized official, grantee and POETE budget/project data. Missing or unknown/malformed tokens identify the record and field that needs correction. Values do not silently become dash placeholders. Zero indirect rate, an explicit No R&D choice and a blank optional DBA are handled correctly. Inactive/unassigned officials, unapproved/held awards and a mismatched template program remain blocked. Historical bodies with fixed award identifiers cannot be treated as ready.

Financial checks use exact cents: POETE must be explicit rather than inferred from Personnel/Travel categories; federal and match budget sums must reconcile with the award; project IDs and federal/match sums must reconcile; and the pinned application form's match percentage takes precedence over a newer NOFO default. More than four projects produce a requiresProjectSchedule flag and a schedule reference in the prepared body. This flag is not proof that the attachment PDF exists.

All 109 combined automated checks pass (81 prior account/form/EHP checks, 10 award service checks, 18 pure GAN checks). Feature lint is clean and new award/GAN type diagnostics are zero. The project still has 1917 preexisting/global type diagnostics; no unrelated cleanup was performed. The frontend build passes. Final preview-stage metadata is .git/gmt-award-stage-checkpoint.json; the last fully wired account/form/EHP checkpoint remains .git/gmt-core-checkpoint.json until award wiring is approved.

GAN work still required: authoritative database context loader and official/grantee configuration; POETE entry/import and award/organization cap enforcement at issuance; template publishing/version/settings UI; one-page PDF layout and Project Schedule/Special Conditions package; immutable PDF/hash/snapshot storage; bulk/single generation and missing-field preview; owned recipient sign/reject, upload verification, NEMA countersign, Action Items/tracker, email delivery, audit and safe generic endpoint restrictions. No GAN was sent, signed or published, and no official PDF was generated.

All broader imports, multi-organization, budget/compliance, reimbursement routing, projects/transfers/reporting, design comparison and live release gates remain part of the full 2.0 goal. The startup wiring approval does not authorize restarting or deploying the app.


## Read-only GAN database context verified

The unmounted server/services/documents/ganContext modules now prepare GAN previews from saved application, NOFO, program, award, budget, template, registered official and grantee records in one repeatable-read, read-only transaction. A browser may choose saved record IDs and dates but cannot inject award amounts, organization fields, template bodies or roles. Scoped administrators can prepare their state awards; subrecipients, reviewers and other-state administrators cannot. Official choices must be active registered users belonging to the recipient organization. Grantees must be active and match the recipient state and the administrator assignment. Credential fields are not returned.

Missing award records are reported without creating them. A missing pinned application form blocks readiness instead of using a newer match default. An ambiguous legacy program requires an explicit NOFO assignment. Empty/inactive or incompatible templates, inactive organizations/programs and invalid dates are blocked. Optional new tables are looked up in the current schema rather than falling through to production tables during isolated QA. The application_projects loader contract is preparatory; a production project model and its editing/import flow remain unimplemented.

Official/grantee selections are explicitly preview-only and are not persisted assignments. The preview service has no HTTP mount, no startup migration, no document writes, no PDF generation and no sending/signing. This step does not bypass the pending award startup wiring approval. Future issuance must reauthorize saved assignments and rebuild a snapshot in its own transaction rather than trusting this preview response.

All 120 combined tests pass, including 11 new context checks for authoritative amounts, state/role access, caller injection, registered official/grantee boundaries, missing records, pinned forms, ambiguous programs, template readiness, concurrent source changes and read-only transactions. Scoped lint and Node syntax checks pass. Logs: .git/gmt-combined-gan-context-tests.log and .git/gmt-gan-context-lint.log. No frontend changes were made in this step, so the previously built candidate asset is retained. Production still has 8 users, no award_details table and no QA schemas. The live bundle hash and backend PID/cwd remain unchanged. Full 2.0 implementation continues.


## GAN thirteen-block PDF and authenticated preview verified

The four client program GANs now render in the provided thirteen-block Letter layout. Block 5 includes up to four projects; larger applications receive a separate one-page Project Schedule with full project IDs and reconciled totals. Font assets and their license are inside the GMT project. Overlong content and unsupported glyphs raise visible errors. The renderer returns PDF/merged-body/template hashes and template version; every page is marked as a draft preview. This is not immutable database persistence or issuance.

The new unmounted GAN preview router reloads and authorizes saved records for each JSON/PDF request. Isolated HTTP checks confirmed current state/role boundaries, denied injected amounts, complete PDF output, private/no-store headers and unchanged award revision. Missing source values return correction details. Templates without saved positive integer versions are blocked. The PDF layout currently accepts the four reviewed canonical bodies; arbitrary customized contractual bodies are rejected until their layout is reviewed, rather than silently dropping terms.

All 129 combined tests pass. Added coverage inspects actual PDF text and page bounds for all programs, thirteen blocks, full project IDs, matching totals, Unicode official names, overflow errors, altered merge data, stable hashes and the authenticated HTTP preview. Strict recommended Node lint is clean for changed files. Seven current rendered pages across six QA PDFs were visually inspected, including the long-name/four-project page and the attached schedule. Source, limitations, QA setup and evidence are described in docs/project/gmt-gan-pdf-preview.md. Evidence manifest: output/pdf/gan-preview-manifest.json.

No frontend code changed, so the existing candidate build is retained. The award startup patch remains unchanged and unapplied; GAN previews are not mounted in the production index. No production migrations, restarts, document writes, signatures or messages were performed. Official/grantee configuration and assignment persistence, project models, Special Conditions attachments, immutable snapshots, generation/signing/routing UI and the other 2.0 workstreams remain.


## GAN draft persistence and immutable revision history verified

The staged GAN draft service now reloads/authorizes source records and commits the checked merged text, template/body/PDF hashes, PDF bytes, source/official/grantee IDs, projects, template version, immutable revision history and existing audit log in one serializable transaction. A failed audit rolls back both master document and snapshot. One managed GAN is allowed per application. Legacy GANs require reconciliation rather than silent duplication. A request UUID/fingerprint makes retries idempotent; changed selections with the same key and stale/concurrent saves are rejected. Explicit Draft/Rejected regeneration preserves earlier revisions. Sent records cannot be regenerated.

Database triggers verify hashes/identity and block ordinary managed-record edits, status forging, history changes and deletion. Authenticated snapshot/PDF reads verify hashes and return the stored bytes, without re-merging current records. Unsent Drafts are hidden from recipients and reviewers. Organization reassignment requires reconciliation. The generic-entity guard factory blocks managed writes, filters managed reads by scope before list limits, and projects metadata without loading or exposing PDF byte arrays or snapshot JSON. Existing legacy rows retain their previous behavior.

All 142 combined tests pass, including 13 new draft checks. Added coverage includes source-edit stability, old revision retrieval, regeneration, idempotent HTTP retries without duplicate audit, concurrent/stale saves, invalid payloads, failed-audit rollback, organization/state/role boundaries, corruption detection, direct SQL protection, private HTTP PDF reads and generic metadata/filter safety. A sent-state fixture simulates a future transition only inside a disposable schema to test the freeze; no actual sending/signature workflow is implemented. Strict recommended Node lint and syntax checks pass. Details: docs/project/gmt-gan-draft-snapshots.md. Logs: .git/gmt-combined-gan-draft-tests.log and .git/gmt-gan-draft-strict-lint.log.

The explicit migration, owned router and generic guard are unmounted in production; they were exercised only in isolated QA. The new migration has no startup import. The existing award startup patch remains unchanged and unapplied. Production still has 8 users, no managed-GAN columns/snapshot table and no QA schemas. Live bundle hash and backend PID/cwd remain unchanged. No frontend files changed in this milestone.

Remaining GAN work includes durable bulk generation, official/grantee assignments/settings, the production project model, Special Conditions/optional Direct Deposit packaging, generation/preview/signing UI, owned send/review/sign/reject/upload verification/countersign transitions, final PDF, notifications/delivery and activation. Broader imports, multi-org, budget/compliance, reimbursement/routing, design comparison and other 2.0 work remain. Draft persistence is staged progress, not completion of the full objective.


## Bulk GAN drafts and administrator screen verified

The staged /award-documents page and administrator/ISC sidebar entry implement the client Generate Award Documents concept: NOFO/template/grantee/date selection, registered officials per recipient, application checkboxes, full application numbers, project counts, amounts, readiness, missing-field correction links, a shared NOFO/program/template correction banner, draft generation, progress/retry, recent batches and authenticated PDF downloads. GAN cards in Document Templates open this generator instead of the old client-only Send operation. New visuals are isolated small files with calculations/state/data mapping in helpers and hooks.

The new durable batch plan freezes selected rows, expected document revisions, template version/hash, NOFO metadata revision, effective dates and source selections. Each ready row uses the existing atomic GAN draft transaction; blocked rows retain reasons. Bound requests process short groups until complete. Session locks prevent simultaneous runners. A failed progress write is recoverable through stable per-row request IDs. Explicit immutable retry passes attempt each unresolved row once and resume without regenerating successes. Failed row generation rolls back and does not prevent the other valid rows from saving. Successful batch results are checked against their actual snapshot revision/hash/amount/project count.

All 157 combined tests pass. Strict changed-file Node/browser lint passes; shared App/Layout/DocumentTemplates edits add no lint messages relative to the pre-change checkpoint. The build passes and new-feature type diagnostics are zero; the 1917 global baseline remains unresolved. Registered-route verification preserves all 47 baseline entries and adds only the two password routes plus /award-documents (50 total). This is source parity evidence, not QA of every old route.

Synthetic browser QA on loopback confirmed readiness (one ready, a budget mismatch and a missing FAIN), saving only the ready draft, field correction details, the downloaded PDF hash matching stored revision 1, reload restore, retry after fixing the two synthetic sources, shared-source warnings, stop-before-processing with no new snapshots, reload/resume to three revision-2 drafts while retaining all six snapshots, live saved-batch summary counts, role redirect/hidden navigation and a 390px-wide viewport with no page overflow. The stop test held a real plan response; the backend created the actual plan and processed zero rows until resume. Evidence and remaining limits are documented in docs/project/gmt-gan-bulk-drafts.md and .git/gmt-gan-bulk-browser-evidence.json. Preview/browser/schema cleanup completed.

The production index still imports none of the GAN migrations/routers. The managed-document generic guard is still not mounted there. The award startup patch remains unchanged and unapplied. No live process restart, production migration, signature, email or payment occurred; the public bundle remains unchanged. The new candidate includes a working frontend but depends on the unactivated backend and cannot be deployed alone. Full 2.0 work remains active, including permanent official/grantee configuration, projects, attachments, signing/countersignature, imports, multi-org, reimbursement/compliance, final design comparison and activation.

## Saved official and grantee settings verified

Organization Profile now saves a registered recipient official and default state grantee through an owned, scoped, revision-checked endpoint. My Organization displays read-only designations. Admin Hub contains scoped grantee contact/approver settings, with canonical registered names and an explicit print-only alternative. Existing profile saves now use the safe self-profile endpoint; the administrator account form can maintain job title.

New GANs resolve saved assignments and capture the actual contact identities and settings revisions in the immutable snapshot. Bulk plans preselect defaults and detect organization/grantee settings changes after planning. Migrations preserve legacy contact text, assign no accounts automatically, and remain unactivated in production. Generic/SQL guards protect the new assignments; legacy ISC branding updates preserve revision handling.

All 168 combined tests pass. Strict feature lint, syntax, added-line whitespace, route preservation and build checks pass. New-feature type diagnostics remain zero; the existing global baseline is 1917. Browser QA confirmed saved defaults producing a ready draft, matching actual download/storage PDF hashes, member read-only settings, safe persistent self-profile edits, updated new previews and unchanged old PDF bytes, scoped agency choices/canonical approver name and a 390px layout without overflow. The isolated preview/browser/schema were cleaned up. Production has 8 users, no new award/GAN/settings schema activation, and unchanged backend PID/live bundle.

Details and evidence are in docs/project/gmt-gan-contact-settings.md. Prior statements that assignment persistence is not implemented describe earlier milestones and are superseded by this section, in isolated QA only. The award startup patch remains pending and unapplied; source-alignment approval is not approval for this patch. Signing/countersigning, attachments, imports, project models and all broader 2.0 work remain active. This milestone is not a release or completion of the full goal.

## Private GAN attachment packages and real page previews verified

The Award Documents draft actions now open an administrator package editor with immutable NOFO Special Conditions/optional blank Direct Deposit uploads, signature page declarations, exact attachment versions, package history and authenticated PDF downloads. Saved packages retain every GAN/Project Schedule page plus selected attachments, required-return page offsets, full identifiers, PDF/manifest hashes and source versions. Atomic/retry-safe saves, revision checks, audit rollback, scope checks, SQL immutability and integrity reads preserve earlier packages after source/GAN changes. These are draft previews; no signed-upload/issuance workflow is implied.

The actual private PDFs render inside GMT through a local PDF.js worker with page controls and zoom. Native browser PDF embedding and premature render-status timing were corrected during QA. Complete final canvas bitmaps show the GAN, Conditions and flattened deposit form; Schedule placement and full project IDs are separately verified. New visuals are isolated small files with data/state/render calculations in hooks/helpers. Pinned PDF dependencies and matching licensed local library assets were added without changing existing lock entries.

All 180 combined tests pass, including 12 new package checks. Strict feature lint, syntax, added-line whitespace, build and 50-route preservation pass. New-feature type diagnostics are zero; the preexisting global count remains 1917. Browser QA confirmed required-Conditions gating, invalid page correction, real multipart upload, three/four-page package versions, old/new PDF download hashes, history reload, all-page rendering, navigation/zoom/mobile layout and recipient redirect. The isolated browser/process/schema were removed. Public still has 8 users, no new source/package/award tables and unchanged live bundle/backend PID.

Details: docs/project/gmt-gan-draft-packages.md. Evidence: .git/gmt-gan-package-browser-evidence.json, .git/gmt-gan-package-pdf-evidence.json, .git/gmt-gan-package-verification.json and .git/gmt-gan-package-live-verification.json. No approved standalone client Conditions/deposit PDFs were found in the sources checked; synthetic fixtures are explicitly marked, and real approved assets must be configured before issuance. The migration/router remain unmounted in production. The pending reviewed award startup patch is unchanged and unapplied.

Next GAN work is the owned send/review/sign/reject and signed-upload verification/countersign flow, issue/final renderer, Documents/activation, Action Items/tracker and notifications. Individual application integration, real project/import data, template publishing/defaults and the broader 2.0 work remain active. No actual GAN was sent/signed, no email was sent and no release was performed.

## Owned issuance and recipient workflow backend verified

The new unmounted GAN workflow service implements guarded send, first review/open, electronic acceptance and rejection with required notes. Sending checks the latest current draft package and authoritative source revisions. Immutable issued packages retain recorded data/attachment versions without the draft watermark. Recipient acceptance records exact package hash, registered actor, three versioned consents, name/title, observed IP and UTC time; fills blocks 10/12; and appends an evidence page. The state is RecipientSigned, pending NEMA countersignature, and fullyExecuted remains false. Rejection/regeneration/reissue retains earlier issues and evidence.

Owned serializable actions, request-key retries, revision/role checks, immutable SQL guards and deferred commit checks preserve event/state/document consistency. Audit/alert/queue failure rolls back the whole action. Private alerts use existing notifications with a user-ID guard before generic filters/limits; pending email requests are retained without provider sending. Existing rule storage controls required-party channels. Shared signing-method settings are ISC-owned and frozen per issue. Managed GANs remain blocked at owned funding submission/release until full execution; unmanaged legacy grants retain their existing path.

All 199 combined tests pass, including 19 workflow checks and a five-project signed Schedule case. Strict scoped Node lint, syntax and added-line whitespace pass. No frontend code changed, so the prior candidate build/50 routes/type baseline is retained. Actual issued/signed PDFs were parsed and rendered with complete terms, Unicode official name, UTC date, blank NEMA approval, consent/time/IP/hash evidence and complete project IDs. All owned HTTP servers/schemas were cleaned up; public remains at 8 users, no workflow tables/alert columns, and unchanged live asset/backend PID.

Details, API handoff and limits are in docs/project/gmt-gan-owned-workflow.md. Signing screens/reserved detail links are not yet wired and have not been browser-tested. Print/upload, verification, countersignature, final execution/activation, tracker/Action Items, rule/template UI and provider delivery remain unfinished. The migration/router/generic guards remain unmounted in production. No real email, signature, payment, restart or deployment occurred. The separate award startup approval is still pending, and the reviewed patch is unchanged.


## GAN Preview/Send and Review/Sign screens verified

The client Basecamp 1-B/1-D mockups and approved Figma navigation references were inspected. New isolated components connect source readiness, saved package preview, administrator issuance, recipient catalog/detail route, actual private PDF rendering/downloads, typed name/title, three unchecked consent statements, rejection with required notes and immutable activity. SHA-256 checks and actual render completion gate actions. Recipients remain pending NEMA; no award activation or provider delivery is claimed.

All 201 combined tests pass; the final backend also passes 21 focused workflow checks. Scoped strict lint, whitespace, build and preservation of all 50 old registered routes pass; one detail route is added. Global type diagnostics remain 1917, with zero in the feature. Browser QA includes successful issuance/signing/download, rejection/regeneration/reissue history, wrong/empty fields and missing consent, failed/corrupt PDF gating, administrator no-sign controls and 390px layout. Independent PDF parsing/rendering verifies signed blocks, UTC date, unchanged terms/attachments, blank NEMA approval and the consent/hash certificate.

Details and evidence: gmt-gan-workflow-screens.md and .git/gmt-gan-ui-*.json/log. The owned QA browser/process/schema were cleaned up. Production remains at eight users, no workflow tables/notification markers and unchanged original bundle/PID. Dependencies, startup, root folders and unrelated work were preserved. The reviewed award startup patch remains pending, unchanged and unapplied.

Next: private signed uploads/completeness, NEMA verification/return and countersignature, final execution/Documents/activation, Action Items/tracker, provider delivery and settings UI, approved assets, ISC imports/projects and the remaining 2.0 work. This is a staged screen milestone, not a release or completion of the full goal.


## Signed uploads, NEMA verification and approved award source wiring verified

The user explicitly approved staged Award Details wiring. The exact reviewed 60-line patch is applied to its three files after a fresh checkpoint. Actual Application API checks now cover approval creating an award snapshot, synchronized amounts/dates, preserved expenditure/balances and FAIN, non-admin award restrictions, lower-than-spent rejection and atomic audit-failure rollback. No production startup was executed.

The signed-return backend and recipient/NEMA screens implement private immutable original PDFs, explicit original-page mapping, required GAN/Conditions completeness, optional deposit, typed signer/date and unchecked confirmation. Uploaded copies go through six-check accept or note-required return, correction/resubmission, exact PDF hashes, history downloads and recorded-check display on reload. State Verified remains pending Assistant Director countersignature; funding does not open.

All 220 combined tests pass. Scoped strict lint, syntax, whitespace, candidate build and 51-route preservation pass. Global types remain at 1917 existing diagnostics, with zero feature diagnostics. Browser QA exercised the full flow twice including a fresh final candidate, negative completeness/hash/checklist/note checks, template signing modes, optional deposit, immutable downloads, 390px views and electronic-sign regression. Rendered/parsed PDFs preserve the synthetic original content and required signature pages. The existing narrow state header was observed and left outside this change.

Details: gmt-gan-signed-returns.md and gmt-award-wiring-review.md. Evidence: .git/gmt-gan-return-ui-*.json/log and .git/gmt-approved-award-wiring-verification.json. All owned QA schemas/browser/processes were removed. Production still has eight users, no award/GAN/return tables, unchanged original bundle and backend PID. GAN startup remains unmounted; no actual email, payment, restart or deployment occurred.

Next: Assistant Director countersignature, final executed PDF/Documents/award activation, Action Items/tracker, real provider delivery/settings, approved attachments and ISC imports/projects, plus the remaining 2.0 scope. The full goal remains active.
