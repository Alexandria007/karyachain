# KaryaChain review smoke test

Use a fresh browser session on the deployed Vercel URL with Petra set to `shelbynet`. This is intentionally a manual runbook because the final upload step depends on a real Petra extension signature.

## Happy path

1. Connect Petra and confirm the header shows the shortened wallet address.
2. Open Upload, choose a small image, writing document, or audio file, and confirm the category is correct.
3. Upload as free content. Approve the `register_blob` request, wait for Shelby upload, approve the final Aptos commit, and wait for read-back verification.
4. Confirm the receipt shows the blob name, category, size, Merkle root, expiry, registration transaction, final commit transaction, and public proof link.
5. Open the proof link in a new tab. Confirm live Shelby metadata resolves and the Aptos links open on shelbynet.
6. Open Explore. Confirm the first metadata page loads, category filters work, and `Load more works` requests the next page without a blank screen.
7. Download the work from Explore and confirm the downloaded filename matches the creator filename.
8. Open My Works. Confirm the uploaded work appears, search works, proof and Shelby Explorer links open, and `Load more works` is available when more pages exist.
9. Upload a second small work with Premium enabled and a positive ShelbyUSD price. Confirm the price label is embedded in the blob name and shown in Explore.
10. From another wallet, use Buy on the premium work, approve the exact ShelbyUSD transfer, and confirm the payment is verified before the download action becomes available.

## Failure paths

- Reject the `register_blob` signature: the page stays usable and shows a clear cancellation/error state.
- Disconnect or deny the Shelby upload/final commit: the page preserves any submitted transaction hash and explains that it must be verified before retrying.
- Open Explore with the indexer unavailable: an alert and Retry action are visible; retry must not duplicate cards.
- Open My Works with the indexer unavailable: an alert and Retry action are visible.
- Attempt an unsupported extension, mismatched category, empty file, or file over 50 MB: upload is blocked with a specific validation message.
- Enter an incorrect premium payment amount, recipient, asset, or sender: access remains locked and the payment is rejected.

## Evidence to capture

Record the deployed commit hash, demo wallet, blob names, registration/final-commit hashes, Merkle roots, expiry, and Aptos/Shelby Explorer links. Do not record API keys, private keys, or wallet signatures.
