# Premium access architecture

This note prevents a common review mistake: a payment check in a browser is not the same thing as secure content access control.

## Current shelbynet MVP

KaryaChain currently does five things correctly:

1. The creator embeds an eight-decimal ShelbyUSD price in the versioned blob name.
2. The buyer signs a primary fungible-asset transfer to the creator.
3. KaryaChain waits for Aptos finality and verifies sender, recipient, ShelbyUSD metadata, transfer function, and exact raw amount.
4. Explore records the verified receipt locally and unlocks the app controls for that buyer/browser.
5. A browser-local receipt index binds a verified transaction to one buyer, creator, work, and amount to reduce accidental replay across works.

The app also records upload, download, and purchase activity locally for creator visibility, but it is not cross-device analytics. Work revisions are encoded durably in the blob name. The underlying Shelby bytes are still publicly readable through the storage read path. The current gate is therefore an honest application-level entitlement demo, not a protocol-enforced DRM or access-control system.

## Target private-environment design

For a real premium product, the upload and read paths should become:

```text
creator browser
  -> encrypt file with a per-blob data key
  -> upload ciphertext to Shelby
  -> publish commitment + encrypted-key envelope reference on Aptos

buyer browser
  -> submit ShelbyUSD payment
  -> backend/Move policy verifies finalized receipt and replay status
  -> key-release service returns a short-lived decryption capability
  -> browser downloads ciphertext from Shelby and decrypts locally
```

Required properties:

- The plaintext file never reaches public Shelby storage.
- The data key is never embedded in the blob name, static JavaScript, or localStorage.
- Key release checks the exact blob commitment, creator recipient, buyer, asset, amount, and a one-time/replay-safe entitlement.
- A creator can revoke or rotate access without rewriting the payment history.
- Payment reconciliation, refunds, rate limits, audit logs, and failure recovery are server-side concerns.
- The client verifies the ciphertext commitment and authenticated decryption result before presenting content.

## Why this is not faked in the browser MVP

Adding AES-GCM while putting the key in localStorage would make the UI appear locked but would not protect the content or support cross-device access. KaryaChain deliberately leaves this item marked as a production follow-up until Shelby/Aptos private-environment primitives and a secure key-release service are selected.


## On-chain registry foundation (not deployed yet)

The repository now contains a tested Aptos Move package at move/karya_registry. It defines canonical Work and Entitlement state, revision parent checks, exact fungible-asset payment, creator status changes, and indexer-friendly events. This package is not yet deployed or wired into the live Vercel frontend, so the deployed MVP still uses its browser-local entitlement flow.

After deployment to the target Shelby/private environment, the frontend should publish the Shelby owner/blob/commitment reference through publish_work, call purchase for the atomic payment and entitlement path, and read has_entitlement/get_work from Aptos. Shelby metadata and Merkle roots remain the storage proof cross-check.
