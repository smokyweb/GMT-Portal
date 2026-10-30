# GAN PDF preview implementation

Client requirements and layout: https://app.basecamp.com/3102765/buckets/48972825/messages/10334117050#__recording_10349618188

## What is implemented

The internal renderer creates the client's thirteen-block Letter-size GAN layout for the four prepared EMPG, NSGP, SHSP and SLCGP templates. It uses the existing project jsPDF dependency and embedded DejaVu fonts with their redistribution license. Layout modules are isolated by identity, awards, terms, acceptance, tables and project schedule; data/model checks are separate.

One through four projects appear in block 5 with full application project IDs and federal/match allocations. Above four projects, block 5 references an attached one-page Project Schedule that contains every project and reconciled totals. Text wraps and measured cells grow. Content that will not fit the required readable page raises a 422 error, rather than truncating content, shrinking it indefinitely or silently adding pages. Unsupported font characters also raise a visible error. Latin accents are preserved.

The return value includes PDF bytes, a SHA-256 PDF hash, merged body and its hash, template body hash, saved template version, page count and package parts. Stable source values produce stable preview bytes. Every page says DRAFT PREVIEW - NOT SENT OR EXECUTED. The result explicitly says readyForSending=false and identifies Special Conditions as a required attachment.

The factory in server/routes/ganPreview.js exposes authenticated JSON and PDF POST previews only when explicitly mounted by a caller. It calls the saved-record loader afresh for each request. Administrators are checked against current database identity/state and the recipient organization. The JSON response omits the raw template body. PDF responses use private/no-store caching, nosniff and explicit preview/hash/version headers.

The production index does not import or mount this factory. No document, email, signature, award status or audit record is written by previewing. The existing pending award startup wiring patch is unchanged and remains unapplied.

## Current limits and remaining work

The PDF layout accepts the four reviewed prepared reference bodies exactly. A changed contractual body is rejected pending layout review, so additional terms cannot disappear silently. A future template builder must provide a reviewed rendering path for its customized bodies.

Official/grantee selections remain preview-only. Their persistence/configuration screens and required new fields still need implementation. The application_projects loader contract is preparatory; the production project model is not implemented. QA fixtures exercise these future fields only inside a disposable schema.

Approved Special Conditions and optional Direct Deposit packages must still be attached and checked. Immutable snapshot persistence, generation/send transactions, single/bulk generation UI, recipient signing/rejection, upload verification, NEMA countersignature, audit, notifications and delivery remain. A preview response must never be accepted as authority for issuance; generation must load, authorize and lock its records again.

## Verification

Run tests from the server directory:
    node --test tests/*.test.mjs

The PDF inspection tests require project-local QA dependencies; these are not runtime dependencies:
    python3 -m pip install --no-cache-dir --target .git/gmt-qa-python pypdfium2==4.30.0 Pillow==11.3.0

Run that installation command from the GMT project directory, not server/. It does not require OS packages or changes to server configuration.

Manual preview generation from server/:
    node tests/render-gan-previews.mjs

Evidence files live under output/pdf/ and include six QA PDFs, their current hash/page manifest, rendered pages and extracted text. The scenario with five projects is a two-page package: one GAN plus one schedule. Four projects with long agency/organization names still fit one GAN page. Automated checks inspect actual PDF text/page bounds, all thirteen blocks, full IDs, Unicode names, program conditions, currency totals, overflow failures, metadata tampering and stable hashes.

Current combined suite: 129 passing tests. Strict recommended Node lint passes for the changed preview/renderer/context/test files. No frontend files changed in this milestone; the existing frontend candidate is retained. The global frontend type baseline remains unresolved and is not claimed to pass.
