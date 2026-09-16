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
2. Do not call `pnpm unlock` as the paid path. That is `--lab-stub` only.
3. `pnpm scan` with a fixture in CI, or UFVK sidecar when trial-decrypt exists.
4. Wrong memo must not write `data/receipt.json`.

## If Docker hop fails

1. Turning on `lightwalletd=1` against an old volume needs `docker compose down -v` (or `-reindex`). Same after the rpcuser rename (`lomi` → `rill`).
2. First `pnpm hop` downloads proving params and mines ~101 blocks. Wait and retry.
3. `electriccoinco/lightwalletd:v0.4.2` dies on a 100-block reorg if it started at height 0. After hop: `docker compose restart lightwalletd`. It may still warn on coinbase ScriptSig. That is not milestone 2. Live `--lightwalletd` on the sidecar stays fail closed.
4. Fail closed: invoice stays `pending` with no URI if there is no hop UA.

## Keys

Never commit `.env`, `ZCASH_UFVK`, `wallet.dat`, or zcashd datadir. New mainnet addresses later. Do not reuse testnet secrets.
