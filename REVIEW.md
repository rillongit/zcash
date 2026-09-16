# Review this lab in 10 minutes

Rill already runs HTTP 402 Accept (MPP / x402) at [userill.com](https://userill.com). This repository is the ZIP-321 lab for [ZCG issue 425](https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/425). It is not a ZEC checkout, not a Wave exchange, and not wired to live Rill.

Public Testnet and live UFVK scan are funded milestones. Today is honest **regtest**. `pnpm unlock` is a lab stub. Paid path is `pnpm scan`.

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

## With Docker (shielded send)

First `pnpm hop` can take a while while proving params download. After a rpcuser rename, `docker compose down -v` once if an old `lomi` container is still around.

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

Expect **402** and `zip321_uri`. Copy `resource_id` from `pnpm decode`. Unpaid stays closed.

Paid path (memo match from recorded notes; not live UFVK decrypt):

```bash
pnpm scan -- --fixture test/fixtures/scan-notes.match.json
curl -sS "http://127.0.0.1:3210/r/<resource_id>"
```

Expect **200** with `{ resource_id, receipt_id, txid, source: "scan" }`.

Reviewer stub without a scanner:

```bash
pnpm unlock -- --lab-stub
```

That copies the hop txid into a receipt with `source: "lab-stub"`. It is **not** lightwalletd / UFVK scan. Compose also starts `lightwalletd` on `127.0.0.1:9067`. Live `--lightwalletd` on the sidecar fails closed until trial-decrypt exists.

Agent steps: [docs/PLAYBOOK.md](./docs/PLAYBOOK.md).
