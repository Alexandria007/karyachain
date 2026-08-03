# KaryaChain

> Creator-owned content storage and cryptographic provenance for the Aptos and Shelby ecosystem.

[![Network](https://img.shields.io/badge/network-Aptos%20%2B%20Shelby%20Testnet-c9a84c)](https://aptos.dev/network/testnet)
[![Built with](https://img.shields.io/badge/built%20with-React%20%2B%20TypeScript-61dafb)](https://react.dev/)
[![Storage](https://img.shields.io/badge/storage-Shelby%20Protocol-111111)](https://shelby.xyz/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

KaryaChain is a decentralized creator-content MVP that combines Aptos identity and transaction finality with Shelby's verifiable hot storage. Creators can upload writing, music, images, video, and other files, then receive a receipt containing the Aptos transaction, Shelby blob metadata, expiration, size, and Merkle root.

The current application is intentionally testnet-scoped. It demonstrates a real upload and verification path, but it does not claim permanent storage, legal copyright registration, mainnet readiness, or protocol-enforced premium access.

## Product thesis

Centralized platforms usually own the storage account, the access path, and the only practical evidence of when content was uploaded. KaryaChain moves the core storage and provenance path into infrastructure that a creator can inspect:

1. The creator signs with an Aptos wallet.
2. The file commitment is registered on Aptos.
3. The exact file bytes are uploaded to Shelby.
4. The client reads the stored object back and verifies the returned metadata and Merkle root.
5. The creator receives a portable proof receipt that can be inspected through Aptos and Shelby explorers.

This is cryptographic evidence of a wallet-controlled upload and content commitment. It is not, by itself, a court-recognized copyright certificate.

## Feature status

### Live in the current testnet MVP

| Feature | Status | What is implemented |
| --- | --- | --- |
| Aptos wallet connection | Live | Aptos Wallet Adapter with testnet configuration and connected-account state. |
| Shelby testnet client | Live | Browser Shelby SDK client configured for Aptos/Shelby Testnet. |
| Real file upload | Live | Files are read in the browser, commitment data is generated, and the exact bytes are sent to Shelby RPC. |
| Aptos registration | Live | Blob name, Merkle root, chunkset count, size, encoding, and 30-day expiration are registered through a signed Aptos transaction. |
| Transaction finality | Live | The app waits for the Aptos transaction and requires a successful result before continuing to Shelby upload. |
| Post-upload verification | Live | The app checks metadata readability, `isWritten`, size, future expiration, RPC content length, downloadable stream length, and Merkle-root consistency. |
| Proof receipt | Live | The success state shows blob name, stored size, Merkle root, expiration, Aptos transaction hash, and explorer links. |
| Duplicate-name protection | Live | Existing non-deleted blob metadata is checked before registration. |
| My Works | Live | Connected creators can query their readable, written, non-deleted, non-expired blobs. |
| Explore | Live | Users can browse readable blobs, search by name/address, filter by file category, and paginate the client-side result set. |
| Authenticated downloads | Live | Dashboard and Explore downloads use the authenticated Shelby SDK read path and create a local browser download. |
| Image previews | Live | Image previews are fetched through authenticated Shelby reads; locked premium previews are not fetched. |
| Shelby explorer links | Live | Blob cards and receipts link to the Shelby Testnet Explorer. |
| Responsive navigation | Live | Home, Upload, My Works, and Explore views share responsive navigation with mobile menu behavior. |
| User feedback | Live | Upload progress, errors, download feedback, and other transient messages are surfaced in the UI. |

### Experimental or partially implemented

| Feature | Status | Current limitation |
| --- | --- | --- |
| Premium pricing | Experimental | Creators can label a blob with a SUSD price. The price is encoded in the blob name or stored in browser-local state. |
| ShelbyUSD payment | Experimental | The buyer can submit a ShelbyUSD transfer and the app waits for Aptos finality. |
| Premium access control | Not protocol-enforced | Access grants are stored in `localStorage`; a client-side flag cannot prevent a direct read from a public/client-accessible storage path. |
| Category selection | UI-only | The upload form lets users choose a category, but the selected category is not currently persisted as Shelby metadata. Explore categorization is inferred from filenames/extensions. |
| Creator monetization | Prototype | Payment and price UI demonstrate the intended flow but are not a production marketplace, escrow, entitlement, or revenue-sharing system. |

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
    ↓
Read file bytes in the browser
    ↓
Generate erasure-coded commitments and the blob Merkle root
    ↓
Check for an existing blob with the same name
    ↓
Sign and submit the Aptos registration transaction
    ↓
Wait for successful Aptos finality
    ↓
Upload the exact committed bytes to Shelby RPC
    ↓
Read Shelby metadata and the authenticated blob stream
    ↓
Verify written state, size, expiration, download length, and Merkle root
    ↓
Display the proof receipt
```

The UI does not display upload success merely because a wallet transaction was submitted. A successful transaction, a Shelby write, and the read-back checks are all required.

## Proof receipt

The receipt is generated only after the verification stage succeeds. It currently contains:

- Blob name.
- Stored byte size.
- Shelby-returned Merkle root.
- Shelby-returned expiration timestamp.
- Aptos transaction hash.
- Links to Aptos Explorer and Shelby Explorer.

The receipt is a client-side presentation of verifiable references. It is not an independent notarization service and should not be marketed as legal proof of copyright ownership without additional legal and identity infrastructure.

## Storage and read model

KaryaChain uses Shelby's browser SDK rather than unauthenticated raw blob URLs for application reads:

- `src/lib/shelby.ts` creates the shared Aptos and Shelby Testnet clients.
- `src/hooks/useShelby.ts` loads typed `BlobMetadata` records and filters deleted, unwritten, and expired objects.
- `downloadShelbyBlob` reads the authenticated Shelby RPC stream and turns it into a browser `Blob`.
- `ShelbyImagePreview` uses the same authenticated read model for image previews.
- `My Works` and `Explore` use object metadata as the source of display name, owner, size, expiration, and status.

## Architecture

| Layer | Technology | Responsibility |
| --- | --- | --- |
| UI | React 19 + TypeScript | Navigation, upload form, receipts, dashboards, Explore, and feedback states. |
| Build | Vite 8 | Development server, production bundling, and deployment build. |
| Wallet | Aptos Wallet Adapter | Wallet discovery, connection, account identity, and transaction signing. |
| Blockchain | `@aptos-labs/ts-sdk` | Aptos Testnet client and transaction finality checks. |
| Storage | `@shelby-protocol/sdk` | Commitments, blob metadata, authenticated reads, and blob upload RPC. |
| Data fetching | TanStack Query | Cached account-blob queries and refresh behavior. |
| Styling | Tailwind CSS + component styles | Dark creator-focused interface with gold visual accent. |
| Deployment | Vercel-compatible Vite output | Static frontend deployment. |

The current application is a browser-first MVP. API keys and network calls are therefore part of the frontend runtime configuration; do not place private signing keys or other secrets in Vite environment variables.

## Network scope

The source currently uses:

- Aptos `Network.TESTNET`.
- Shelby `Network.TESTNET`.
- A default upload expiration of 30 days.
- Aptos API access through `VITE_APTOS_API_KEY` when configured.

Testnet data, availability, rate limits, pricing, and protocol behavior can change. The application should be treated as a review/demo environment until a production network and retention policy are explicitly selected.

## Getting started

### Requirements

- Node.js 22 or newer.
- npm.
- An Aptos-compatible browser wallet such as Petra.
- An Aptos/Geomi API key for Testnet access.

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
│   ├── usePremium.ts            # Experimental SUSD payment/local access state
│   └── useShelby.ts             # Typed Shelby metadata queries
├── lib/
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
- Premium labels and local access state must not be described as censorship-resistant access control.
- Testnet expiration must not be described as permanent retention.
- A blob Merkle root proves consistency with the registered commitment; it does not prove who authored the underlying work in a legal sense.
- Before production, add a threat model, rate limiting, upload policy, abuse handling, payment reconciliation, and a protocol-enforced entitlement design.

## Roadmap

### Provenance and verification

- Add a public proof resolver that can independently load an Aptos registration and Shelby metadata by receipt.
- Persist creator metadata and category in a versioned on-chain or verifiable off-chain schema.
- Add timestamp, owner, creation, and expiration details to a shareable receipt page.

### Premium content

- Replace browser-local access state with a verifiable entitlement or capability mechanism.
- Reconcile payment events against the intended blob and price.
- Prevent unauthorized direct reads through the chosen storage/access architecture.

### Reliability and operations

- Add file size/type validation, cancellation, retries, and resumable upload support.
- Add automated tests and browser smoke tests for wallet, registration, upload, verification, download, and error paths.
- Add server-side indexing/pagination and observability for larger creator collections.
- Split the browser bundle and lazy-load heavy upload/storage modules.

### Network maturity

- Define a mainnet configuration and migration process.
- Replace the fixed demo retention policy with an explicit creator-selected storage policy.
- Document operational ownership, incident response, data recovery, and abuse handling.

## Review checklist

For a Shelby review, validate the following in a connected browser session:

- Wallet connects to Aptos Testnet.
- A small image or text file can be uploaded.
- Aptos registration reaches successful finality.
- Shelby upload reaches the verification state and ends with a proof receipt.
- The receipt Merkle root and transaction hash are inspectable.
- The same blob appears in My Works and can be downloaded.
- The blob appears in Explore when its metadata is readable and not expired.
- Premium behavior is reviewed as experimental and not protocol-enforced.

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
