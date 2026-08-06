# KaryaChain

> Creator-owned content storage and cryptographic provenance for the Aptos and Shelby ecosystem.

[![Network](https://img.shields.io/badge/network-Aptos%20%2B%20Shelby%20shelbynet-c9a84c)](https://docs.shelby.xyz/protocol/architecture/networks)
[![Built with](https://img.shields.io/badge/built%20with-React%20%2B%20TypeScript-61dafb)](https://react.dev/)
[![Storage](https://img.shields.io/badge/storage-Shelby%20Protocol-111111)](https://shelby.xyz/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/Alexandria007/karyachain/actions/workflows/ci.yml/badge.svg)](https://github.com/Alexandria007/karyachain/actions/workflows/ci.yml)

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
| Proof receipt | Live | The success state shows blob name, stored size, Merkle root, expiration, registration/final-commit Aptos transaction hashes when available, and explorer links. |
| Duplicate-name protection | Live | Existing non-deleted blob metadata is checked before registration. |
| Durable work revisions | Live foundation | First publications use KaryaChain v2 metadata; revision 2+ publications use a v3 revision marker in the Shelby blob name and remain independently readable. |
| My Works | Live | Connected creators can query their readable, non-deleted, non-expired blobs through the current shelbynet metadata adapter. |
| Explore | Live | Users can browse readable blobs, search by name/address, filter by file category, and load bounded pages from the Shelby metadata indexer. |
| Authenticated downloads | Live | Dashboard and Explore downloads use the authenticated Shelby SDK read path and create a local browser download. |
| Image previews | Live | Image previews are fetched through authenticated Shelby reads; locked premium previews are not fetched. |
| Shelby explorer links | Live | Blob cards and receipts link to the Shelby shelbynet Explorer. |
| Responsive navigation | Live | Home, Upload, My Works, and Explore views share responsive navigation with mobile menu behavior. |
| User feedback | Live | Upload progress, errors, download feedback, and other transient messages are surfaced in the UI. |
| Creator activity | Browser-local | Upload, download, and purchase events are shown in My Works for this browser; durable cross-device analytics is not live. |

### Experimental or partially implemented

| Feature | Status | Current implementation and limitation |
| --- | --- | --- |
| Premium pricing | Live metadata / experimental product | Creators set a price during upload. The canonical eight-decimal ShelbyUSD amount is embedded in the KaryaChain v2 blob name for first publications; revision 2+ names use v3 metadata. v1 names remain readable through a compatibility conversion. Existing blob names are immutable, so changing price requires a new upload/version. |
| ShelbyUSD payment | Live transaction verification; registry mode available | Public mode verifies a direct ShelbyUSD transfer after Aptos finality. Configured registry mode uses the exact on-chain purchase entry function and entitlement path. |
| Payment replay guard | Browser-local hardening | A verified payment tx is locally bound to one buyer, creator, work, and amount so the same receipt cannot unlock a different work in this browser. Protocol-level reconciliation is not live. |
| Premium app access | Application-level gate | Explore hides previews and download controls until the verified payment receipt is present. The receipt is revalidated from Aptos on a later load. This is not protocol-level authorization: Shelby's public read path can still be accessed outside KaryaChain. |
| Category metadata | Live | Upload selection is encoded as writing, music, photo, video, or other in the versioned KaryaChain blob name (first uploads use v2; revisions use v3; v1 names remain supported). Explore filters and My Works badges read this metadata; legacy/plain blob names use a filename fallback. |
| Creator monetization | Prototype; registry mode available | Public mode pays the creator directly without escrow, refunds, royalties, or reconciliation. Registry mode adds an atomic on-chain purchase and cross-device entitlement, but the marketplace policy is still intentionally minimal. |
| KaryaRegistry Move foundation | Source/test complete; optional private-mode integration | move/karya_registry defines on-chain work records, revision lineage, exact-asset purchase, encrypted key-envelope references, entitlement, and audit events. The React integration is behind VITE_KARYA_REGISTRY_ADDRESS; it is not active on the public Vercel deployment until a real module is published and configured. |

### Not yet production-ready

- Mainnet deployment and production network configuration.
- Permanent or archival storage guarantees.
- Legal copyright registration or identity verification.
- Public compatibility mode does not prevent direct Shelby reads; private registry mode encrypts new premium uploads and releases keys only after entitlement plus wallet proof.
- Resumable uploads, cancellation, automatic storage-stage retries, and production-scale upload policy.
- Server-side creator indexing and observability for large Explore collections.
- Unit coverage exists for metadata, payments, diagnostics, Shelby payloads, runtime config, and browser encryption; browser E2E still requires a wallet-enabled test harness.
- Further bundle optimization and browser performance measurement on real mobile hardware.
- Durable reconciliation, refunds, royalty splits, moderation, analytics, and creator account management.

## Optional private-environment mode

The repository now contains a deployment-ready P2 path that is disabled unless VITE_KARYA_REGISTRY_ADDRESS is configured:

- premium files are encrypted in the browser with AES-256-GCM before Shelby upload;
- a serverless key-envelope endpoint wraps the per-work key without placing the raw key in Aptos;
- publish_work anchors the Shelby blob commitment, revision lineage, price/currency, and encrypted envelope;
- purchase performs the exact registered ShelbyUSD transfer and records an Aptos entitlement;
- Explore and My Works read entitlement from Aptos for cross-device access;
- a key-release endpoint verifies the Aptos wallet signature, active work, expiry, and entitlement before returning a no-store key release;
- Aptos Indexer events are displayed as a canonical registry activity read model.

This path is source-implemented and tested locally, but it is not claimed as live until the Shelby/private network module is deployed and both browser and server environment variables are configured. Existing plaintext MVP uploads remain plaintext and must be re-uploaded in private mode if confidentiality is required.

See docs/private-environment-deployment.md and docs/premium-architecture.md for the exact deployment boundary and verification checklist.

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
- Registration and final-commit Aptos transaction hashes when the proof originates from the upload receipt.
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

The source uses environment-driven runtime configuration with review-safe defaults:

- Aptos and Shelby use shelbynet by default; the SDK network is selected from VITE_SHELBY_NETWORK.
- The default Shelby location is shelbynet-1.
- Shelby RPC and GraphQL endpoints can be overridden with VITE_SHELBY_RPC_URL and VITE_SHELBY_INDEXER_URL.
- Aptos fullnode and indexer endpoints can be overridden with VITE_APTOS_FULLNODE_URL and VITE_APTOS_INDEXER_URL.
- VITE_SHELBY_USD_METADATA can override the ShelbyUSD metadata address for a private environment; the shelbynet default is used when it is empty.
- VITE_SHELBY_API_KEY is preferred; VITE_APTOS_API_KEY remains a backwards-compatible alias.
- A default upload expiration of 30 days.

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

Set the public review configuration in the local environment file:

```env
VITE_SHELBY_NETWORK=shelbynet
VITE_SHELBY_LOCATION=shelbynet-1
VITE_SHELBY_API_KEY=aptoslabs_your_api_key_here
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

The production build, lint, unit tests, and CI workflow are configured for review. The Vite build splits Aptos, Shelby, wallet UI, icon, and general vendor chunks for cacheable loading.

## Repository structure

```text
move/
├── karya_registry/             # Aptos Move registry foundation and unit tests

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

## Key review files

- docs/reviewer-quickstart.md — five-minute Shelby reviewer flow, evidence checklist, and failure paths.
- docs/review-smoke.md — manual Petra smoke test for upload, proof, Explore, download, and premium payment.
- docs/premium-architecture.md — encrypted premium/key-release design, proof model, and current boundary.
- move/karya_registry/README.md — on-chain registry API, encrypted envelope rules, test command, and deployment boundary.
- move/karya_registry/sources/karya_registry.move — Move registry, revision, payment, entitlement, and event source.
- src/lib/config.ts — environment-driven network, endpoint, location, explorer, registry, and key-service configuration.
- src/lib/karyaMetadata.ts — versioned category, price, and revision metadata encoding.
- src/lib/paymentReceipts.ts — browser-local payment receipt replay guard.
- src/lib/activity.ts — browser-local creator activity history.
- src/components/AppErrorBoundary.tsx — recoverable UI for lazy-module or render failures.
- .github/workflows/ci.yml — automated test, lint, and production-build checks.
- src/lib/karyaRegistry.ts — registry payloads, views, work IDs, and Aptos Indexer events.
- src/lib/karyaCrypto.ts — browser encryption, key-envelope requests, wallet-authenticated key release, and decryption.
- api/key-envelope.ts and api/key-release.ts — server-only envelope wrapping and entitlement-gated release handlers.
- scripts/deploy-karya-registry.ps1 — deployment and one-time initialization helper.
- docs/private-environment-deployment.md — target-network configuration and P2 verification runbook.

## Security and product boundaries

- Never commit `.env`, `.env.local`, API keys, private keys, seed phrases, or wallet secrets.
- The frontend cannot provide secure server-side authorization by itself.
- The app entitlement is backed by a verified Aptos payment receipt, but it is still client-side and must not be described as censorship-resistant access control.
- shelbynet expiration must not be described as permanent retention.
- A blob Merkle root proves consistency with the registered commitment; it does not prove who authored the underlying work in a legal sense.
- Before production, add a threat model, rate limiting, upload policy, abuse handling, payment reconciliation, and a protocol-enforced entitlement design.

## Roadmap

### Provenance and verification

- Add an independent transaction-backed proof resolver that loads Aptos registration/commit details from receipt hashes.
- Added the tested KaryaRegistry Move foundation; deployment and private-environment verification remain external steps.
- Add explicit parent-commitment links and immutable revision lineage to Aptos/Shelby receipts.

### Premium content

- Wire the tested KaryaRegistry publish/purchase/view path behind VITE_KARYA_REGISTRY_ADDRESS; publication to the target environment remains external.
- Cross-device entitlement now reads Aptos has_entitlement; durable operational analytics and reconciliation remain separate work.
- Implemented browser AES-GCM encryption, server-wrapped envelopes, and wallet-authenticated key release for configured private mode.
- Add durable replay/nonce storage, payment reconciliation, refunds, royalty policy, and creator revenue reporting.
- Private mode prevents plaintext Shelby reads for newly encrypted uploads; old public MVP uploads must be re-uploaded and full storage-level access policy still depends on the target environment.

### Reliability and operations

- Add upload cancellation, resumable uploads, and automatic storage-stage retry support; current size/type validation, progress, and recovery states are live.
- Expand browser smoke tests for wallet, registration, upload, verification, download, payment, and error paths.
- Add server-side indexing and observability for larger creator collections; the current app uses bounded Shelby indexer pages.
- Measure real-device Core Web Vitals and continue splitting heavy upload/storage modules as the private environment stabilizes.

### Network maturity

- Define a mainnet configuration and migration process.
- Replace the fixed demo retention policy with an explicit creator-selected storage policy.
- Document operational ownership, incident response, data recovery, and abuse handling.

For the shortest reviewer flow, see [docs/reviewer-quickstart.md](docs/reviewer-quickstart.md).

## Review checklist

For the shortest reviewer flow, use docs/reviewer-quickstart.md. In a connected browser session, validate:

- Petra connects to Aptos shelbynet.
- A small image or text file can be uploaded.
- Registration reaches successful Aptos finality.
- Shelby upload reaches verification and ends with a proof receipt.
- The receipt Merkle root, expiration, and transaction hashes are inspectable.
- The same blob appears in My Works and can be downloaded.
- The blob appears in Explore when its metadata is readable and not expired.
- Clear search, creator-address search, category filters, Retry, and Load more work.
- A premium purchase with real ShelbyUSD verifies finality and exact payment fields.
- Reviewers understand that KaryaChain app gating is not protocol-enforced while raw Shelby reads remain public.
- Category filters and the My Works monetization dialog read from blob metadata rather than local-only state.

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
