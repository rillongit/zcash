# Contributing

This is the lomi. Zcash payout hop. Keep it small. Do not wire live PSP payouts from here.

## Code

- TypeScript, `pnpm typecheck` before a PR.
- Shielded receive. Memo = `payout_id`. Merchants never hold keys.
- Fail closed if the hop cannot run.
- Never commit `.env`, `keys/`, `wallet.dat`, or zcashd datadir contents.

## Git

- Branch from `main`. Open a pull request.
- Commits explain why, not a file list.
- Do not rewrite published `main`.

Style follows the spirit of the [librustzcash contributing guide](https://github.com/zcash/librustzcash/blob/main/CONTRIBUTING.md): small diffs, reviewable history, no protocol fork unless ZCG and upstream agree.
