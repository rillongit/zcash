# Build phases

Coding order for [ZCG issue 425](https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/425). Do not rewrite that issue. If ZCG writes a different milestone list after award, follow theirs.

| Phase | Where | What |
| --- | --- | --- |
| 0 | Paperwork | Application frozen. Answer reviewers only. No extra forum posts. |
| 1 | This repo | ZIP-321 invoice + honest regtest hop. Reviewer can `pnpm decode`. Lab 402 unpaid stays closed. Public Testnet only if a node is synced. |
| 2 | This repo + Docker | Reuse detection. Watch-only zcashd observer with a sapling viewing key. Do not write a scanner. Receipt `{ resource_id, receipt_id, txid, status }`. Unpaid stays closed. `final` vs `settled`. |
| 3 | This repo | Lab `GET /r/{id}` 402 + URI + x402 v2 `accepts[]`, then 200 from **settled** scan or dialect-1 txid. Agent playbook. No production Rill Spend rewrite. |
| 4 | Private Rill (later) | `zip321` rail on Accept only after this lab is proven. Never from this grant's M3. |

**Next phase:** testnet against CipherPay `POST /api/x402/v2/verify`. Orchard/UA detection stays with CipherPay or nerdcash.

Non-goals stay: no ZEC checkout, no Wave exchange, no spend keys on the server, no librustzcash protocol fork (integration first), no third scanner.
