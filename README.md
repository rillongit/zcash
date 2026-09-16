# zcash

Shielded [ZIP-321](https://zips.z.cash/zip-0321) invoices for [Rill](https://userill.com).

**Rill** is the agent payment control plane: humans fund, agents Accept and Spend (MPP / x402 today). This repository adds a shielded `zcash:` invoice so an agent can pay a Rill pay link without a public graph.

We also have [lomi.](https://lomi.africa). Fiat last mile is later, not this product.

Merchants and agents never hold spend keys. The seller watches with a viewing key. We do not issue a token. This is not a ZEC checkout and not a Wave exchange.

Mapping: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

Reviewer path: [REVIEW.md](./REVIEW.md)

Agent playbook: [docs/PLAYBOOK.md](./docs/PLAYBOOK.md)

Not wired to live Rill or lomi. APIs until the invoice plus view-key path is proven.

## Products

| Product | URL | Role |
| --- | --- | --- |
| Rill | https://userill.com | Agent Accept. ZIP-321 is the new rail. |
| lomi. | https://lomi.africa | Optional last mile later. |

## What ships here

- ZIP-321 URI. Unified address. Memo = `resource_id`.
- Outbound regtest hop (`pnpm hop`) as a shielded send proof. Same `resource_id` and receive UA as `pnpm invoice`.
- Local lab 402 (`pnpm gate`): unpaid `GET /r/:id` stays closed until a **scan** receipt (or the named lab stub).
- Scanner contract: decrypted memo must match `resource_id` (`pnpm scan`). CI uses recorded fixtures. Live UFVK decrypt is not in the sidecar yet.
- Fail closed if there is no address and no hop.

Not in v0: live UFVK trial-decrypt, Rill production 402, HSM, or live last-mile payouts.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm hop
pnpm invoice
pnpm decode
```

`pnpm hop` sends a shielded Payment on local **regtest** (Docker). `pnpm invoice` writes a `zcash:` URI to `data/invoice.json` using that receive UA and the same `resource_id`. Neither is public Testnet.

```bash
pnpm typecheck
pnpm test
pnpm gate
```

Then `GET http://127.0.0.1:3210/r/{resource_id}` is **402** until `pnpm scan` (or `pnpm unlock -- --lab-stub`). See [REVIEW.md](./REVIEW.md).

## License

MIT. See [LICENSE](./LICENSE).
