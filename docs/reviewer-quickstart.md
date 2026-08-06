# KaryaChain reviewer quickstart

This guide is the shortest reliable way for a Shelby reviewer to evaluate the live KaryaChain integration. It is written for the public Aptos/Shelbynet deployment and intentionally separates demonstrated behavior from future production work.

## Review snapshot

| Item | Current value |
| --- | --- |
| Live application | https://karyachain.vercel.app/ |
| Source repository | https://github.com/Alexandria007/karyachain |
| Aptos network | shelbynet |
| Shelby location | shelbynet-1 |
| Wallet | Petra or another Aptos Wallet Adapter wallet |
| Current storage policy | 30-day object expiration in the MVP |
| Shelby Explorer | https://explorer.shelby.xyz/shelbynet |
| KaryaRegistry module | 0x92df451407129a8785f965f1fa317fc5b23f2b72c61bb5d79d0073ed1937997d |
| Registry publish transaction | https://explorer.aptoslabs.com/txn/0x2d018ce8ab0dce4c74cd64e09a75abf006af314e8db51db7274e1e8d4767c5e3?network=shelbynet |
| Registry initialization transaction | https://explorer.aptoslabs.com/txn/0x28b1a755369a60d950d3c160a05c8c9074fc87b166ae33173f7e8cc50fb92a02?network=shelbynet |

The live deployment currently uses the published KaryaRegistry module. New registry-mode premium works use browser-side AES-256-GCM encryption, an on-chain work record, exact ShelbyUSD purchase, cross-device entitlement, and wallet-authenticated key release. Existing compatibility/plaintext works are intentionally documented as a separate legacy boundary.

## What this review validates

A successful review should demonstrate all of the following:

1. Aptos wallet identity and transaction signing work on Shelbynet.
2. A file is registered on Aptos with its Shelby location, size, expiration, and commitment.
3. The exact committed bytes are uploaded to Shelby through the Shelby SDK protocol path.
4. Storage acknowledgement is finalized on Aptos with commit_object.
5. Shelby metadata and the authenticated read stream are checked before the UI reports success.
6. The receipt exposes the blob name, Merkle root, expiry, and public transaction/proof links.
7. The same work is discoverable through My Works and Explore and can be downloaded.
8. A second wallet can purchase a registry-mode premium work with the exact ShelbyUSD asset and price.
9. A fresh browser can recover the buyer entitlement from Aptos rather than relying on the original browser's localStorage.
10. Decryption requires a wallet-authenticated key-release request after entitlement is verified.

## Before starting

- Open the live URL in a fresh browser session.
- Set Petra to Aptos Shelbynet. Do not use mainnet or an unrelated test network.
- Ensure the creator wallet has enough network gas and, for the premium test, the buyer wallet has ShelbyUSD.
- Use a small test file, preferably an image under 1 MB. Do not upload confidential material.
- Keep the creator wallet and buyer wallet separate for the premium test.
- A reviewer may use a new file name for every attempt. Shelbynet is a developer network and may be reset or have changing availability; an old missing object is not proof that the application created a bad receipt.

## Demonstration A — free upload and proof

### 1. Connect the creator wallet

Open the application, connect Petra, and confirm that the header displays the shortened creator address. The UI should identify the environment as Shelbynet.

### 2. Upload a small free work

1. Open Upload.
2. Select a small image, text document, audio file, or video.
3. Confirm the category matches the file.
4. Leave Premium disabled.
5. Click Upload to Shelby.

The upload lifecycle is intentionally staged:

~~~text
wallet connection
  -> commitment and metadata preparation
  -> Aptos register_blob finality
  -> Shelby chunkset upload
  -> Aptos commit_object finality
  -> Shelby metadata and stream read-back
  -> KaryaRegistry publication
  -> proof receipt
~~~

The wallet may show more than one signing request. The first Aptos transaction registers the object. After Shelby acknowledges the chunksets, the final commit transaction records the storage-provider result. Registry mode then anchors the work record on Aptos.

### 3. Inspect the receipt

A successful receipt should show, where applicable:

- the versioned KaryaChain blob name;
- creator wallet;
- category;
- stored size;
- Shelby Merkle root;
- expiration timestamp;
- revision number;
- Aptos registration transaction;
- Aptos final commit transaction;
- KaryaRegistry transaction;
- public proof and Shelby Explorer links.

The UI must not display success merely because a wallet transaction was submitted. It waits for transaction finality, Shelby metadata, byte-length, expiration, and Merkle-root checks.

### 4. Verify the public proof

Open the public proof link from the receipt. The verifier resolves the creator/blob pair against live Shelby metadata and reports the readable, committed, deleted, and expired state. Confirm that the Merkle root, size, owner, and expiry match the receipt.

This is evidence that the wallet-controlled upload is consistent with the registered Shelby commitment. It is not a legal copyright registration or independent authorship determination.

### 5. Verify discovery and download

- Open My Works and confirm the work appears for the connected creator.
- Open Explore and confirm the work can be found by global browsing or by searching the creator address.
- Test the category filters.
- Clear the search and confirm the global list returns.
- Use Load more works when another metadata page is available.
- If a request fails, use Retry and confirm the page remains usable without duplicate cards.
- Download the work and confirm the browser filename matches the creator filename.
- For images, confirm the preview comes from the authenticated Shelby read path.

## Demonstration B — premium purchase and controlled decryption

Use two wallets:

- Wallet A: creator and recipient.
- Wallet B: buyer.

A price such as 0.02 SUSD is convenient for a visible test. ShelbyUSD uses eight decimal places, so 0.02 SUSD corresponds to 2,000,000 raw units.

### 1. Publish a premium work

With Wallet A:

1. Open Upload and select a new small file.
2. Enable Premium.
3. Enter a positive decimal ShelbyUSD price, such as 0.02.
4. Submit the upload.
5. Approve the registration, Shelby commit, and registry publication transactions.

In the live registry path, the browser:

- generates a random AES-256-GCM content key;
- encrypts the file before Shelby upload;
- sends ciphertext to Shelby;
- requests a server-wrapped key envelope;
- publishes the envelope reference, price, currency metadata, commitment, and expiry to KaryaRegistry.

The raw AES key is not placed in the blob name or Aptos state.

### 2. Purchase with Wallet B

1. Switch Petra to Wallet B.
2. Open Explore and locate the premium work.
3. Click Buy.
4. Approve the KaryaRegistry purchase transaction.

The purchase is checked against the on-chain work record. The buyer must transfer the exact configured ShelbyUSD asset and exact price to the creator. After finality, confirm that:

- Wallet B's ShelbyUSD balance decreases by the displayed price;
- the creator receives the corresponding transfer;
- the buyer entitlement is recorded on Aptos;
- the work becomes available to Wallet B in the application.

The live registry path uses an atomic on-chain purchase. It is not the legacy browser-only direct-transfer compatibility path.

### 3. Verify cross-device entitlement and key release

Use a fresh browser profile or another device:

1. Connect Wallet B.
2. Search for the same premium work.
3. Confirm the app recognizes the Aptos entitlement without importing the previous browser's localStorage.
4. Request preview or download.
5. Approve the separate wallet signature for key release.
6. Confirm the application decrypts the downloaded ciphertext locally and produces the original file.

A direct read of a newly encrypted Shelby object should provide ciphertext, not the original plaintext. The key service releases the wrapped key only after it verifies the work, wallet proof, expiry, and on-chain entitlement.

## What is stored where

| Layer | Purpose | Reviewer-visible evidence |
| --- | --- | --- |
| Aptos Shelbynet | Registration, final commit, KaryaRegistry work record, price/currency, entitlement, and events | Transaction hashes, registry views, and event activity |
| Shelby | Erasure-coded object bytes or premium ciphertext, metadata, commitment, owner, expiry, and read status | Blob name, size, Merkle root, expiry, Shelby Explorer/read result |
| Browser | File selection, UI state, local activity display, and local decryption after key release | Upload progress, proof receipt, preview/download |
| Serverless key service | Wraps a per-work key and releases it after wallet proof plus entitlement checks | HTTPS API behavior; no raw key is stored in the repository or browser configuration |

## Evidence checklist for a review report

For one free work and one premium work, record only public identifiers:

| Evidence | Record |
| --- | --- |
| Deployment URL | https://karyachain.vercel.app/ |
| Source commit | Git commit deployed by Vercel |
| Creator address | Public Aptos address |
| Buyer address | Public Aptos address, for premium only |
| Blob name/suffix | Exact Shelby metadata name |
| Registration transaction | Public Aptos hash |
| Final commit transaction | Public Aptos hash |
| Registry publication transaction | Public Aptos hash |
| Purchase transaction | Public Aptos hash, for premium only |
| Merkle root | Shelby-returned public root |
| Expiration | Shelby-returned timestamp |
| Proof URL | Public KaryaChain proof link |
| Shelby Explorer URL | Public blob link, when available |
| ShelbyUSD evidence | Public transaction and before/after balance observation |

Never include API keys, private keys, seed phrases, wallet signatures, server secrets, or creator files that are not intended for review.

## Failure-path checks

These checks are optional but useful for evaluating the application's recovery behavior:

- Reject a register_blob signature. The page should remain usable and show a cancellation/error message.
- Cancel a Shelby upload or final commit. The app should not claim a verified upload.
- Try an empty file, unsupported extension, category mismatch, or a file over the 50 MB limit. Validation should block signing.
- Reuse an existing blob name. Duplicate-name protection should prevent an ambiguous second registration.
- Open Explore or My Works during an indexer failure. The app should show a recoverable error with Retry, not a blank page.
- Search by creator address, clear the search, use category filters, and load another page. Results should not duplicate.
- Try a wrong ShelbyUSD asset, amount, recipient, buyer, or work. The work should remain locked and the receipt should be rejected.
- Reuse a verified payment receipt for a different work in the same browser. The local replay guard should reject it.
- Request key release with a stale, modified, or wrong-wallet signature. The API should reject it.
- Try to access a premium work without entitlement. The app should not release the decryption key.
- Test an expired or inactive work. It should not be treated as a currently readable premium work.

## Current limits and explicit non-goals

### Shelbynet retention

The current upload policy sets object expiration to 30 days. This is a developer-network demo lifetime, not a permanent-storage or archival guarantee. Shelbynet data may be reset, unavailable, rate-limited, repriced, or changed by the protocol environment. A receipt must therefore be read as a time-bounded proof of the object state observed on Shelbynet.

### Access-control boundary

Registry-mode premium content is encrypted before Shelby upload and requires an Aptos entitlement plus wallet proof for KaryaChain decryption. This does not mean Shelby's raw storage endpoint understands KaryaChain's marketplace policy. Legacy/plaintext uploads remain directly readable and must be re-uploaded in registry mode when confidentiality is needed.

### Product and operational scope

The current review build does not claim:

- Aptos or Shelby mainnet deployment;
- permanent retention or archival recovery;
- legal copyright registration or identity verification;
- refunds, royalty splits, escrow, or durable payment reconciliation;
- permanent creator analytics or a server-side creator account system;
- moderation, abuse response, or production upload policy;
- audited key management, durable nonce/replay storage, rate limiting, or incident response;
- resumable uploads and production-scale background retry behavior.

These are deliberate production follow-ups, not hidden features.

## Source map for reviewers

- README.md — product scope, live status, architecture, and boundaries.
- docs/review-smoke.md — compact manual smoke test.
- docs/premium-architecture.md — encryption, entitlement, and key-release design.
- docs/private-environment-deployment.md — migration requirements for a Shelby private environment.
- src/components/UploadSection.tsx — registration, Shelby upload, verification, and registry publication.
- src/components/Explore.tsx — discovery, filters, premium UI, and downloads.
- src/components/MyWorks.tsx — creator dashboard and registry activity.
- src/lib/shelby.ts — Aptos/Shelby clients, authenticated reads, and downloads.
- src/lib/karyaRegistry.ts — registry payloads, views, work IDs, and event reads.
- src/lib/karyaCrypto.ts — browser encryption, envelope requests, key release, and decryption.
- api/key-envelope.ts and api/key-release.ts — server-only key service endpoints.
- move/karya_registry/sources/karya_registry.move — Move source of truth for publication, purchase, entitlement, and events.

## Local source validation

From the repository root:

~~~powershell
npm install --legacy-peer-deps
npm run lint
npm run test
npm run build
~~~

The manual wallet flow still requires a browser wallet and cannot be fully replaced by the local unit suite.
