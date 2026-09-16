# Lab 402 walkthrough

Record this from a clone of `main`. Docker is optional.

1. `pnpm install && pnpm typecheck && pnpm test && pnpm decode`. Confirm `bound: true` and a shielded `uregtest…` address.
2. `rm -f data/receipt.json` then `pnpm gate`.
3. `curl -sS -o /tmp/zcash-404 -w "%{http_code}" http://127.0.0.1:3210/r/not-a-resource` → **404**.
4. `curl -sS http://127.0.0.1:3210/r/<resource_id>` → **402** and `zip321_uri`. URI must start with `zcash:` not `zcash://`.
5. `pnpm scan -- --fixture test/fixtures/scan-notes.match.json` → `source: scan`.
6. Same GET → **200** `{ resource_id, receipt_id, txid, source: "scan" }`.
7. `pnpm scan -- --fixture test/fixtures/scan-notes.mismatch.json` on a **fresh** unpaid invoice must stay **402**.

Without Docker, skip a new hop. The committed `data/invoice.json` and `data/hop-proof.json` are the bound pair.

With Docker: `pnpm up && pnpm hop && pnpm invoice` first. First hop downloads proving params. After the rpcuser rename or `lightwalletd=1` on an old volume, `docker compose down -v` once. Then `docker compose restart lightwalletd` after the hop.

Zashi cannot pay a `uregtest` URI on Testnet or mainnet. That is honest.

Agent steps: [PLAYBOOK.md](./PLAYBOOK.md). Ops: [OPS.md](./OPS.md).
