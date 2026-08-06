# KaryaChain Move Registry

This package is the blockchain source-of-truth foundation for KaryaChain's next private-environment phase. It is intentionally separate from the currently deployed browser MVP until the module is deployed to the target Shelby/Aptos environment and the frontend is wired to its published address.

## What the module does

`karya_registry::registry` stores and verifies:

- creator-controlled work records;
- Shelby blob owner, blob name, size, expiry, and Merkle root;
- immutable revision numbers and parent-work lineage;
- active/inactive work status without deleting proof history;
- premium price and exact fungible-asset metadata address;
- buyer entitlements keyed by buyer address and work ID;
- on-chain events for publication, status changes, purchases, and entitlement grants.

The module stores references and commitments, not file bytes. Shelby remains the storage/read layer.

## Entry functions

| Function | Rule |
| --- | --- |
| `initialize` | One-time registry initialization by the module account. |
| `publish_work` | Creator publishes revision 1 or the next revision with a valid parent. |
| `set_work_active` | Only the creator can deactivate/reactivate a work. |
| `purchase` | Buyer transfers the exact registered fungible asset amount and receives an on-chain entitlement atomically. |

## View functions

- `work_exists(work_id)`
- `get_work(work_id)`
- `has_entitlement(buyer, work_id)`
- `get_entitlement(buyer, work_id)`

## Validation

Run from the repository root:

```powershell
aptos move test --package-dir move/karya_registry
```

The package currently has five passing unit tests covering first publication, revision lineage, duplicate IDs, exact fungible-asset purchase/entitlement, and creator deactivation. The test-only address `0xc0ffee` is not a deployment address.

For a clean machine, Aptos CLI fetches the official `AptosFramework` dependency declared in `Move.toml`. The package currently tracks the stable `mainnet` framework branch; before publishing to Shelby, pin and verify the framework revision against the target network's supported Aptos version.

## Deployment boundary

This package is source/test complete for the current P2-A foundation, but it is not deployed yet. Before deployment:

1. obtain the target Shelby/private-environment network and module publisher address;
2. pin the Aptos framework revision supported by that network;
3. compile with the real named address;
4. publish and record the module address and transaction hash;
5. wire the React app to `publish_work`, `purchase`, and the view functions;
6. use Aptos Indexer events as the read model, with Shelby metadata cross-checks.

## Deliberate non-goals

- No encrypted file bytes are placed on Aptos.
- No decryption keys are stored on-chain.
- Refunds, royalty splits, escrow, and reconciliation are not implemented in this foundation package.
- An on-chain entitlement does not by itself hide plaintext Shelby reads; encrypted upload and secure key release remain the next private-environment boundary.
