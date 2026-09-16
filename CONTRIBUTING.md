# Contributing

This is the Rill ZIP-321 Accept lab. Keep it small. Do not wire live Rill or lomi. payouts from here.

## Code

- TypeScript, `pnpm typecheck` before a PR.
- Shielded ZIP-321 receive. Memo = `resource_id`. Spend keys stay off the server.
- Fail closed if the invoice cannot be built.
- Never commit `.env`, `keys/`, `wallet.dat`, zcashd datadir contents, viewing keys, or spend keys.
- `ZCASH_UFVK` stays in `.env` only.

## Git

- Branch from `main`. Open a pull request.
- Commits explain why, not a file list.
- Do not rewrite published `main`.

Style follows the spirit of the [librustzcash contributing guide](https://github.com/zcash/librustzcash/blob/main/CONTRIBUTING.md): small diffs, reviewable history, no protocol fork unless ZCG and upstream agree.
