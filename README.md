# zcash

Shielded [ZIP-321](https://zips.z.cash/zip-0321) invoices for [Rill](https://userill.com).

**Rill** is the agent payment control plane: humans fund, agents Accept and Spend (MPP / x402 today). This repository adds a shielded `zcash:` invoice so an agent can pay a Rill pay link without a public graph.

We also have [lomi.](https://lomi.africa). Fiat last mile is later, not this product.

Merchants and agents never hold spend keys. The seller watches with a viewing key. We do not issue a token. This is not a ZEC checkout and not a Wave exchange.

Mapping: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

Not wired to live Rill or lomi. APIs until the invoice path is proven.

## Products

| Product | URL | Role |
| --- | --- | --- |
| Rill | https://userill.com | Agent Accept. ZIP-321 is the new rail. |
| lomi. | https://lomi.africa | Optional last mile later. |

## What ships here

- ZIP-321 URI. Unified address. Memo = `resource_id`.
- Outbound regtest hop (`pnpm hop`) as a shielded send proof.
- Fail closed if there is no address and no hop.

Not in v0: view-key scanner, Rill production 402, HSM, or live last-mile payouts.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm hop
pnpm invoice
```

`pnpm hop` sends a shielded Payment on local **regtest** (Docker). `pnpm invoice` writes a Zashi-scannable `zcash:` URI to `data/invoice.json` using that omnibus address. Neither is public Testnet.

```bash
pnpm typecheck
pnpm test
```

## License

MIT. See [LICENSE](./LICENSE).
