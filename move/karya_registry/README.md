# KaryaChain Move Registry

This package is the Aptos source of truth for KaryaChain private-environment mode. It is separate from the public shelbynet compatibility deployment until the module is published to the target environment and its address is configured in the frontend and key service.

## What the module does

karya_registry::registry stores and verifies:

- creator-controlled work records;
- Shelby blob owner, blob name, size, expiry, and Merkle root;
- immutable revision numbers and parent-work lineage;
- active/inactive work status without deleting proof history;
- premium price and exact fungible-asset metadata address;
- a server-wrapped encrypted key envelope for premium works;
- buyer entitlements keyed by buyer address and work ID;
- on-chain events for publication, status changes, purchases, and entitlement grants.

The module stores references, commitments, and an encrypted envelope, not file bytes or raw decryption keys. Shelby remains the storage/read layer.

## Entry functions

| Function | Rule |
| --- | --- |
| initialize | One-time registry initialization by the module account. |
| publish_work | Creator publishes revision 1 or the next revision with a valid parent. Free works must have zero price, zero currency, and no envelope. Premium works must have a non-zero currency/price and a non-empty envelope. |
| set_work_active | Only the creator can deactivate/reactivate a work. |
| purchase | Buyer transfers the exact registered fungible asset and receives an on-chain entitlement atomically. |

The creator is taken from the signer. The current foundation records the creator as the Shelby owner; a future multi-party ownership model would need a separate policy and field.

## View functions

- work_exists(work_id)
- get_work(work_id)
- has_entitlement(buyer, work_id)
- get_entitlement(buyer, work_id)

get_work returns the encrypted key envelope as one vector<u8> field. It never returns the raw AES key.

## Validation

Run from the repository root:

~~~powershell
aptos move test --package-dir move/karya_registry --skip-fetch-latest-git-deps
~~~

The package has five passing unit tests covering first publication, revision lineage, duplicate IDs, exact fungible-asset purchase/entitlement, and creator deactivation. The test-only address 0xc0ffee is not a deployment address.

For a clean machine, Aptos CLI fetches the official AptosFramework dependency declared in Move.toml. The package currently references the mainnet framework branch. Before publishing to Shelby, pin and verify the framework revision against the target environment's supported Aptos version.

## Deployment

Use the repository script after the Shelby team confirms the target network:

~~~powershell
.\scripts\deploy-karya-registry.ps1 -Profile shelby-private -ModuleAddress 0xPUBLISHER_ADDRESS -Initialize
~~~

The script compiles and publishes with the supplied named address. It does not invent a module address or transaction hash. Record those values and configure:

- VITE_KARYA_REGISTRY_ADDRESS in the browser;
- KARYA_REGISTRY_ADDRESS in the key service;
- matching Aptos fullnode and indexer endpoints.

See docs/private-environment-deployment.md for the full private-environment checklist.

## Deliberate non-goals

- No encrypted file bytes are placed on Aptos.
- No raw decryption keys are stored on-chain.
- Refunds, royalty splits, escrow, and reconciliation are not implemented in this foundation package.
- Old plaintext Shelby uploads cannot be retroactively encrypted.
- A module deployment and private key service are required before the encrypted premium path is live.