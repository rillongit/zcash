# zcash

Shielded Zcash settlement for [lomi.](https://lomi.africa) and [Rill](https://userill.com).

**lomi.** is a live payment processor for francophone West Africa. Merchants collect XOF on Wave, MTN, cards, and bank rails. **Rill** is the agent payment control plane from the same company: humans fund, agents Accept and Spend.

This repository is the Zcash app we are shipping. A shielded receive is the correspondent hop. Last mile stays Wave, MTN, or SPI. Merchants never hold keys. We do not issue a token. This is not a ZEC checkout.

Payout mapping: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

The shielded testnet hop, memo reconcile, and HTTP payout shape land next in this repo. Not wired to lomi. live systems until an allowlisted payout path exists.

## Products

| Product | URL | Role |
| --- | --- | --- |
| lomi. | https://lomi.africa | Fiat PSP. Wave, MTN, cards, SPI. |
| Rill | https://userill.com | Agent Accept (MPP / x402) and Spend. |

Company: lomi.africa S.A.R.L., Abidjan.

## What ships here

- Custodial omnibus. Shielded receive. Memo = `payout_id`.
- Reconcile against that id. Last mile unchanged.
- Fail closed until a shielded testnet hop is in `data/testnet-proof.json` (`status: shielded`).

Not in v0: HSM/KMS, mainnet keys, or calls into the live PSP API.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm hop
```

`pnpm hop` needs `zcash-cli` (or `ZCASH_CLI`) and a testnet RPC. Without that, proof stays `pending`. Do not treat a pending proof as a live hop.

## License

MIT. See [LICENSE](./LICENSE).
