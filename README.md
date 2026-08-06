# KaryaChain

> Creator-owned content storage and cryptographic provenance for the Aptos and Shelby ecosystem.

[![Network](https://img.shields.io/badge/network-Aptos%20%2B%20Shelby%20shelbynet-c9a84c)](https://docs.shelby.xyz/protocol/architecture/networks)
[![Built with](https://img.shields.io/badge/built%20with-React%20%2B%20TypeScript-61dafb)](https://react.dev/)
[![Storage](https://img.shields.io/badge/storage-Shelby%20Protocol-111111)](https://shelby.xyz/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/Alexandria007/karyachain/actions/workflows/ci.yml/badge.svg)](https://github.com/Alexandria007/karyachain/actions/workflows/ci.yml)

KaryaChain is a decentralized creator-content MVP that combines Aptos identity and transaction finality with Shelby's verifiable hot storage. Creators can upload writing, music, images, video, and other files, then receive a receipt containing the Aptos transaction, Shelby blob metadata, expiration, size, and Merkle root.

The live review deployment is [karyachain.vercel.app](https://karyachain.vercel.app/). The application is intentionally scoped to Aptos/Shelbynet and uses shelbynet-1 as its Shelby location. It demonstrates a real upload, verification, registry, and premium-access path on the public developer network. It does not claim permanent storage, legal copyright registration, or mainnet readiness. Newly published premium works in the configured registry path are encrypted in the browser before Shelby upload; older compatibility/plaintext works remain readable through the public Shelby read path.

## Live reviewer entry point

| Item | Current value |
| --- | --- |
| Live application | [https://karyachain.vercel.app/](https://karyachain.vercel.app/) |
| Source repository | [github.com/Alexandria007/karyachain](https://github.com/Alexandria007/karyachain) |
| Aptos network | shelbynet |
| Shelby location | shelbynet-1 |
| Storage lifetime | 30 days for the current MVP upload policy |
| Shelby Explorer | [explorer.shelby.xyz/shelbynet](https://explorer.shelby.xyz/shelbynet) |
| Registry module | 0x92df451407129a8785f965f1fa317fc5b23f2b72c61bb5d79d0073ed1937997d |
| Registry publish transaction | [Open on Aptos Explorer](https://explorer.aptoslabs.com/txn/0x2d018ce8ab0dce4c74cd64e09a75abf006af314e8db51db7274e1e8d4767c5e3?network=shelbynet) |
| Registry initialization transaction | [Open on Aptos Explorer](https://explorer.aptoslabs.com/txn/0x28b1a755369a60d950d3c160a05c8c9074fc87b166ae33173f7e8cc50fb92a02?network=shelbynet) |

For a guided review, start with [docs/reviewer-quickstart.md](docs/reviewer-quickstart.md). The shortest meaningful demonstration is: connect Petra, upload a small free file, inspect the receipt, open the proof, verify Explore/My Works/download, then use a second wallet to purchase and decrypt a premium work.

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
| ShelbyUSD payment | Live on Shelbynet registry path | The two-wallet flow executes the exact KaryaRegistry purchase with the configured ShelbyUSD asset, waits for Aptos finality, and verifies the buyer, creator, asset, and amount. |
| Payment replay guard | Browser-local hardening | A verified payment tx is locally bound to one buyer, creator, work, and amount so the same receipt cannot unlock a different work in this browser. Protocol-level reconciliation is not live. |
| Premium app access | Live for new registry-mode uploads | New premium bytes are encrypted in the browser before Shelby upload. Explore and My Works read the Aptos entitlement, and a wallet-authenticated key-release request is required before decryption. This remains an application/key-service boundary; legacy plaintext works remain publicly readable. |
| Category metadata | Live | Upload selection is encoded as writing, music, photo, video, or other in the versioned KaryaChain blob name (first uploads use v2; revisions use v3; v1 names remain supported). Explore filters and My Works badges read this metadata; legacy/plain blob names use a filename fallback. |
| Creator monetization | Live prototype path | Registry mode transfers the exact configured ShelbyUSD price to the creator and records an Aptos entitlement. Refunds, royalty splits, escrow, reconciliation, and creator payout reporting are intentionally outside this MVP. |
| KaryaRegistry Move integration | Published and active on public Shelbynet | The module is published and initialized at the documented address. The live Vercel deployment is configured for registry publication, exact-asset purchase, cross-device entitlement, event reads, and wallet-authenticated key release. Private-environment migration remains a separate external step. |

### Not yet production-ready

- Mainnet deployment and production network configuration.
- Permanent or archival storage guarantees.
- Legal copyright registration or identity verification.
- Legacy/plaintext compatibility uploads remain directly readable from Shelby. New premium uploads created while registry mode is enabled are encrypted before upload, but key release is still an application/key-service boundary that needs operational hardening before production.
- Resumable uploads, cancellation, automatic storage-stage retries, and production-scale upload policy.
- Server-side creator indexing and observability for large Explore collections.
- Unit coverage exists for metadata, payments, diagnostics, Shelby payloads, runtime config, and browser encryption; browser E2E still requires a wallet-enabled test harness.
- Further bundle optimization and browser performance measurement on real mobile hardware.
- Durable reconciliation, refunds, royalty splits, moderation, analytics, and creator account management.


## Registry and premium-access path

The public review deployment is not a private Shelby environment, but it has the KaryaRegistry module published and initialized on public Shelbynet. The live deployment is configured with the same registry address and key-service contract used by the tested P2 flow.

When registry mode is enabled:

- Free works are uploaded to Shelby and anchored in KaryaRegistry with their owner, blob commitment, revision, expiry, and active status.
- Premium bytes are encrypted in the browser with AES-256-GCM before Shelby receives them.
- The per-work key is wrapped by the server-only key-envelope endpoint; Aptos stores the wrapped envelope reference, never the raw key.
- The buyer pays the exact registered ShelbyUSD amount through KaryaRegistry purchase.
- The entitlement is read from Aptos, so a fresh browser can recognize a completed purchase without importing localStorage.
- A wallet-authenticated key-release request is required before the service returns the wrapped key for decryption.
- The application still makes the storage read and key-release boundary explicit: this is an MVP access design, not a claim that Shelby's raw storage endpoint is independently aware of KaryaChain entitlements.

The public Shelbynet deployment evidence is recorded in docs/reviewer-quickstart.md and docs/private-environment-deployment.md. Existing plaintext or compatibility uploads are not retroactively encrypted; they must be uploaded again while registry mode is enabled if confidentiality is required.

### Private-environment migration boundary

The same source is prepared for a Shelby private environment, but that migration still requires Shelby-provided network parameters, a supported chain/framework revision, a deployed module address, the environment-specific ShelbyUSD asset, and matching Vercel server/browser variables. The public Shelbynet deployment should therefore be reviewed as the current live integration, not described as a mainnet or private-environment deployment.

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
- The current Shelbynet MVP upload policy uses a 30-day expiration.

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
- Registry entitlements and key release are backed by finalized Aptos state plus wallet proof, but this MVP does not claim storage-layer authorization, censorship-resistant access control, or an audited production key service.
- shelbynet expiration must not be described as permanent retention.
- A blob Merkle root proves consistency with the registered commitment; it does not prove who authored the underlying work in a legal sense.
- Before production, add a threat model, rate limiting, upload policy, abuse handling, payment reconciliation, and a protocol-enforced entitlement design.

## Roadmap

### Provenance and verification

- Add an independent transaction-backed proof resolver that loads Aptos registration/commit details from receipt hashes.
- KaryaRegistry is published and initialized on public Shelbynet; private-environment deployment and verification still require Shelby-provided network parameters.
- Add explicit parent-commitment links and immutable revision lineage to Aptos/Shelby receipts.

### Premium content

- Continue validating the live KaryaRegistry publish/purchase/view path on Shelbynet, then repeat the deployment and verification against a Shelby private environment when its parameters are available.
- Cross-device entitlement now reads Aptos has_entitlement; durable operational analytics and reconciliation remain separate work.
- Browser AES-GCM encryption, server-wrapped envelopes, and wallet-authenticated key release are live for the configured Shelbynet registry mode; private-environment migration remains separate.
- Add durable replay/nonce storage, payment reconciliation, refunds, royalty policy, and creator revenue reporting.
- Registry-mode uploads prevent plaintext reads for newly encrypted premium content; old public MVP uploads must be re-uploaded, and a production storage/key policy still depends on the target environment.

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
- A fresh browser recognizes the Aptos entitlement and requires wallet-authenticated key release before decrypting a new premium work.
- The receipt and metadata show the current 30-day Shelbynet expiration boundary.
- Reviewers understand that registry-mode encryption and key release are application/key-service controls; legacy plaintext works and raw ciphertext reads are not governed by KaryaChain entitlement logic at the Shelby storage layer.
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
