# GAN draft snapshots

Requirements: https://app.basecamp.com/3102765/buckets/48972825/messages/10334117050#__recording_10349618188

## Implemented in staged source

Saving a GAN draft reloads the saved records and current administrator scope in a serializable database transaction. It validates tokens/financials and renders the checked PDF before writing the managed generated_documents row, immutable revision history and existing audit log together. Audit failure rolls everything back; no orphan files are created because draft PDF bytes are stored in PostgreSQL.

A managed GAN is unique per application. A preexisting legacy GAN blocks creation until it is reconciled, rather than creating a second GAN. A request UUID plus a fingerprint of actor/application/revision/selections makes retries idempotent. Reusing a key with different selections is rejected. Concurrent or stale saves return 409. Explicit regeneration is permitted for Draft or Rejected status and preserves every earlier revision. Sent GANs cannot be regenerated.

Each revision stores merged text, token values, source IDs, project allocations, template text/version/hash, PDF bytes/hash, body hash, generated actor and time. Database triggers check the hashes and source identity and prohibit generic managed-record writes, status forging, deletion and history changes. Reads verify stored bytes and hashes and return the saved revision; they do not re-merge current records. Recipient reassignment requires reconciliation.

The unmounted owned router provides draft POST, snapshot/history GET and PDF GET factories. Unsent drafts are visible to scoped administrators only. Recipients/reviewers cannot generate a draft. A generic-entity guard factory blocks managed writes and new GAN creation outside the owned workflow. It handles generated-document reads with a metadata projection that excludes PDF bytes and snapshot JSON; scope filtering happens before the list limit. Existing legacy document rows retain their previous behavior. This guard must be mounted before the generic entity router when the feature is activated.

## Not activated

The new migration, owned router and generic guard are not imported or mounted by production startup. Only disposable QA schemas have run the migration or stored these test drafts. The reviewed award startup patch remains unapplied. This migration/guard/router must not be activated independently of the completed document workflow and its reviewed release plan.

All saved PDFs remain draft previews marked NOT SENT OR EXECUTED. There is no send transition, signature operation, email delivery, Special Conditions attachment, bulk-generation UI or final executed PDF in this milestone. The migration currently blocks ad hoc managed status changes; the future owned status workflow must extend the database guard together with the required checks. Official/grantee persistence and the production project model are also still pending.

The sent-state immutability test simulates a future transition only inside its explicitly guarded disposable schema. It does not verify a real send, a signed PDF or recipient delivery.

## Verification

From server/: node --test tests/*.test.mjs

The added draft suite covers atomic persistence and audit rollback, idempotent retries, prior-version reads after source edits, regeneration history, concurrent/stale saves, administrator and recipient boundaries, invalid source data/payloads, direct SQL protection, corrupted PDF reads, legacy duplication prevention, organization reassignment, private authenticated HTTP reads, generic metadata/filter projection and a simulated sent-state freeze.

Logs: .git/gmt-gan-draft-tests.log and .git/gmt-combined-gan-draft-tests.log. Strict Node lint: .git/gmt-gan-draft-strict-lint.log. No frontend code changed in this step.
