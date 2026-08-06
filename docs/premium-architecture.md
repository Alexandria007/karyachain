# Premium access architecture

This note separates the public shelbynet compatibility flow from the private-environment flow so reviewers can see exactly which guarantees are real.

## Public shelbynet compatibility mode

When VITE_KARYA_REGISTRY_ADDRESS is empty:

1. the creator embeds an eight-decimal ShelbyUSD price in the versioned blob name;
2. the buyer signs a primary fungible-asset transfer to the creator;
3. the app waits for Aptos finality and verifies sender, recipient, ShelbyUSD metadata, and exact amount;
4. a browser-local receipt binds the verified transaction to one buyer, creator, work, and amount;
5. Explore hides premium controls until the receipt is verified.

This is an application-level entitlement demonstration. The underlying Shelby bytes remain publicly readable through the storage read path. Old premium uploads in this mode are plaintext and are not retroactively protected by enabling new configuration.

## Private registry mode

When VITE_KARYA_REGISTRY_ADDRESS is configured, the flow becomes:

~~~text
creator wallet
  -> encrypt file in browser with a random AES-256-GCM key
  -> request a server-wrapped key envelope
  -> upload ciphertext to Shelby
  -> publish blob commitment and envelope to KaryaRegistry

buyer wallet
  -> call KaryaRegistry.purchase with the exact registered ShelbyUSD asset
  -> Aptos atomically transfers payment and records entitlement
  -> query has_entitlement/get_work from Aptos
  -> sign a short-lived Aptos key-release message
  -> key service verifies wallet signature and on-chain entitlement
  -> return the wrapped key in memory
  -> download ciphertext from Shelby and decrypt locally
~~~

The raw AES key is never in the blob name, localStorage, or the Move state. The on-chain envelope is encrypted with the server-side KARYA_KEY_ENCRYPTION_SECRET. The API does not release it based on an address string alone.

## Secure key-release proof

The browser requests an Aptos wallet signature containing:

- a fixed protocol message version;
- the derived 32-byte work ID;
- the normalized buyer address;
- an issued-at timestamp;
- a random nonce.

The server verifies:

1. the signed fullMessage has the Aptos prefix and exact message/nonce lines;
2. the requested work ID and buyer match the signed message;
3. the timestamp is within five minutes;
4. the signature is Ed25519 and matches the buyer public key fetched from the configured Aptos fullnode;
5. the work is active and not expired;
6. the buyer has an on-chain entitlement, unless the buyer is the creator;
7. the envelope is valid before unwrapping it in memory; the configured application origin and optional chain ID binding also match.

The server requires KARYA_SIGNING_APPLICATION to bind the signature to the deployed app origin. The response uses no-store cache headers. The browser keeps a released key only in memory for up to four minutes to avoid a wallet prompt for every image preview or immediate download. The foundation is stateless; a production service should add rate limiting, an audited nonce/replay store, observability, and a formal session policy.

## Canonical state and read models

KaryaRegistry Move state is canonical for work records and entitlements. Aptos Indexer events are used by My Works as a cross-device read model for registry activity. Shelby metadata remains the storage proof cross-check: owner, blob name, size, expiry, and Merkle root must agree with the published record.

The app intentionally keeps local activity and legacy payment receipts for compatibility and UI history. In registry mode, localStorage is not sufficient to unlock a work.

## Deployment boundary

The repository includes:

- the tested Move package in move/karya_registry;
- registry transaction/view payload builders in src/lib/karyaRegistry.ts;
- browser encryption and authenticated decryption in src/lib/karyaCrypto.ts;
- Vercel-compatible key-envelope and key-release handlers in api/;
- a deployment script in scripts/deploy-karya-registry.ps1;
- the private environment runbook in docs/private-environment-deployment.md.

The public Vercel deployment is not automatically in private mode. A real module address, matching browser/API endpoints, and a private server encryption secret must be configured before claiming encrypted premium access.

## Non-goals

This foundation does not implement refunds, royalties, escrow, permanent analytics, moderation, legal copyright registration, or permanent storage guarantees. Those require an explicit product policy and durable operational infrastructure.