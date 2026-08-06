# KaryaChain reviewer quickstart

This guide is designed for a Shelby reviewer who wants to verify the live integration in approximately five minutes. It describes the current shelbynet MVP honestly: the upload/provenance path is real, while premium access is still an application-level entitlement and not protocol-enforced on the raw read path.

## Live application

- Deployment: `https://karyachain-g1nt.vercel.app`
- Repository: `https://github.com/Alexandria007/karyachain`
- Network: Aptos shelbynet + Shelby shelbynet
- Default Shelby location: `shelbynet-1`
- Storage lifetime in this MVP: 30 days
- Wallet: Petra or another Aptos wallet compatible with the Aptos Wallet Adapter

Shelbynet is a developer network and can be reset. If an older demo blob is missing, create a fresh small demo file and repeat the flow rather than treating the reset as an application failure.

## What to verify first

The strongest review signal is the complete round trip:

```text
wallet signature
  -> Aptos register_blob finality
  -> Shelby chunkset upload
  -> Aptos commit_object finality
  -> authenticated Shelby read-back
  -> proof receipt with Merkle root and transaction links
```

The UI reports success only after the final read-back checks pass. A submitted wallet transaction by itself is not presented as a completed upload.

## Five-minute happy path

1. Open the deployment in a fresh browser session and connect Petra. Set Petra to **Shelbynet**.
2. Open **Upload**, select a small image (under 1 MB is ideal), keep **Photo**, and leave Premium disabled.
3. Click **Upload to Shelby**. Approve the `register_blob` request in Petra. The location arguments should be strings and should contain `shelbynet-1`.
4. Wait for the Shelby upload acknowledgement, then approve the final `commit_object` transaction.
5. Confirm the success receipt contains:
   - the KaryaChain v2 blob name;
   - the creator wallet;
   - stored size;
   - Shelby Merkle root;
   - expiration;
   - registration and final-commit Aptos transaction links.
6. Open the **public proof** link. It resolves the exact owner/blob pair against live Shelby metadata and reports whether it is readable, committed, deleted, or expired.
7. Open **My Works** and **Explore**. Confirm the work can be previewed/downloaded through the authenticated Shelby SDK read path.

## Premium payment check

Use two wallets so the buyer and creator are unambiguous:

1. Wallet A uploads a new work with Premium enabled and a normal decimal price such as `0.02` SUSD. Scientific notation is intentionally rejected by the form.
2. Wallet B opens Explore, selects the premium work, and clicks **Buy**.
3. Petra should show a primary fungible-asset transfer of the ShelbyUSD metadata address to Wallet A. At ShelbyUSD's eight-decimal scale, `0.02` is `2,000,000` raw units.
4. After finality, KaryaChain verifies the transaction sender, recipient, asset metadata, function, and exact amount before unlocking the app entitlement.
5. Confirm Wallet B's ShelbyUSD balance decreases and Wallet B can download the work afterward.

Premium limitations are intentional and visible in the UI: the raw Shelby read path remains publicly readable in this browser-first MVP, the entitlement receipt is currently local-browser state revalidated against Aptos, and there is no refund/royalty/revenue-reconciliation service yet.

## Evidence to record

For one free and one premium demo, record only public identifiers:

| Evidence | Value |
| --- | --- |
| Deployment commit | Vercel/Git commit SHA |
| Creator wallet | Public Aptos address |
| Buyer wallet | Public Aptos address, if premium is tested |
| Blob name | Exact Shelby suffix |
| Registration tx | Public Aptos transaction hash |
| Final commit tx | Public Aptos transaction hash |
| Payment tx | Public Aptos transaction hash, if premium is tested |
| Merkle root | Shelby-returned public root |
| Expiration | Shelby-returned timestamp |
| Proof URL | Public KaryaChain proof link |

Never record API keys, private keys, seed phrases, wallet signatures, or file contents that the creator does not intend to share.

## Failure-path checks

These are useful signals of production discipline even on shelbynet:

- Reject a wallet signature. The page stays usable and shows a cancellation/error state.
- Try an empty file, a file over 50 MB, or a category/extension mismatch. Upload is blocked before signing.
- Reuse an existing blob name. Duplicate-name protection should stop the second registration.
- Make the Shelby indexer unavailable or simulate a failed request. Explore and My Works show a recoverable error with **Retry**, not a blank page or duplicate cards.
- Submit a payment with the wrong asset, recipient, sender, or amount. The app must keep the work locked and explain which receipt check failed.
- Refresh a proof link with missing/invalid query values. The verifier shows an input/validation error instead of throwing.

## Environment contract

Vercel uses public `VITE_*` runtime values. The repository includes `.env.example` and `env.example` with the review defaults:

```env
VITE_SHELBY_NETWORK=shelbynet
VITE_SHELBY_LOCATION=shelbynet-1
VITE_SHELBY_API_KEY=...
```

`VITE_APTOS_API_KEY` remains supported as a backwards-compatible alias. A private/local environment can provide `VITE_SHELBY_RPC_URL`, `VITE_SHELBY_INDEXER_URL`, `VITE_APTOS_FULLNODE_URL`, and `VITE_APTOS_INDEXER_URL` without editing the source. Do not put signing keys or wallet secrets in Vite variables; browser variables are public.

## Current boundaries

- Shelbynet data is temporary and not an archival or permanent-retention promise.
- A Merkle root demonstrates consistency with the registered Shelby commitment; it is not a legal copyright registration by itself.
- Premium payment verification is real Aptos transaction verification, but the access gate is not yet enforced by Shelby's storage layer.
- Mainnet deployment, encrypted premium payloads/key release, backend entitlement reconciliation, resumable uploads, and creator royalties are follow-up work for a production environment.
