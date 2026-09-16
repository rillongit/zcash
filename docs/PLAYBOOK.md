# Agent playbook

Lab only. Regtest URIs do not pay on Testnet or mainnet. Production Rill stays MPP / x402.

1. Run `pnpm hop && pnpm invoice && pnpm decode` (Docker) or use the committed invoice on clone.
2. Start `pnpm gate`.
3. `GET http://127.0.0.1:3210/r/{resource_id}` with no receipt. Expect **402** and `zip321_uri`.
4. Hand the `zcash:` URI to a human (Zashi on a matching network) or keep it as the agent challenge.
5. Detect pay with `pnpm scan` (fixture in CI; live UFVK sidecar later). Do not put a spend key on the server.
6. `GET /r/{resource_id}` again. Expect **200** `{ resource_id, receipt_id, txid, source: "scan" }`.
7. Unpaid stays **402**. Unknown ids stay **404**.

Reviewers without a scanner may run `pnpm unlock -- --lab-stub`. That is a hop-txid copy, not milestone 2.
