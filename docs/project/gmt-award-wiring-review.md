# GMT award startup wiring review

Prepared October 29, 2026. All files are inside /var/www/gmt.bluesapps.com.

The award field service and UI are implemented and tested in an isolated loopback preview. The exact reviewed patch was applied to staged source after the user explicitly approved staged award wiring. The running production process was not restarted.

The approved, applied patch is .git/gmt-award-startup-wiring.patch (SHA256 c296e13d61502745a1b76e5407dbe01b60ed199992eaf5246beae2a6e8ba83a9). It contains 60 diff lines across three files:

- server/index.js: import and mount the scoped award/NOFO APIs and call the additive award migration after the existing migrations.
- server/services/forms/applicationFormSave.js: synchronize approved application amounts/dates with the award record in the same transaction and restrict setting the award amount to administrators.
- src/pages/ApplicationReviewQueue.jsx: remove the client-side expenditure/balance reset from approval; the server hook preserves existing expenditure and derives the balance.

The migration adds optional NOFO federal metadata, a program M&A limit, a new award_details table, indexes and an idempotent migration marker. It copies values for existing approved/closed applications into separate award records without changing the existing FAIN, original application amounts or dates. The service permits an administrator to edit one award and explicitly restore inherited source values later.

Applying the patch changes staged source. No restart, deployment, live migration or server configuration change is included in this proposal. A later server restart would run the startup migrations, including this new award migration.

Automatic approval review rejected the startup wiring because it creates a persistent path to future production database changes without specific approval. The user subsequently explicitly approved this exact staged wiring. It is now applied; no alternate startup path was used. This approval does not activate the GAN migrations/routers or authorize a restart/deployment.

Checkpoints:
- .git/gmt-checkpoints/before-award-details-20261029T201628Z.tar.gz
- .git/gmt-award-stage-checkpoint.json identifies the latest tested stage.

The GAN token preparation files are independent and do not add another startup migration or send documents.

Verification after approval: 219 combined checks pass, including two added tests of the actual Application API approval/sync path, amount permissions, spending preservation and transaction rollback. Candidate build passes. Startup syntax and reverse patch check pass. No production migration or restart ran.
