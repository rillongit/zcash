# Technical architecture: ZIP-321 Accept (Rill)

**Repo:** [github.com/rillongit/zcash](https://github.com/rillongit/zcash)  
**Product:** [Rill](https://userill.com)  
**Network:** honest **regtest**. Public Testnet is milestone 1 if a node can sync.  
**Grant:** [ZCG issue 425](https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/425)

Rill already returns HTTP 402 for unpaid Accept (MPP / x402). This lab adds a shielded `zcash:` invoice so an agent can pay a Rill resource without a public graph. It is not wired to live Rill or lomi. APIs.

## 1. Goal

- Agent hits `GET /r/{id}` unpaid and gets 402 plus a ZIP-321 URI.
- Unified address, amount, memo = `resource_id`.
- Human Zashi (or a later Spend path) pays shielded.
- Seller watches with a viewing key. Spend keys stay off the server.
- Unlock is a receipt `{ resource_id, receipt_id, txid }` in the same shape as MPP / x402.

Fiat last mile on [lomi.](https://lomi.africa) is later, not this lab. Production Rill rails stay `mpp | x402 | rill` until this path is proven.

## 2. System overview

```
Agent or human
  GET /r/{resource_id}
        |
        v
This lab (regtest)
  402 + zcash: URI          unpaid
  200 + receipt JSON        after scan (or named lab stub)
        |
        v
ZIP-321 (ZIP-316 UA)
  memo = resource_id (base64url on the URI, hex on the hop)
        |
        v
zcashd regtest + lightwalletd (lab compose)
  outbound hop: pnpm hop
  inbound detect: UFVK scan (funded; fixture contract today)
```

| Building block | Role | In this repo |
| --- | --- | --- |
| ZIP-321 URI | Payment request | `pnpm invoice` / `data/invoice.json` |
| Shielded hop | Outbound proof, memo = resource_id | `pnpm hop` / `data/hop-proof.json` |
| Lab 402 | Rill-shaped challenge | `pnpm gate` |
| Scan contract | Memo match → receipt | `pnpm scan` + fixtures |
| UFVK + lightwalletd | Detect pay without spend key | Compose + `scanner/` (live decrypt not in the sidecar yet) |

## 3. What runs today

Clone and run without the Rill monorepo.

| Capability | Status |
| --- | --- |
| ZIP-321 URI, memo = resource_id | `pnpm invoice` / `pnpm decode` |
| Regtest shielded send | `pnpm hop` (Docker) |
| Lab `GET /r/{id}` 402 / 200 | `pnpm gate` |
| Scanner contract (fixture notes) | `pnpm scan -- --fixture …` |
| Live UFVK trial-decrypt | Fail closed (`scanner --lightwalletd`) |
| Public Testnet explorer tx | Not yet. `data/testnet-proof.json` points at the regtest hop |
| Production Rill `zip321` rail | Out of scope until view-key reconcile is real |

Reproduce without Docker: `pnpm install && pnpm test && pnpm decode`.  
Reproduce the 402: `pnpm gate`, then the HTTP table in the README.

## 4. Settlement flow

1. Bind a hop and invoice so memo and receive UA match (`pnpm hop && pnpm invoice`).
2. Agent `GET /r/{resource_id}` with no receipt → **402** + `zip321_uri`.
3. Human pays the URI on a matching network (Zashi). Lab URIs are **regtest**.
4. Detect: trial-decrypt compact outputs with a UFVK, fetch the full tx (ZIP-307 omits memos), match memo to `resource_id`.
5. Write `data/receipt.json`. Next GET is **200**.
6. Unknown ids stay **404**. Wrong memo stays **402**.

CI step 4 uses recorded decrypted notes. Live decrypt is milestone 2.

## 5. ZIP map

| ZIP | Lab | Later |
| --- | --- | --- |
| ZIP-321 | `zcash:` URI, unpadded base64url memo | Same on Testnet / mainnet |
| ZIP-316 | Unified address + UFVK | Server holds UFVK only |
| ZIP-307 | Compact blocks omit memos | Fetch full tx after a trial-decrypt hit |

No `zcash://`. No transparent address with a memo. `zcashd` `z_importviewingkey` does not import unified viewing keys; do not treat RPC watch as M2.

## 6. Data model

Lab files (see README). Receipt shape:

```
resource_id, receipt_id, txid, source (scan | lab-stub)
```

`source: scan` is the paid path. `source: lab-stub` copies the hop txid for reviewers without a scanner.

## 7. Infra

- `zcashd` regtest (`rill-zcashd-regtest`). RPC user `rill`.
- `lightwalletd` on `127.0.0.1:9067` (lab). Image `v0.4.2` is old: it dies if zcashd mines more than 100 blocks on first sync, and it may fail to parse current zcashd coinbases. Restart it after `pnpm hop`. Compact blocks omit memos (ZIP-307). Live UFVK decrypt is not in the sidecar yet.
- `scanner/` sidecar: fixture pass-through today; `--lightwalletd` fails closed until `zcash_client_backend` is wired. Never commit `ZCASH_UFVK`.

## 8. Custody

- Seller viewing key only. Never a spend key on the server.
- Lab: gitignored `.env` / `keys/` / zcashd datadir.
- Live: HSM/KMS later. New mainnet addresses. Never reuse testnet secrets.

## 9. If we take this live

See [BUILD-PHASES.md](./BUILD-PHASES.md). Short version:

1. Keep this repo public: invoice, hop proof, decode, lab 402, scanner contract.
2. UFVK scan against lightwalletd. Paid GET 200 from scan, not a copied txid.
3. Adapter notes for Rill Accept. No production Spend rewrite in the grant.
4. Public Testnet hop when a dedicated node can sync. Fail closed until then.

## 10. Adapter notes

Field map to Rill Accept: [RILL-INTEGRATION-CONTRACT.md](./RILL-INTEGRATION-CONTRACT.md).
