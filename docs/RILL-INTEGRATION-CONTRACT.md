# Rill Accept mapping

How this lab mirrors Rill 402 payment terms without writing to the Rill API or adding a production `zip321` rail.

## Production reference

| Concept     | Location           | Notes                                         |
| ----------- | ------------------ | --------------------------------------------- |
| Pay link    | Rill `GET /r/{id}` | Unpaid → HTTP 402 with payment terms          |
| Rails today | `@userill/accept`  | `mpp` \| `x402` \| `rill`                     |
| Receipt     | Rill verify        | `{ resource_id, receipt_id }` plus rail tx id |
| Spend       | `rill_vw_*`        | Unchanged in ZCG milestone 3                  |

There is no `zip321` value on live Rill until this lab's view-key path is proven.

## Lab mapping

### HTTP

| Lab                                                                     | Prod analogue                                                                                                     |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET /r/{resource_id}` 402                                              | Accept challenge. Body includes `zip321_uri`, `payment_terms`, and x402 v2 `accepts[]`. Header `PAYMENT-REQUIRED` |
| `GET /r/{resource_id}` with `PAYMENT-SIGNATURE` `{ payload: { txid } }` | CipherPay dialect 1. Settled → 200 + `PAYMENT-RESPONSE`. Final → 402 + `payment_status`                           |
| `GET /r/{resource_id}` 200                                              | Receipt unlock after settled scan                                                                                 |
| `GET /r/{unknown}` 404                                                  | Unknown resource                                                                                                  |

### Fields

| Lab field                  | Rill / future                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `resource_id`              | Ledger key (memo on ZIP-321)                                                             |
| `zip321_uri`               | Extra payment term beside MPP / x402                                                     |
| `accepts[].amount`         | Zatoshis string                                                                          |
| `amount` / `currency_code` | `ZEC` in the lab                                                                         |
| `receipt_id`               | `rcpt_zcash_*`                                                                           |
| `txid`                     | Shielded hop or scanned tx                                                               |
| `status`                   | `final` (not enough confirmations) or `settled` (unlock). Lab-stub never reports settled |
| `source`                   | `scan` (paid) or `lab-stub` (reviewer only)                                              |

### Orchestration

1. **closed**: invoice ready, no receipt → 402.
2. **scan**: decrypted memo matches `resource_id` and confirmations meet the settled threshold → write receipt, next GET is 200.
3. **dialect 1**: `PAYMENT-SIGNATURE` `{ payload: { txid } }` verified by the observer.
4. **lab-stub**: copies hop txid. Not view-key scan. Never `status: settled`.
5. **failed**: no hop / no receive address → invoice `pending`, no fake URI.

## Later (private Rill)

1. Add `zip321` to Accept rails only after CipherPay testnet verify is real.
2. Keep Spend as MPP / x402 in this grant.
3. Do not put a spend key in `apps/api`.
4. Do not write a scanner; reuse CipherPay / nerdcash / this watch-only observer.

## Non-goals

- No edits to the Rill monorepo from this lab
- No merchant or agent spend-key custody
- No mainnet or public Testnet until a dedicated node can sync
