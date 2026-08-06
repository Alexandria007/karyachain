# KaryaChain private-environment deployment runbook

This runbook describes how to move the P2 source implementation from the public shelbynet MVP into a Shelby/Aptos private environment. It is intentionally explicit about what the repository can do locally and what requires a real network, module publisher, and server deployment.

## P2 status

| Area | Repository status | Requires external action |
| --- | --- | --- |
| Move registry | Compiled and unit-tested | Publish the package, initialize the registry resource, record transactions |
| publish_work | Frontend payload and upload wiring implemented | Configure the deployed module address and test against the target network |
| purchase | Frontend payload and finalized-transaction verification implemented | Fund two wallets with the configured fungible asset and test atomic purchase |
| Cross-device entitlement | Reads has_entitlement from Aptos when registry mode is enabled | Deploy the module and point all clients at the same fullnode |
| Indexer events | Aptos GraphQL event reader implemented | Configure an indexer endpoint that exposes the deployed module events |
| Premium encryption | Browser AES-256-GCM encryption and ciphertext upload implemented | Enable the registry/key service environment variables |
| Secure key release | Serverless API unwraps the envelope only after Aptos entitlement plus wallet signature verification | Deploy the API with a private encryption secret and fullnode access |
| Reconciliation/refunds/royalties/analytics | Not implemented | Requires an explicit marketplace policy and durable backend/indexer |

The live Vercel MVP remains in compatibility mode when VITE_KARYA_REGISTRY_ADDRESS is empty. Do not describe that deployment as encrypted or protocol-enforced premium access.

## 1. Obtain the target network parameters

The Shelby team must provide or confirm:

- the private environment fullnode URL and chain ID;
- the Shelby RPC and metadata/indexer URLs;
- the supported shelbynet-1-compatible location identifier, or the private equivalent;
- the Aptos framework revision supported by that environment;
- a funded Aptos account that will publish the module;
- the ShelbyUSD fungible-asset metadata address for that environment;
- an Aptos GraphQL indexer endpoint, if event browsing is enabled.

The module publisher address and the Aptos CLI profile used for publication must be the same address. The repository's Move.toml uses a placeholder named address and a test-only 0xc0ffee address; neither is a deployment address.

## 2. Compile, publish, and initialize

From the repository root, authenticate the Aptos CLI profile against the target environment, then run:

~~~powershell
aptos init --profile shelby-private --network custom --rest-url https://FULLNODE.example/v1
.\scripts\deploy-karya-registry.ps1 -Profile shelby-private -ModuleAddress 0xPUBLISHER_ADDRESS -Initialize
~~~

The script:

1. compiles move/karya_registry with the supplied named address;
2. publishes karya_registry::registry;
3. optionally calls registry::initialize exactly once.

If the target CLI requires dependency fetching on the first compile, remove --skip-fetch-latest-git-deps from the script after confirming the framework revision. Before a real deployment, pin AptosFramework in move/karya_registry/Move.toml to the revision approved for the target environment rather than relying on a moving branch.

Record:

- module address;
- publish transaction hash;
- initialize transaction hash;
- framework revision;
- target fullnode/indexer URLs.

## 3. Configure the browser

Set these Vite variables in the deployment environment. They are public runtime settings, not secrets:

~~~env
VITE_SHELBY_NETWORK=shelbynet
VITE_SHELBY_LOCATION=shelbynet-1
VITE_SHELBY_USD_METADATA=0x<private-environment-shelbyusd-metadata>
VITE_SHELBY_API_KEY=<public Shelby/Geomi API key if required>
VITE_SHELBY_RPC_URL=https://<private-shelby-rpc>
VITE_SHELBY_INDEXER_URL=https://<private-shelby-indexer>
VITE_APTOS_FULLNODE_URL=https://<private-aptos-fullnode>/v1
VITE_APTOS_INDEXER_URL=https://<private-aptos-indexer>/v1/graphql
VITE_KARYA_REGISTRY_ADDRESS=0x<published-module-address>
VITE_KARYA_KEY_SERVICE_URL=https://<same-app-origin>
~~~

The browser uses the registry address to enable private mode. In this mode:

- free uploads publish a free Work record;
- premium uploads encrypt the file in the browser before Shelby upload;
- the key envelope is included in the on-chain Work record, but the raw AES key is not;
- premium purchases call registry::purchase and verify the resulting entitlement;
- reads call has_entitlement/get_work rather than trusting localStorage;
- previews/downloads require a fresh Aptos wallet signature before the key service releases the wrapped key.

## 4. Configure the key service

These variables belong only to the Vercel/serverless runtime. Never prefix them with VITE_ and never place them in browser code:

~~~env
KARYA_REGISTRY_ADDRESS=0x<published-module-address>
KARYA_APTOS_FULLNODE_URL=https://<private-aptos-fullnode>/v1
KARYA_APTOS_API_KEY=<server-side API key if required>
KARYA_SIGNING_APPLICATION=https://<exact-deployed-app-origin>
KARYA_APTOS_CHAIN_ID=<wallet chain ID>
KARYA_KEY_ENCRYPTION_SECRET=<at-least-32-byte-random-secret>
~~~

api/key-envelope wraps the per-file AES key with the server secret and returns an envelope. api/key-release:

1. validates the work ID and Aptos wallet proof;
2. verifies the signed application origin and optional chain ID binding;
3. resolves the buyer public key from the fullnode;
4. verifies the Ed25519 signature over the exact Aptos fullMessage;
5. checks the active, non-expired on-chain Work;
6. checks has_entitlement unless the signer is the creator;
7. unwraps the envelope in memory and returns it with no-store headers.

The key service is deliberately stateless in this foundation. The wallet proof has a five-minute freshness window and a random nonce. A production marketplace should add rate limiting, an audited replay/nonce store, monitoring, and an explicit session policy before handling valuable content.

## 5. Verify the six flows

Use two funded Petra wallets.

### A. Publish

1. Connect creator wallet.
2. Upload a free file.
3. Approve Shelby registration and commit transactions.
4. Confirm the receipt includes the Shelby proof.
5. In registry mode, confirm a publish_work transaction appears on Aptos.
6. Query get_work with the derived work ID and compare blob name, size, expiry, Merkle root, and active state.

### B. Premium publish

1. Enable Premium and set a non-zero ShelbyUSD price.
2. Confirm the browser sends ciphertext to Shelby, not the plaintext file.
3. Confirm Work.encrypted_key_envelope is non-empty.
4. Confirm the original AES key is not present in the blob name, localStorage, or compiled client bundle.

### C. Purchase

1. Connect buyer wallet.
2. Open the creator's premium work.
3. Approve the registry::purchase transaction.
4. Confirm the exact ShelbyUSD balance reduction.
5. Confirm has_entitlement(buyer, work_id) is true.
6. Confirm the recipient and exact price match the registered work.

### D. Cross-device read

1. Open a fresh browser profile or second device.
2. Connect the buyer wallet.
3. Search the same work.
4. Confirm the app unlocks from Aptos entitlement without importing localStorage.
5. Download/preview and approve the separate wallet signature.
6. Confirm the returned plaintext is produced only after authenticated AES-GCM decryption.

### E. Negative paths

- reject a different buyer address in the signed message;
- reject a stale signed message;
- reject a modified fullMessage/signature;
- reject a work with no entitlement;
- reject a different asset or amount;
- reject an inactive or expired work;
- reject a missing/invalid envelope;
- reject a direct legacy fungible transfer while registry mode is enabled.

### F. Indexer

Confirm the indexer returns WorkPublished, PremiumPurchased, EntitlementGranted, and WorkStatusChanged for the deployed module. Compare event data with the view-function record and Shelby metadata. The UI's event reader is a read model; Aptos Move state remains canonical.

## 6. Security boundary

The implementation protects premium content only when all of the following are true:

- the file was uploaded after registry mode and encrypted before Shelby upload;
- the server key-encryption secret is private and backed up securely;
- the deployed registry address is the same address configured in the browser and API;
- the API fullnode points at the same chain as the wallet and registry;
- the buyer has a finalized on-chain entitlement;
- the buyer signs the key-release proof with the wallet controlling that address.

Old plaintext MVP uploads remain readable through Shelby and cannot be retroactively encrypted by changing frontend configuration. Re-upload them in private mode if confidentiality is required.

The following remain outside this package: refunds, royalty splits, creator payout accounting, permanent analytics, moderation, legal copyright registration, and permanent storage guarantees.
## Shelbynet deployment record — 2026-08-06

A dedicated publisher profile was initialized for the public Shelbynet network. The generated signing key is stored only in the local Aptos user profile and is not part of this repository.

- Network: `shelbynet`.
- Module address: `0x92df451407129a8785f965f1fa317fc5b23f2b72c61bb5d79d0073ed1937997d`.
- Publish transaction: `0x2d018ce8ab0dce4c74cd64e09a75abf006af314e8db51db7274e1e8d4767c5e3`.
- Initialize transaction: `0x28b1a755369a60d950d3c160a05c8c9074fc87b166ae33173f7e8cc50fb92a02`.
- Publish and initialization both returned `success: true`.
- Aptos Explorer links:
  - https://explorer.aptoslabs.com/txn/0x2d018ce8ab0dce4c74cd64e09a75abf006af314e8db51db7274e1e8d4767c5e3?network=shelbynet
  - https://explorer.aptoslabs.com/txn/0x28b1a755369a60d950d3c160a05c8c9074fc87b166ae33173f7e8cc50fb92a02?network=shelbynet

The remaining activation step is setting the matching browser/server environment variables on the Vercel project. No Vercel session or CLI token was available in this workspace, so no deployment settings were changed.