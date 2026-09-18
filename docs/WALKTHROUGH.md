# Lab 402 walkthrough

Record this from a clone. Docker is optional for the fixture path.

1. `pnpm install && pnpm typecheck && pnpm test && pnpm decode`. Confirm `bound: true`.
2. `rm -f data/receipt.json` then `pnpm gate`.
3. `curl -sS -o /tmp/zcash-404 -w "%{http_code}" http://127.0.0.1:3210/r/not-a-resource` → **404**.
4. `curl -sS http://127.0.0.1:3210/r/<resource_id>` → **402**, `zip321_uri`, and `accepts[]`. URI must start with `zcash:` not `zcash://`.
5. Fixture: `pnpm scan -- --fixture test/fixtures/scan-notes.match.json` → `source: scan`, `status: settled`.
6. Same GET → **200** `{ resource_id, receipt_id, txid, source: "scan", status: "settled" }`.
7. `pnpm scan -- --fixture test/fixtures/scan-notes.mismatch.json` on a **fresh** unpaid invoice must stay **402**.

Without Docker, skip a new hop. The committed `data/invoice.json` and `data/hop-proof.json` are the bound pair. Reviewer fixtures do not need Compose.

With Docker: `pnpm up && pnpm hop && pnpm invoice` first. First hop downloads proving params and starts two amd64 nodes (payer + observer). Then:

1. Unpaid GET → 402 with `accepts[]`.
2. GET with `PAYMENT-SIGNATURE` base64 `{"payload":{"txid":"<hop txid>"}}` → 200 settled.
3. Same with a bogus txid → 402.
4. After `rm data/receipt.json`, `pnpm scan` observer poll → unlocked.

Zashi cannot pay a `uregtest` / `zregtestsapling` URI on Testnet or mainnet. That is honest.

## Live clip

Local `lab/observer-adapter` on 18 Sep 2026. Payer `rill-zcashd-regtest` + observer `rill-zcashd-observer`. Hop used the legacy sapling fallback (`z_getnewaddress sapling`) after UA sapling `z_exportviewingkey` was not usable. Observer imported the sapling viewing key. txid `7b2ce68b3af7d1c61161a45334c0f59c7c51c2ca51baeef93149b83d6624c3ef`, 10 confirmations.

`pnpm decode`:

```json
{
  "resource_id": "c69b98b8-4f69-45a2-adfa-b8d8072b44ad",
  "address": "zregtestsapling1t3ckd75eqcd0swrdmxh7m3ujf6d0045deyxes9c707ud8scj73366wuyp2c7uvnegwn723xn8mt",
  "amount": "0.001",
  "memo": "YzY5Yjk4YjgtNGY2OS00NWEyLWFkZmEtYjhkODA3MmI0NGFk",
  "hop_resource_id": "c69b98b8-4f69-45a2-adfa-b8d8072b44ad",
  "hop_receive_address": "zregtestsapling1t3ckd75eqcd0swrdmxh7m3ujf6d0045deyxes9c707ud8scj73366wuyp2c7uvnegwn723xn8mt",
  "bound": true
}
```

### 1. Unpaid GET → 402 with accepts[]

```bash
curl -sS -D - "http://127.0.0.1:3210/r/c69b98b8-4f69-45a2-adfa-b8d8072b44ad"
```

```
HTTP/1.1 402 Payment Required
content-type: application/json
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6Mi… (x402 v2 JSON, base64)
```

```json
{
  "ok": false,
  "error": {
    "code": "payment_required",
    "message": "Payment required. Pay the ZIP-321 URI, then retry with PAYMENT-SIGNATURE { payload: { txid } }, or pnpm scan (or pnpm unlock -- --lab-stub)."
  },
  "payment_terms": {
    "resource_id": "c69b98b8-4f69-45a2-adfa-b8d8072b44ad",
    "amount": "0.001",
    "currency_code": "ZEC",
    "gate_url": "http://127.0.0.1:3210/r/c69b98b8-4f69-45a2-adfa-b8d8072b44ad",
    "zip321_uri": "zcash:zregtestsapling1t3ckd75eqcd0swrdmxh7m3ujf6d0045deyxes9c707ud8scj73366wuyp2c7uvnegwn723xn8mt?amount=0.001&memo=YzY5Yjk4YjgtNGY2OS00NWEyLWFkZmEtYjhkODA3MmI0NGFk&message=Rill%20ZIP-321%20Accept%20invoice",
    "rails": ["zip321"]
  },
  "zip321_uri": "zcash:zregtestsapling1t3ckd75eqcd0swrdmxh7m3ujf6d0045deyxes9c707ud8scj73366wuyp2c7uvnegwn723xn8mt?amount=0.001&memo=YzY5Yjk4YjgtNGY2OS00NWEyLWFkZmEtYjhkODA3MmI0NGFk&message=Rill%20ZIP-321%20Accept%20invoice",
  "accepts": [
    {
      "scheme": "exact",
      "network": "zcash:regtest",
      "asset": "ZEC",
      "amount": "100000",
      "payTo": "zregtestsapling1t3ckd75eqcd0swrdmxh7m3ujf6d0045deyxes9c707ud8scj73366wuyp2c7uvnegwn723xn8mt",
      "maxTimeoutSeconds": 120,
      "extra": {
        "zip321_uri": "zcash:zregtestsapling1t3ckd75eqcd0swrdmxh7m3ujf6d0045deyxes9c707ud8scj73366wuyp2c7uvnegwn723xn8mt?amount=0.001&memo=YzY5Yjk4YjgtNGY2OS00NWEyLWFkZmEtYjhkODA3MmI0NGFk&message=Rill%20ZIP-321%20Accept%20invoice",
        "memo_base64url": "YzY5Yjk4YjgtNGY2OS00NWEyLWFkZmEtYjhkODA3MmI0NGFk",
        "caip2": "bip122:029f11d80ef9765602235e1bc9727e3e",
        "payload_dialects": ["txid"]
      }
    }
  ]
}
```

### 2. Dialect 1 txid → 200 settled

```bash
SIG=$(python3 -c 'import json,base64,sys; print(base64.b64encode(json.dumps({"payload":{"txid":sys.argv[1]}}).encode()).decode())' 7b2ce68b3af7d1c61161a45334c0f59c7c51c2ca51baeef93149b83d6624c3ef)
curl -sS -D - -H "PAYMENT-SIGNATURE: $SIG" "http://127.0.0.1:3210/r/c69b98b8-4f69-45a2-adfa-b8d8072b44ad"
```

```
HTTP/1.1 200 OK
content-type: application/json
PAYMENT-RESPONSE: eyJ4NDAyVmVyc2lvbiI6Miwic3VjY2VzcyI6dHJ1ZSwidHhpZCI6IjdiMmNlNjhiM2FmN2QxYzYxMTYxYTQ1MzM0YzBmNTljN2M1MWMyY2E1MWJhZWVmOTMxNDliODNkNjYyNGMzZWYiLCJyZWNlaXB0X2lkIjoicmNwdF96Y2FzaF9jNjliOThiOCJ9
```

```json
{
  "ok": true,
  "unlocked": true,
  "resource_id": "c69b98b8-4f69-45a2-adfa-b8d8072b44ad",
  "receipt_id": "rcpt_zcash_c69b98b8",
  "txid": "7b2ce68b3af7d1c61161a45334c0f59c7c51c2ca51baeef93149b83d6624c3ef",
  "source": "scan",
  "status": "settled",
  "confirmations": 10,
  "network": "regtest",
  "observer": "zcashd-viewkey"
}
```

### 3. Bogus txid → 402

After `rm data/receipt.json`, same GET with `{"payload":{"txid":"deadbeef…"}}` → **402 Payment Required**, `accepts[]` unchanged, no `payment_status`.

### 4. Observer poll `pnpm scan` → unlocked

```
unlocked
Memo matched resource_id.
{
  "resource_id": "c69b98b8-4f69-45a2-adfa-b8d8072b44ad",
  "receipt_id": "rcpt_zcash_c69b98b8",
  "txid": "7b2ce68b3af7d1c61161a45334c0f59c7c51c2ca51baeef93149b83d6624c3ef",
  "source": "scan",
  "status": "settled",
  "confirmations": 10,
  "network": "regtest",
  "observer": "zcashd-viewkey"
}
```

Following GET is **200** with the same settled receipt.

Agent steps: [PLAYBOOK.md](./PLAYBOOK.md). Ops: [OPS.md](./OPS.md).
