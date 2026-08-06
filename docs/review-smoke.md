# KaryaChain review smoke test

Use a fresh browser session on https://karyachain.vercel.app/ with Petra set to Aptos Shelbynet. This is a manual smoke test because the final upload, purchase, and key-release steps require real wallet signatures.

## Environment

- Network: shelbynet
- Shelby location: shelbynet-1
- Storage policy: 30-day MVP object expiration
- Creator and buyer: use separate funded wallets
- Test data: a small non-confidential image or document

## Happy path

1. Connect Petra and confirm the header shows the shortened wallet address and Shelbynet environment.
2. Open Upload, select a small file, and confirm the category is correct.
3. Upload it as free content.
4. Approve register_blob, wait for Shelby upload, approve commit_object, and wait for the read-back verification.
5. Confirm the receipt shows the blob name, category, size, Merkle root, expiry, registration transaction, final commit transaction, registry transaction, and public proof link.
6. Open the proof link in a new tab. Confirm live Shelby metadata resolves and the Aptos links open on Shelbynet.
7. Open Explore. Confirm global metadata loads, creator-address search works, category filters work, Clear search returns to the global list, and Load more works does not duplicate cards.
8. Download the work from Explore and confirm the downloaded filename matches the creator filename.
9. Open My Works. Confirm the uploaded work appears, search works, proof and Shelby Explorer links open, and registry activity is visible when the indexer responds.
10. Upload a second file with Premium enabled and a positive ShelbyUSD price such as 0.02.
11. Switch Petra to a different buyer wallet, open the premium work in Explore, and click Buy.
12. Approve the KaryaRegistry purchase transaction. At eight ShelbyUSD decimal places, 0.02 SUSD equals 2,000,000 raw units.
13. Confirm the buyer's ShelbyUSD balance decreases, Aptos entitlement is finalized, and the work unlocks.
14. Open a fresh browser profile, connect the same buyer wallet, request download, approve the wallet key-release signature, and confirm the premium file decrypts successfully.

## Expected premium behavior

For new registry-mode premium works:

- encryption happens in the browser before Shelby receives the bytes;
- the on-chain record contains the wrapped key envelope, not the raw AES key;
- purchase transfers the exact registered ShelbyUSD asset and price to the creator;
- entitlement is read from Aptos and is therefore recoverable across browsers;
- key release requires entitlement and a wallet-authenticated proof;
- a direct Shelby read exposes ciphertext rather than the original plaintext.

Legacy/plaintext works are a separate compatibility case and should not be used to claim encrypted premium behavior.

## Failure paths

- Reject register_blob: the page stays usable and shows a clear cancellation/error state.
- Cancel Shelby upload or final commit: the app must not claim a verified upload.
- Try an unsupported extension, mismatched category, empty file, or file over 50 MB: validation blocks signing.
- Reuse an existing blob name: duplicate-name protection blocks the ambiguous registration.
- Open Explore or My Works during an indexer failure: a recoverable alert and Retry action are visible.
- Search by creator address, clear search, change category, and load another page: results remain bounded and do not duplicate.
- Use the wrong payment asset, amount, recipient, sender, or work: the premium work remains locked.
- Reuse a verified payment receipt for another work: the browser replay guard rejects it.
- Submit a stale, modified, or wrong-wallet key-release signature: the API rejects it.
- Request key release without entitlement: no decryption key is returned.

## Evidence to capture

Record public identifiers only:

- live URL and deployed Git commit;
- creator and buyer Aptos addresses;
- blob names;
- registration, final commit, registry publication, and purchase transaction hashes;
- Merkle roots and expiration timestamps;
- proof and Explorer links;
- buyer ShelbyUSD balance before and after purchase.

Never record API keys, private keys, seed phrases, wallet signatures, or private creator content. Shelbynet data is temporary and may be reset before another reviewer opens the same blob.
