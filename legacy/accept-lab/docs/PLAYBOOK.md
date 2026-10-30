# Agent playbook

Lab only. Regtest URIs do not pay on Testnet or mainnet. Production Rill stays MPP / x402.

1. Run `pnpm hop && pnpm invoice && pnpm decode` (Docker) or use the committed invoice on clone.
2. Start `pnpm gate`.
3. `GET http://127.0.0.1:3210/r/{resource_id}` with no receipt. Expect **402**, `zip321_uri`, and x402 v2 `accepts[]`.
4. Hand the `zcash:` URI to a human (Zashi on a matching network) or keep it as the agent challenge.
5. Detect pay with the watch-only observer (Sapling viewing key): retry GET with `PAYMENT-SIGNATURE` `{ payload: { txid } }`, or `pnpm scan` (fixture in CI). Do not put a spend key on the server. Do not write a scanner.
6. `GET /r/{resource_id}` again. Expect **200** `{ resource_id, receipt_id, txid, source: "scan", status: "settled" }`.
7. Unpaid stays **402**. `final` (too few confirmations) stays **402** with `payment_status`. Unknown ids stay **404**.

Reviewers without the observer may run `pnpm unlock -- --lab-stub`. That is a hop-txid copy, not settled view-key scan.

HTTP clip: [WALKTHROUGH.md](./WALKTHROUGH.md). Mapping: [RILL-INTEGRATION-CONTRACT.md](./RILL-INTEGRATION-CONTRACT.md).
