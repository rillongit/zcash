# Technical architecture: ZIP-321 Accept (Rill)

**Repo:** [github.com/rillongit/zcash](https://github.com/rillongit/zcash)  
**Product:** [Rill](https://userill.com)  
**Network:** honest **regtest**. Public Testnet is later, against CipherPay `POST /api/x402/v2/verify`.  
**Grant:** [ZCG issue 425](https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/425)

Rill already returns HTTP 402 for unpaid Accept (MPP / x402). This lab adds a shielded `zcash:` invoice so an agent can pay a Rill resource without a public graph. It is not wired to live Rill or lomi. APIs.

## 1. Goal

- Agent hits `GET /r/{id}` unpaid and gets 402 plus a ZIP-321 URI and an x402 v2 `accepts[]` challenge.
- Sapling address, amount, memo = `resource_id`.
- Human Zashi (or a later Spend path) pays shielded.
- Seller watches with a sapling viewing key on a watch-only zcashd observer. Spend keys stay off the server. No own scanner.
- Unlock is a receipt `{ resource_id, receipt_id, txid, status }` in the same shape as MPP / x402. Production-style goods unlock only on `settled`.

Fiat last mile on [lomi.](https://lomi.africa) is later, not this lab. Production Rill rails stay `mpp | x402 | rill` until this path is proven.

## 2. System overview

```
Agent or human
  GET /r/{resource_id}
        |
        v
This lab (regtest)
  402 + zcash: URI + accepts[]     unpaid
  402 + payment_status             final (seen, not settled)
  200 + receipt JSON               settled scan or dialect-1 txid
        |
        v
ZIP-321
  memo = resource_id (base64url on the URI, hex on the hop)
        |
        v
zcashd payer + zcashd observer (compose)
  outbound hop: pnpm hop (sapling send, export viewing key, import on observer)
  inbound detect: z_viewtransaction / z_listreceivedbyaddress (no stub scanner)
```

| Building block | Role | In this repo |
| --- | --- | --- |
| ZIP-321 URI | Payment request | `pnpm invoice` / `data/invoice.json` |
| Shielded hop | Outbound proof, memo = resource_id | `pnpm hop` / `data/hop-proof.json` |
| Lab 402 | Rill-shaped x402 v2 challenge | `pnpm gate` |
| Scan contract | Memo match → settled receipt | `pnpm scan` + fixtures |
| Watch-only observer | Detect pay without spend key | Compose `zcashd-observer` |

Orchard/UA detection is CipherPay or nerdcash later, not this lab.

## 3. What runs today

Clone and run without the Rill monorepo.

| Capability | Status |
| --- | --- |
| ZIP-321 URI, memo = resource_id | `pnpm invoice` / `pnpm decode` |
| Regtest shielded send | `pnpm hop` (Docker payer) |
| Watch-only sapling view-key detect | Compose observer + `z_importviewingkey` |
| Lab `GET /r/{id}` 402 / 200 | `pnpm gate` |
| Dialect 1 `{ payload: { txid } }` | `PAYMENT-SIGNATURE` |
| Scanner contract (fixture notes) | `pnpm scan -- --fixture …` |
| Public Testnet explorer tx | Not yet. `data/testnet-proof.json` points at the regtest hop |
| Production Rill `zip321` rail | Out of scope until CipherPay testnet verify |

Reproduce without Docker: `pnpm install && pnpm test && pnpm decode`.  
Reproduce the 402: `pnpm gate`, then the HTTP table in the README.

## 4. Settlement flow

1. Bind a hop and invoice so memo and receive address match (`pnpm hop && pnpm invoice`).
2. Agent `GET /r/{resource_id}` with no receipt → **402** + `zip321_uri` + `accepts[]`.
3. Human pays the URI on a matching network (Zashi). Lab URIs are **regtest**.
4. Detect: observer `z_viewtransaction` / `z_listreceivedbyaddress` with the imported sapling viewing key. Match address, memo = `resource_id`, amount >= expected.
5. `final` (confirmations >= 1, below threshold) stays **402** with `payment_status`. `settled` writes `data/receipt.json`. Next GET is **200**.
6. Unknown ids stay **404**. Wrong memo stays **402**.

CI step 4 uses recorded decrypted notes. Live detect uses the observer, not a sidecar crate.

## 5. ZIP map

| ZIP | Lab | Later |
| --- | --- | --- |
| ZIP-321 | `zcash:` URI, unpadded base64url memo | Same on Testnet / mainnet |
| ZIP-316 | Unified address exists; this lab exports the sapling receiver | Orchard/UA via CipherPay or nerdcash |
| ZIP-307 | Compact blocks omit memos | Not used; observer is full zcashd |

No `zcash://`. No transparent address with a memo.

## 6. Data model

Lab files (see README). Receipt shape:

```
resource_id, receipt_id, txid, source (scan | lab-stub)
optional: status (final | settled), confirmations, network, observer
```

`source: scan` with `status: settled` is the paid path. `source: lab-stub` copies the hop txid for reviewers and never reports settled.

## 7. Infra

- Payer `zcashd` regtest (`rill-zcashd-regtest`). RPC user `rill`. Listens on P2P 18444.
- Observer `zcashd` (`rill-zcashd-observer`) is watch-only: `-listen=0`, `-connect=zcashd`, host RPC `127.0.0.1:18233`. Shares proving params with the payer. No `lightwalletd`.
- Hop exports a sapling viewing key on the payer and imports it on the observer (`whenkeyisnew`, height 0). The key is never written under `data/` or logs.
- Never commit viewing keys or spend keys.

## 8. Custody

- Seller viewing key only. Never a spend key on the server.
- Lab: gitignored `.env` / `keys/` / zcashd datadir.
- Live: HSM/KMS later. New mainnet addresses. Never reuse testnet secrets.

## 9. If we take this live

See [BUILD-PHASES.md](./BUILD-PHASES.md). Short version:

1. Keep this repo public: invoice, hop proof, decode, lab 402, observer contract.
2. Reuse detection. Do not write a scanner.
3. Next: testnet against CipherPay `POST /api/x402/v2/verify`.
4. Adapter notes for Rill Accept. No production Spend rewrite in the grant.

## 10. Adapter notes

Field map to Rill Accept: [RILL-INTEGRATION-CONTRACT.md](./RILL-INTEGRATION-CONTRACT.md).
