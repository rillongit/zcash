# Review this lab in 10 minutes

Rill already runs HTTP 402 Accept (MPP / x402) at [userill.com](https://userill.com). This repository is the ZIP-321 lab for [ZCG issue 425](https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/425). It is not a ZEC checkout, not a Wave exchange, and not wired to live Rill.

Public Testnet and CipherPay verify are later. Today is honest **regtest**. `pnpm unlock` is a named lab stub (never `status: settled`). Paid path is view-key detection: `pnpm scan` or `PAYMENT-SIGNATURE` dialect 1 `{ payload: { txid } }`.

## Without Docker

```bash
git clone https://github.com/rillongit/zcash.git
cd zcash
pnpm install
pnpm typecheck
pnpm test
pnpm decode
```

`pnpm decode` prints `resource_id` from `data/invoice.json`. That id must match `data/hop-proof.json`. Hex memo on the hop and base64url memo on the URI are the same UTF-8 id.

`data/testnet-proof.json` is a pointer to `hop-proof.json` (the hop is not public Testnet).

CI uses recorded fixtures (`test/fixtures/scan-notes.*.json` and `test/fixtures/observer-listreceived.json`). No Docker, no viewing key.

## With Docker (shielded send + observer)

First `pnpm hop` can take a while while proving params download and two amd64 nodes start (payer + watch-only observer). After a rpcuser rename, `docker compose down -v` once if an old volume is still around (that also drops params).

```bash
pnpm up
pnpm hop
pnpm invoice
pnpm decode
```

In another terminal: `pnpm gate`. Then:

```bash
curl -sS "http://127.0.0.1:3210/r/<resource_id>"
```

Expect **402**, `zip321_uri`, `accepts[]`, and a `PAYMENT-REQUIRED` header. Copy `resource_id` from `pnpm decode`. Unpaid stays closed.

Paid path (watch-only sapling viewing key on the observer; hop txid):

```bash
SIG=$(python3 -c 'import json,base64,sys; print(base64.b64encode(json.dumps({"payload":{"txid":sys.argv[1]}}).encode()).decode())' <txid>)
curl -sS -D - -H "PAYMENT-SIGNATURE: $SIG" "http://127.0.0.1:3210/r/<resource_id>"
```

Expect **200** with `{ resource_id, receipt_id, txid, source: "scan", status: "settled" }`.

Fixture path (CI / reviewers without Docker):

```bash
pnpm scan -- --fixture test/fixtures/scan-notes.match.json
curl -sS "http://127.0.0.1:3210/r/<resource_id>"
```

Reviewer stub without view-key scan:

```bash
pnpm unlock -- --lab-stub
```

That copies the hop txid into a receipt with `source: "lab-stub"`. It is **not** settled view-key detection.

Agent steps: [docs/PLAYBOOK.md](./docs/PLAYBOOK.md). HTTP clip: [docs/WALKTHROUGH.md](./docs/WALKTHROUGH.md). Phases: [docs/BUILD-PHASES.md](./docs/BUILD-PHASES.md).
