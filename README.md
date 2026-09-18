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

| Product | URL | Role |
| --- | --- | --- |
| Rill | https://userill.com | Agent Accept. ZIP-321 is the new rail. |
| lomi. | https://lomi.africa | Optional last mile later. |

## What is in here

- ZIP-321 URI. Unified address. Memo = `resource_id`
- Outbound regtest hop (`pnpm hop`) as a shielded send proof. Same `resource_id` and receive UA as `pnpm invoice`
- Local lab 402 (`pnpm gate`) on `:3210`
- Scanner contract (`pnpm scan`): decrypted memo must match `resource_id`. CI uses recorded fixtures
- lightwalletd in Compose (`127.0.0.1:9067`). Live UFVK decrypt is not in the sidecar yet

Not in v0: live UFVK trial-decrypt, Rill production 402, HSM, or live last-mile payouts.

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

`pnpm hop` sends a shielded Payment on local **regtest** (Docker). `pnpm invoice` writes a `zcash:` URI to `data/invoice.json` using that receive UA and the same `resource_id`. Neither is public Testnet.

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

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/r/:resource_id` | **402** + `zip321_uri` unpaid. **200** after scan. **404** unknown |

```json
{
  "ok": false,
  "error": { "code": "payment_required" },
  "zip321_uri": "zcash:uregtest1…?amount=0.001&memo=…",
  "payment_terms": {
    "resource_id": "…",
    "amount": "0.001",
    "currency_code": "ZEC",
    "rails": ["zip321"]
  }
}
```

Paid path: `pnpm scan -- --fixture test/fixtures/scan-notes.match.json`. Reviewer stub: `pnpm unlock -- --lab-stub`.

## Checks

```bash
pnpm typecheck
pnpm test
pnpm decode
```

CI on `main` runs typecheck + test. Tests do not need Docker or proving params.

## Local data

| Path | Purpose |
| --- | --- |
| `data/invoice.json` | Bound ZIP-321 invoice (committed) |
| `data/hop-proof.json` | Regtest shielded hop (committed) |
| `data/testnet-proof.json` | Pointer at `hop-proof.json`. Not public Testnet |
| `data/receipt.json` | Unlock JSON (gitignored) |
| `keys/` / `.env` | UFVK and secrets (never commit) |

## Notes

- Fail closed if there is no hop UA: invoice stays `pending`, no fake URI.
- Compact blocks omit memos (ZIP-307). Live detect fetches the full tx after trial-decrypt.
- Build order: [docs/BUILD-PHASES.md](./docs/BUILD-PHASES.md). Do not add a production Rill rail from this repo.

## Monorepo

This repo is the public submodule [`rillongit/zcash`](https://github.com/rillongit/zcash) at `apps/zcash` in the private Rill monorepo.

## License

MIT. See [LICENSE](./LICENSE).
