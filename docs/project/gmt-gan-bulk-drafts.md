# Bulk GAN draft generation

Client requirements and concept screen: https://app.basecamp.com/3102765/buckets/48972825/messages/10334117050#__recording_10349618188

## Staged behavior

Award Documents is now an administrator/ISC navigation item and a guarded /award-documents page. Document Templates also opens the shared generator for GAN templates; the old client-only GAN Send path is not used. Other document types retain their existing behavior.

The generator selects a NOFO, a saved template version, a grantee, award/due dates, registered officials per recipient and application checkboxes. It shows full application numbers, project-count badges, amounts, readiness and field-level correction links. A shared-source banner groups NOFO/program/template fields that can be fixed once. Readiness checks use saved server records and the real PDF renderer. They write no documents. Each preview request checks at most 25 applications; the UI checks selected rows in groups of 20.

Creating a batch freezes its application list, expected GAN revisions, selections, effective dates, template version/body hash and NOFO award-metadata revision. Templates or NOFO metadata changed after planning block pending rows and require a reviewed new batch. New applications are not silently added to an old batch. Selected applications outside the NOFO or administrator state are rejected.

A durable runner processes up to 25 rows per request (UI: 10), saving each ready draft through the owned transaction. Invalid rows retain correction reasons. Server failures are reported without internal database details. A session advisory lock prevents two runners for one batch. If a draft commits but progress saving fails, resuming replays the same request and records its result without a duplicate snapshot.

Explicit retry passes freeze the unresolved row list and prior attempt counts. They resume across requests and attempt each unresolved row once per pass; successful rows are not regenerated. New retry passes are deliberate. Batch plans and retry selections are immutable. Progress writes and batch-row audit records commit together, and successful results must reference their own saved document revision/hash/amount/project count.

The initiator alone can read/resume a batch, with active-account/state checks repeated. ISC can create its own global batches, but does not silently impersonate another initiator. The catalog returns scoped organizations and registered official choices without password fields. A recent-batch selector and session restoration support reloading the page, while a stop control finishes the current group or leaves a newly planned batch pending.

Saved PDFs download through the authenticated owned snapshot endpoint. Generic document reads exclude PDF/snapshot blobs from their SQL projection; the managed-record guard also rejects malformed field identifiers and direct edits. The bulk response contains progress/metadata, not PDF buffers or account credentials.

## Verification and limits

All 157 combined automated tests pass. Bulk coverage includes scoped catalog, selected rows, real readiness checks without writes, blocked rows, durable chunks, explicit retry passes, frozen dates/row lists, stale template/NOFO pins, audit rollback, lost-progress recovery, per-row server failures, concurrent-run locking, owner/state/role checks, immutable plans, successful-result integrity and authenticated HTTP requests.

Browser QA used only a synthetic loopback preview and disposable database schema. It verified: Ready versus budget mismatch versus missing FAIN; one saved draft/two blocked rows; the downloaded PDF hash matching stored revision 1; reload restoration; correcting the synthetic source data and retrying to three saved drafts; shared NOFO correction labels; stopping while a real plan response was held and confirming zero rows were processed; reload/resume to revision 2 with all older snapshots retained; updated saved-batch counts; subrecipient redirect/hidden navigation; and a 390px viewport with no page-width overflow. The held plan response was a deliberate browser test gate, not a simulated generation result.

Evidence: output/playwright/gan-bulk-readiness.png, gan-bulk-blocked-results.png, gan-bulk-retry-completed.png, gan-bulk-shared-source-issue.png, gan-bulk-stopped-pending.png, gan-bulk-resumed-completed.png, gan-bulk-mobile.png and gan-bulk-browser-draft.pdf. Metadata/hash evidence is in .git/gmt-gan-bulk-browser-evidence.json. The preview process/schema were removed afterward.

The candidate build and strict changed-file Node/browser lint pass. Scoped new-feature type diagnostics are zero; 1917 preexisting/global diagnostics remain. Shared edited files add no lint diagnostics against the pre-change checkpoint. Source route parity retains all 47 baseline routes; password flows and Award Documents bring the candidate to 50. Static parity is not full-route browser QA.

Maximum batch size is 5000 applications; an oversized NOFO is rejected rather than partially planned. Readiness/generation request sizes are bounded, and the UI resumes until the plan is exhausted. Customized template bodies still require a reviewed PDF layout. Missing official/grantee configuration is not guessed or saved as an organization default. This batch selection is not the future persistent organization-assignment feature.

The migration, owned batch/draft/preview routers and generic protection remain unmounted in production. Only the explicit QA fixture invokes them. The frontend candidate must not be deployed on its own. The reviewed award startup patch remains unchanged and unapplied, and does not authorize GAN activation.

Still required: permanent official/grantee settings and assignments, the production project model, Special Conditions/Direct Deposit attachments, template publishing/custom-layout support, single-award preview/send/signing integration, owned review/reject/sign/upload verification/countersign transitions, final PDFs, notifications/delivery, design comparison and reviewed activation. The wider 2.0 imports, multi-organization, compliance, reimbursement and reporting scope remains active.
