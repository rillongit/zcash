# Scanner sidecar

This binary does **not** trial-decrypt notes. Compact blocks omit memos ([ZIP-307](https://zips.z.cash/zip-0307)). Milestone 2 is: UFVK against lightwalletd compact blocks, fetch the full transaction, decrypt the memo, match `resource_id`.

`zcashd` `z_importviewingkey` does not import unified viewing keys. Do not pretend RPC watch is M2.

## CI

TypeScript reads `test/fixtures/scan-notes.*.json`. CI does not compile this crate.

## Local

```bash
cargo build --release
./target/release/zcash-scan --fixture ../test/fixtures/scan-notes.match.json
```

`--lightwalletd` exits 1 until `zcash_client_backend` scan is wired. Set `ZCASH_UFVK` only in `.env`. Never commit viewing keys or spend keys.

Compose already runs `lightwalletd` on `127.0.0.1:9067` next to regtest `zcashd`.
