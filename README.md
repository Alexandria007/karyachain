# KaryaChain

> Creator-owned content storage and cryptographic provenance for the Aptos and Shelby ecosystem.

[![Network](https://img.shields.io/badge/network-Aptos%20%2B%20Shelby%20shelbynet-c9a84c)](https://docs.shelby.xyz/protocol/architecture/networks)
[![Built with](https://img.shields.io/badge/built%20with-React%20%2B%20TypeScript-61dafb)](https://react.dev/)
[![Storage](https://img.shields.io/badge/storage-Shelby%20Protocol-111111)](https://shelby.xyz/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

KaryaChain is a decentralized creator-content MVP that combines Aptos identity and transaction finality with Shelby's verifiable hot storage. Creators can upload writing, music, images, video, and other files, then receive a receipt containing the Aptos transaction, Shelby blob metadata, expiration, size, and Merkle root.

The current application is intentionally shelbynet-scoped. It demonstrates a real upload and verification path, but it does not claim permanent storage, legal copyright registration, mainnet readiness, or protocol-enforced premium access. Premium payments are now verified against finalized Aptos transactions, while raw Shelby reads remain public in this browser-first MVP.

## Product thesis

Centralized platforms usually own the storage account, the access path, and the only practical evidence of when content was uploaded. KaryaChain moves the core storage and provenance path into infrastructure that a creator can inspect:

1. The creator connects an Aptos wallet and signs the registration transaction.
2. The file commitment and `shelbynet-1` location are registered on Aptos.
3. The exact committed bytes are uploaded to Shelby through the SDK protocol chunkset RPC.
4. The storage-provider acknowledgements are submitted in a second `commit_object` transaction signed by the creator.
5. The client reads the committed object back and verifies metadata, byte length, expiration, and Merkle-root consistency.
6. The creator receives a portable proof receipt that can be inspected through Aptos and Shelby explorers.

This is cryptographic evidence of a wallet-controlled upload and content commitment. It is not, by itself, a court-recognized copyright certificate.

## Feature status

### Live in the current shelbynet MVP

| Feature | Status | What is implemented |
| --- | --- | --- |
| Aptos wallet connection | Live | Aptos Wallet Adapter with shelbynet configuration and connected-account state. |
| Shelby shelbynet client | Live | Browser Shelby SDK client configured for Aptos/Shelby shelbynet. |
| Real file upload | Live | Files are read in the browser, erasure-coded commitments are generated, and the exact bytes are sent to Shelby through the SDK protocol chunkset RPC. |
| Aptos registration | Live | Blob name, Merkle root, chunkset count, size, encoding, 30-day expiration, and the `shelbynet-1` location are registered through a signed Aptos transaction. |
| Transaction finality | Live | The app waits for successful registration finality, then requires a second signed `commit_object` transaction after storage-provider acknowledgements. |
| Post-upload verification | Live | The app checks committed metadata readability, size, future expiration, RPC content length, downloaded stream length, and Merkle-root consistency. |
| Proof receipt | Live | The success state shows blob name, stored size, Merkle root, expiration, Aptos transaction hash, and explorer links. |
| Duplicate-name protection | Live | Existing non-deleted blob metadata is checked before registration. |
| My Works | Live | Connected creators can query their readable, non-deleted, non-expired blobs through the current shelbynet metadata adapter. |
| Explore | Live | Users can browse readable blobs, search by name/address, filter by file category, and paginate the client-side result set. |
| Authenticated downloads | Live | Dashboard and Explore downloads use the authenticated Shelby SDK read path and create a local browser download. |
| Image previews | Live | Image previews are fetched through authenticated Shelby reads; locked premium previews are not fetched. |
| Shelby explorer links | Live | Blob cards and receipts link to the Shelby shelbynet Explorer. |
| Responsive navigation | Live | Home, Upload, My Works, and Explore views share responsive navigation with mobile menu behavior. |
| User feedback | Live | Upload progress, errors, download feedback, and other transient messages are surfaced in the UI. |

### Experimental or partially implemented

| Feature | Status | Current implementation and limitation |
| --- | --- | --- |
| Premium pricing | Live metadata / experimental product | Creators set a price during upload. The canonical eight-decimal ShelbyUSD amount is embedded in the KaryaChain v2 blob name; v1 names remain readable through a compatibility conversion. Existing blob names are immutable, so changing price requires a new upload/version. |
| ShelbyUSD payment | Live transaction verification | Buyers submit a primary fungible-asset transfer on shelbynet. The app waits for Aptos finality and verifies sender, ShelbyUSD metadata address, creator recipient, blob price, and exact amount before granting an app entitlement. |
| Premium app access | Application-level gate | Explore hides previews and download controls until the verified payment receipt is present. The receipt is revalidated from Aptos on a later load. This is not protocol-level authorization: Shelby's public read path can still be accessed outside KaryaChain. |
| Category metadata | Live | Upload selection is encoded as writing, music, photo, video, or other in the versioned KaryaChain blob name (new uploads use v2; v1 names remain supported). Explore filters and My Works badges read this metadata; legacy/plain blob names use a filename fallback. |
| Creator monetization | Prototype | Payments go directly to the blob owner; there is no backend marketplace, escrow, refund, revenue split, royalty accounting, or cross-device entitlement service yet. |
### Not yet production-ready

- Mainnet deployment and production network configuration.
- Permanent or archival storage guarantees.
- Legal copyright registration or identity verification.
- Server-side or protocol-level premium entitlements that cannot be bypassed by direct reads.
- Upload size/type policies, resumable uploads, cancellation, retries, and granular progress reporting.
- Server-side pagination and indexing for large Explore collections.
- Automated unit, integration, and browser end-to-end test coverage.
- Bundle/code-splitting optimization for the current large browser bundle.
- A backend service for policy enforcement, payment reconciliation, moderation, analytics, or creator account management.

## Upload lifecycle

A successful upload follows this sequence:

```text
Connect wallet
    ->
Read file bytes in the browser
    ->
Generate erasure-coded commitments and the blob Merkle root
    ->
Check for an existing blob with the same name
    ->
Sign and submit the Aptos registration transaction
    ->
Wait for successful Aptos finality and extract the registered blob UID
    ->
Upload the exact committed bytes as Shelby chunksets
    ->
Validate storage-provider acknowledgements
    ->
Sign and submit the Aptos `commit_object` finalization transaction
    ->
Wait for final commit finality
    ->
Read Shelby metadata and the authenticated blob stream
    ->
Verify committed metadata, size, expiration, download length, and Merkle root
    ->
Display the proof receipt
```

The UI does not display upload success merely because a wallet transaction was submitted. A successful transaction, a Shelby write, and the read-back checks are all required.

## Proof receipt

The receipt is generated only after the verification stage succeeds. It currently contains:

- Blob name, including versioned category and access-price metadata.
- Stored byte size.
- Shelby-returned Merkle root.
- Shelby-returned expiration timestamp.
- Aptos registration transaction hash.
- Category and free/premium status shown in the UI.
- Links to Aptos Explorer and Shelby Explorer.

The receipt is a client-side presentation of verifiable references. It is not an independent notarization service and should not be marketed as legal proof of copyright ownership without additional legal and identity infrastructure.

## Storage and read model

KaryaChain uses the official Shelby client and authenticated RPC reads rather than unauthenticated raw blob URLs for application reads:

- `src/lib/shelby.ts` creates the shared Aptos and Shelby shelbynet clients and contains the typed adapter for the current shelbynet GraphQL schema.
- `src/hooks/useShelby.ts` loads typed `FullObjectMetadata` records and filters deleted and expired objects.
- `downloadShelbyBlob` reads the authenticated Shelby RPC stream and turns it into a browser `Blob`.
- `ShelbyImagePreview` uses the same authenticated read model for image previews.
- My Works and Explore use object metadata as the source of display name, owner, size, expiration, status, category, and premium price.

## Architecture

| Layer | Technology | Responsibility |
| --- | --- | --- |
| UI | React 19 + TypeScript | Navigation, upload form, receipts, dashboards, Explore, and feedback states. |
| Build | Vite 8 | Development server, production bundling, and deployment build. |
| Wallet | Aptos Wallet Adapter | Wallet discovery, connection, account identity, and transaction signing. |
| Blockchain | `@aptos-labs/ts-sdk` | Aptos shelbynet client and transaction finality checks. |
| Storage | `@shelby-protocol/sdk` | Commitments, blob metadata, authenticated reads, and blob upload RPC. |
| Data fetching | TanStack Query | Cached account-blob queries and refresh behavior. |
| Styling | Tailwind CSS + component styles | Dark creator-focused interface with gold visual accent. |
| Deployment | Vercel-compatible Vite output | Static frontend deployment. |

The current application is a browser-first MVP. API keys and network calls are therefore part of the frontend runtime configuration; do not place private signing keys or other secrets in Vite environment variables.

## Network scope

The source currently uses:

- Aptos `Network.SHELBYNET`.
- Shelby `Network.SHELBYNET`.
- A default upload expiration of 30 days.
- Aptos API access through `VITE_APTOS_API_KEY` when configured.

Shelbynet is a developer prototype network; its data, availability, rate limits, pricing, and protocol behavior can change, and the network may be wiped periodically. The application should be treated as a review/demo environment until a production network and retention policy are explicitly selected.

## Getting started

### Requirements

- Node.js 22 or newer.
- npm.
- An Aptos-compatible browser wallet such as Petra.
- An Aptos/Geomi API key with shelbynet access.

### Install

```bash
git clone https://github.com/Alexandria007/karyachain.git
cd karyachain
npm install --legacy-peer-deps
```

### Configure the environment

Create a local environment file from the example:

```bash
# macOS/Linux
cp env.example .env.local

# Windows PowerShell
Copy-Item env.example .env.local
```

Set the variable in `.env.local`:

```env
VITE_APTOS_API_KEY=aptoslabs_your_api_key_here
```

Get an Aptos API key from [Geomi](https://geomi.dev/). Environment files containing local credentials are ignored by Git; never commit a real key.

### Run locally

```bash
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

### Validate the project

```bash
npm run lint
npm run build
```

The production build currently completes successfully. Vite may report a large-chunk warning; this is a known performance follow-up.

## Repository structure

```text
src/
├── components/
│   ├── Explore.tsx              # Public blob discovery and premium demo UI
│   ├── Header.tsx               # Navigation and wallet connection
│   ├── Hero.tsx                 # Product introduction
│   ├── MyWorks.tsx              # Creator dashboard and downloads
│   ├── ShelbyImagePreview.tsx   # Authenticated image preview
│   ├── Toast.tsx                # User feedback container
│   └── UploadSection.tsx        # Register, upload, verify, and receipt flow
├── hooks/
│   ├── usePremium.ts            # ShelbyUSD transfer verification and app entitlements
│   └── useShelby.ts             # Typed Shelby metadata queries
├── lib/
│   ├── karyaMetadata.ts         # Versioned category/price blob-name metadata
│   ├── shelby.ts                # Shared Aptos/Shelby clients and downloads
│   └── toast.ts                 # Toast event bus
├── providers/
│   └── AppProviders.tsx         # React Query and Aptos wallet providers
├── polyfills.ts                  # Browser compatibility globals for Shelby SDK
├── App.tsx                      # Page-level application shell
├── App.css                      # Application styles
└── main.tsx                     # Browser entry point
```

## Security and product boundaries

- Never commit `.env`, `.env.local`, API keys, private keys, seed phrases, or wallet secrets.
- The frontend cannot provide secure server-side authorization by itself.
- The app entitlement is backed by a verified Aptos payment receipt, but it is still client-side and must not be described as censorship-resistant access control.
- shelbynet expiration must not be described as permanent retention.
- A blob Merkle root proves consistency with the registered commitment; it does not prove who authored the underlying work in a legal sense.
- Before production, add a threat model, rate limiting, upload policy, abuse handling, payment reconciliation, and a protocol-enforced entitlement design.

## Roadmap

### Provenance and verification

- Add a public proof resolver that can independently load an Aptos registration and Shelby metadata by receipt.
- Add timestamp, owner, creation, category, price, and expiration details to a shareable receipt page.
- Add a version relation so creators can publish a new priced/category-tagged revision without ambiguity.

### Premium content

- Move entitlement records to a backend or Aptos access-control contract that can be checked across devices.
- Encrypt premium payloads before public Shelby storage and release decryption capability only after verified entitlement.
- Add refunds, replay protection, payment reconciliation, and creator revenue reporting.
- Prevent unauthorized direct reads through the chosen encrypted storage/access architecture.

### Reliability and operations

- Add file size/type validation, cancellation, retries, and resumable upload support.
- Add automated tests and browser smoke tests for wallet, registration, upload, verification, download, payment, and error paths.
- Add server-side indexing/pagination and observability for larger creator collections.
- Split the browser bundle and lazy-load heavy upload/storage modules.

### Network maturity

- Define a mainnet configuration and migration process.
- Replace the fixed demo retention policy with an explicit creator-selected storage policy.
- Document operational ownership, incident response, data recovery, and abuse handling.
## Review checklist

For a Shelby review, validate the following in a connected browser session:

- Wallet connects to Aptos shelbynet.
- A small image or text file can be uploaded.
- Aptos registration reaches successful finality.
- Shelby upload reaches the verification state and ends with a proof receipt.
- The receipt Merkle root and transaction hash are inspectable.
- The same blob appears in My Works and can be downloaded.
- The blob appears in Explore when its metadata is readable and not expired.
- A premium purchase is tested with a real ShelbyUSD transfer; the UI verifies finality and exact payment fields.
- Reviewers understand that KaryaChain app gating is not protocol-enforced while Shelby raw reads remain public.
- Category filters and the My Works monetization-status dialog read from the blob metadata rather than local-only price state.

## References

- [Aptos React Quick Start](https://js-pro.aptos.dev/react/introduction/quick-start)
- [Aptos Wallet Adapter DApp Guide](https://aptos.dev/build/sdks/wallet-adapter/dapp)
- [Shelby Protocol](https://docs.shelby.xyz/protocol)
- [Shelby TypeScript SDK](https://docs.shelby.xyz/sdks/typescript)
- [Shelby Networks](https://docs.shelby.xyz/protocol/architecture/networks)
- [Shelby React `useUploadBlobs`](https://docs.shelby.xyz/sdks/react/mutations/use-upload-blobs)
- [Shelby React DApp Example](https://docs.shelby.xyz/sdks/react/guides/dapp-example)
- [Geomi](https://geomi.dev/)

## License

MIT
