# zcash

Shielded [ZIP-321](https://zips.z.cash/zip-0321) invoices for [Rill](https://userill.com).

**Rill** is the agent payment control plane: humans fund, agents Accept and Spend (MPP / x402 today). This repository adds a shielded `zcash:` invoice so an agent can pay a Rill pay link without a public graph.

We also have [lomi.](https://lomi.africa). Fiat last mile is later, not this product.

Merchants and agents never hold spend keys. The seller watches with a viewing key. We do not issue a token. This is not a ZEC checkout and not a Wave exchange.

**Architecture:** [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)  
**Rill mapping:** [docs/RILL-INTEGRATION-CONTRACT.md](./docs/RILL-INTEGRATION-CONTRACT.md)  
**Reviewer path:** [REVIEW.md](./REVIEW.md) · [docs/WALKTHROUGH.md](./docs/WALKTHROUGH.md)  
**Agent playbook:** [docs/PLAYBOOK.md](./docs/PLAYBOOK.md)  
**Phases / ops:** [docs/BUILD-PHASES.md](./docs/BUILD-PHASES.md) · [docs/OPS.md](./docs/OPS.md)

Not wired to live Rill or lomi. APIs until the invoice plus view-key path is proven.

## Products

| Product | URL                 | Role                                   |
| ------- | ------------------- | -------------------------------------- |
| Rill    | https://userill.com | Agent Accept. ZIP-321 is the new rail. |
| lomi.   | https://lomi.africa | Optional last mile later.              |

## What is in here

- ZIP-321 URI. Sapling receive address (or UA sapling receiver). Memo = `resource_id`
- Outbound regtest hop (`pnpm hop`) as a shielded send proof. Same `resource_id` and receive address as `pnpm invoice`
- Watch-only zcashd observer: import a sapling viewing key, detect the pay (no own scanner)
- Local lab 402 (`pnpm gate`) on `:3210` with x402 v2 `accepts[]` (CipherPay dialect 1 `{ payload: { txid } }`)
- Scan contract (`pnpm scan`): decrypted memo must match `resource_id`. CI uses recorded fixtures

Not in v0: Orchard/UA detection (CipherPay or nerdcash later), Rill production 402, HSM, or live last-mile payouts.

`pnpm install` does not need the Rill monorepo.

## Requirements

- Node.js 20.11+
- pnpm
- Docker Desktop only for `pnpm hop` (proving params on first start)

## Setup

```bash
pnpm install
cp .env.example .env
pnpm hop
pnpm invoice
pnpm decode
```

`pnpm hop` sends a shielded Payment on local **regtest** (Docker payer + watch-only observer). `pnpm invoice` writes a `zcash:` URI to `data/invoice.json` using that receive address and the same `resource_id`. Neither is public Testnet.

Without Docker, skip hop/invoice and use the committed bound pair:

```bash
pnpm typecheck
pnpm test
pnpm decode
```

## HTTP API

```bash
pnpm gate
```

| Method | Path              | Notes                                                                                                      |
| ------ | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET`  | `/r/:resource_id` | **402** + `zip321_uri` + `accepts[]` unpaid. **200** after settled scan or dialect-1 txid. **404** unknown |

```json
{
  "ok": false,
  "error": { "code": "payment_required" },
  "zip321_uri": "zcash:zregtestsapling1…?amount=0.001&memo=…",
  "payment_terms": {
    "resource_id": "…",
    "amount": "0.001",
    "currency_code": "ZEC",
    "rails": ["zip321"]
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "zcash:regtest",
      "asset": "ZEC",
      "amount": "100000",
      "extra": { "payload_dialects": ["txid"] }
    }
  ]
}
```

Paid path: `GET` with `PAYMENT-SIGNATURE` base64 `{"payload":{"txid":"<hop txid>"}}`, or `pnpm scan` (fixture in CI; observer poll live). Reviewer stub: `pnpm unlock -- --lab-stub` (named stub, never `status: settled`).

Unlock production-style goods only on **settled** (confirmations >= `ZCASH_SETTLED_CONFIRMATIONS`, default 10). `final` stays 402 with `payment_status`.

## Checks

```bash
pnpm typecheck
pnpm test
pnpm decode
```

CI on `main` runs typecheck + test. Tests do not need Docker or proving params.

## Local data

| Path                      | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| `data/invoice.json`       | Bound ZIP-321 invoice (committed)               |
| `data/hop-proof.json`     | Regtest shielded hop (committed)                |
| `data/testnet-proof.json` | Pointer at `hop-proof.json`. Not public Testnet |
| `data/receipt.json`       | Unlock JSON (gitignored)                        |
| `keys/` / `.env`          | Secrets (never commit viewing keys)             |

## Notes

- Fail closed if there is no hop receive address: invoice stays `pending`, no fake URI.
- Detection is watch-only zcashd on regtest (Sapling viewing key). Orchard/UA detection is CipherPay or nerdcash later.
- Build order: [docs/BUILD-PHASES.md](./docs/BUILD-PHASES.md). Do not add a production Rill rail from this repo.

## Monorepo

This repo is the public submodule [`rillongit/zcash`](https://github.com/rillongit/zcash) at `apps/zcash` in the private Rill monorepo.

## License

MIT. See [LICENSE](./LICENSE).
