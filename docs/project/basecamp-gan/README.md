# Client GAN source files and prepared bodies

Source: [Lauren's reference templates](https://app.basecamp.com/3102765/buckets/48972825/messages/10347763710#__recording_10349650669).

[Detailed token and workflow requirements](https://app.basecamp.com/3102765/buckets/48972825/messages/10334117050#__recording_10349618188) and [client priorities](https://app.basecamp.com/3102765/buckets/48972825/messages/10351366111#__recording_10351911537).

The four Markdown files in this folder preserve the client-provided text returned by the Basecamp connector. They contain fixed FY2025/FY2023 and federal award examples. These historical source copies must not be sent as current generated GANs.

Prepared bodies under server/templates/gan replace record-specific years, identifiers, federal data, cost-share fields, indirect-rate/R&D statements and payment method with record tokens. They add project breakdown placement while preserving the thirteen numbered blocks and client-provided program terms. The transformation is in src/lib/documents/ganTemplateBody.js.

The pure token resolver and financial checks are implemented and tested. These files have not been published to the template library, used to generate official PDFs, or connected to sending/signature workflows. One-page PDF layout, Project Schedule attachment generation, Special Conditions packaging, immutable snapshot storage, template versions, scoped routing and delivery remain required.
