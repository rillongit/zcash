# Architecture

Rill Accept challenge on Zcash. Fiat last mile is later on [lomi.](https://lomi.africa), not this lab.

## Flow

1. Agent calls a Rill pay link (`GET /r/{id}`) with no receipt.
2. Gate returns 402 plus a ZIP-321 URI: unified address, amount, memo = `resource_id`.
3. Human Zashi (or a later Spend path) pays shielded. Server holds a viewing key only.
4. Reconcile the memo. Unlock with a receipt (`rcpt_zcash_*`).

This lab proves steps 1-2 locally (`pnpm hop`, `pnpm invoice`, `pnpm gate`). Step 4 in CI is the scanner **contract** on recorded notes (`pnpm scan -- --fixture …`). Live UFVK trial-decrypt against lightwalletd is milestone 2. `pnpm unlock -- --lab-stub` copies the hop txid and is not that scan. Production Rill has no `zip321` rail until the view-key path is proven.

## Mapping

| App | Production analogue |
| --- | --- |
| ZIP-321 URI | Rill 402 payment terms |
| Memo = `resource_id` | Receipt / ledger key |
| Viewing key scan | Detect paid without spend authority |

## Infra

- `zcashd` regtest (`rill-zcashd-regtest`). RPC user `rill`.
- `lightwalletd` on `127.0.0.1:9067` (lab). Compact blocks omit memos (ZIP-307): trial-decrypt first, then fetch the full tx.
- `scanner/` sidecar: fixture pass-through today; `--lightwalletd` fails closed until `zcash_client_backend` is wired. Never commit `ZCASH_UFVK`.

## Guardrails

- Shielded receive. Memo requires a unified or Sapling address.
- ZIP-321 URIs use `zcash:` not `zcash://`.
- New mainnet addresses. Never reuse testnet secrets.
- Fail closed if the hop or invoice cannot be built.
- Fail closed if decrypted memos do not match `resource_id`.
