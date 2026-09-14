# Architecture

Rill Accept challenge on Zcash. Fiat last mile on [lomi.](https://github.com/lomiafrica/zcash) is optional and last.

## Flow

1. Agent calls a Rill pay link (`GET /r/{id}`) with no receipt.
2. Gate returns 402 plus a ZIP-321 URI: unified address, amount, memo = `resource_id`.
3. Human Zashi (or a later Spend path) pays shielded. Server holds a viewing key only.
4. Reconcile the memo. Unlock with a receipt (`rcpt_zcash_*`).
5. Later, if the seller wants XOF, lomi. pays Wave, MTN, or SPI. That last mile is not private.

## Mapping

| App | Production analogue |
| --- | --- |
| ZIP-321 URI | Rill 402 payment terms |
| Memo = `resource_id` | Receipt / ledger key |
| Viewing key scan | Detect paid without spend authority |
| Wave / MTN / SPI | Optional last mile after confirm |

There is no production Rill `zip321` rail until the lab invoice is proven. lomi. last mile stays in [lomiafrica/zcash](https://github.com/lomiafrica/zcash).

## Guardrails

- Shielded receive. Memo requires a unified or Sapling address.
- ZIP-321 URIs use `zcash:` not `zcash://`.
- New mainnet addresses. Never reuse testnet secrets.
- Fail closed if the hop or invoice cannot be built.
