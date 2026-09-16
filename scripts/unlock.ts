import { loadDotenv } from "../src/env.js";
import { writeLabReceipt } from "../src/unlock.js";

loadDotenv();

if (!process.argv.includes("--lab-stub")) {
  console.error("pnpm unlock copies the hop txid. That is not view-key reconcile.");
  console.error("Paid path: pnpm scan");
  console.error("Reviewer stub without a scanner: pnpm unlock -- --lab-stub");
  process.exitCode = 1;
} else {
  const result = writeLabReceipt();
  console.log(result.status);
  console.log(result.reason);
  if (result.receipt) console.log(JSON.stringify(result.receipt, null, 2));
  if (result.status !== "unlocked") {
    process.exitCode = 1;
  }
}
