# Incident runbook

Reconcile: invoice `resource_id` vs hop memo vs scan receipt.

## Daily (lab)

```bash
pnpm typecheck
pnpm test
pnpm decode
```

`pnpm decode` must print `bound: true`. Hex memo on the hop and base64url memo on the URI are the same UTF-8 id.

## If GET /r/{id} is 404

Unknown id. Run `pnpm hop && pnpm invoice` and copy `resource_id` from `pnpm decode`.

## If GET /r/{id} stays 402 after a pay

1. Confirm the ZIP-321 memo decodes to that `resource_id`.
2. Do not call `pnpm unlock` as the paid path. That is `--lab-stub` only and never `status: settled`.
3. `pnpm scan` with a fixture in CI, or the watch-only observer live (`z_listreceivedbyaddress` / `PAYMENT-SIGNATURE` txid).
4. `final` (too few confirmations) stays 402 with `payment_status`. Wait for `ZCASH_SETTLED_CONFIRMATIONS` (default 10).
5. Wrong memo must not write `data/receipt.json`.

## If Docker hop fails

1. After a rpcuser rename (`lomi` → `rill`), an old volume may need `docker compose down -v` (or `-reindex`). That also drops proving params.
2. First `pnpm hop` downloads proving params, mines ~101 blocks, and starts two linux/amd64 nodes under Rosetta. Wait and retry.
3. Observer must peer with the payer: payer `-listen=1 -bind=0.0.0.0 -port=18444`, observer `-listen=0 -connect=zcashd`. If heights do not catch up, hop stays `pending`.
4. If `z_exportviewingkey` fails on a UA sapling receiver, hop falls back to `z_getnewaddress sapling`. That is expected.
5. Fail closed: invoice stays `pending` with no URI if there is no hop receive address. Observer import/sync failure is also pending.

## Keys

Never commit `.env`, viewing keys, `wallet.dat`, or zcashd datadir. Hop must not write the viewing key under `data/` or logs. New mainnet addresses later. Do not reuse testnet secrets.
