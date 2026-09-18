import { loadDotenv } from "../src/env.js";
import { scanInvoice } from "../src/scan.js";
import { loadScanNotes } from "../src/sidecar.js";

loadDotenv();

function fixtureArg(argv: string[]): string | undefined {
  const flag = argv.indexOf("--fixture");
  if (flag >= 0) return argv[flag + 1];
  return undefined;
}

try {
  const notes = loadScanNotes(fixtureArg(process.argv));
  const observer = notes.source === "zcashd-viewkey" ? "zcashd-viewkey" : "fixture";
  const result = scanInvoice(notes.notes, { observer, network: notes.network });
  console.log(result.status);
  console.log(result.reason);
  if (result.receipt) console.log(JSON.stringify(result.receipt, null, 2));
  if (result.status !== "unlocked") process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
