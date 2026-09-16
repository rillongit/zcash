# Build phases

Coding order for [ZCG issue 425](https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/425). Do not rewrite that issue. If ZCG writes a different milestone list after award, follow theirs.

| Phase | Where | What |
| --- | --- | --- |
| 0 | Paperwork | Application frozen. Answer reviewers only. No extra forum posts. |
| 1 | This repo | ZIP-321 invoice + honest regtest hop. Reviewer can `pnpm decode`. Lab 402 unpaid stays closed. Public Testnet only if a node is synced. |
| 2 | This repo + Docker | UFVK + lightwalletd. Compact-block trial-decrypt, full tx for memo, receipt `{ resource_id, receipt_id, txid }`. Unpaid stays closed. |
| 3 | This repo | Lab `GET /r/{id}` 402 + URI, then 200 from **scan**. Agent playbook. No production Rill Spend rewrite. |
| 4 | Private Rill (later) | `zip321` rail on Accept only after this lab is proven. Never from this grant's M3. |

Non-goals stay: no ZEC checkout, no Wave exchange, no spend keys on the server, no librustzcash protocol fork (integration first).
