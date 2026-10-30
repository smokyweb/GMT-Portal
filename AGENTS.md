# GMT project instructions

- GMT test is https://gmt.bluesapps.com. Customer production is https://odysseus-gap.com; they are different deployments. A GMT test release does not authorize an Odysseus release.
- Work only within the immediate request. Do not refactor, optimize, clean up, or restyle unrelated files. Ask explicitly before unrelated changes.
- Every visual element must be a small isolated file. Split any UI component over 150 lines. Keep layout/styles separate from calculations, validation, transformations and data logic in helpers or hooks.
- Before any code changes, create a local Git commit or restorable checkpoint describing the stable state. Preserve unrelated dirty, staged and untracked work. If the change fails or affects unrelated UI, automatically restore only this work's changed files from that checkpoint.
- Do not move/edit root folders, sibling apps or shared server configuration. Restart only the verified target project when the user has authorized that release.
- Read docs/project/gmt-test-release.md before building or deploying. Build from the current reviewed source, not a historical checkout or an unrelated temporary folder. Confirm that the served artifact matches the candidate.
- Keep credentials, uploads, database backups, private PDFs and QA/browser sessions out of Git. Use isolated synthetic records and simulated providers for write-heavy QA.
- Do not run seed/reset commands on an active database. Do not replay older GAN migrations individually or clear the runtime migration ledger.
- Distinguish implementation, automated testing, test deployment, live-site deployment and provider delivery in status updates. User CSV import and recipient signing are not the complete broader import and countersignature workflows.
- Do not send messages or post to Basecamp without explicit authorization.
