# Architecture

Custodial correspondent hop on Zcash. Fiat last mile stays on lomi.

## Flow

1. Merchant already collected XOF on Wave, MTN, cards, or SPI.
2. Treasury holds a shielded omnibus address. Merchants never receive keys.
3. Inbound ZEC lands on that address. Memo carries `payout_id`.
4. Reconcile that id. Then pay the last mile as Wave, MTN, or SPI.

## Mapping

| App | Production analogue |
| --- | --- |
| Shielded omnibus | Custodial treasury |
| Memo = `payout_id` | Ledger key for the last-mile payout |
| Transparent spend to a merchant wallet | Not this product |
| Wave / MTN / SPI | Last mile |

ZEC is not a merchant `currency_code` on the live PSP. There is no public `POST /payouts` rail until an allowlisted test org exists.

## Guardrails

- Shielded receive. Not a transparent-only demo.
- New mainnet addresses. Never reuse testnet secrets.
- No ZEC balance on merchant `accounts`.
- Fail closed if the hop is missing or the memo is missing.
