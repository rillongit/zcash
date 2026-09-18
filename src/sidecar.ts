import { readFileSync } from "node:fs";
import { parseScanNotes, type ScanNotesFile } from "./scan.js";
import { readInvoiceFile } from "./gate.js";
import { listReceived } from "./observer.js";

export function loadNotesFromFixture(path: string): ScanNotesFile {
  return parseScanNotes(JSON.parse(readFileSync(path, "utf8")));
}

/**
 * Load decrypted notes. CI and reviewers use a recorded fixture.
 * Live path is watch-only zcashd `z_listreceivedbyaddress` on the invoice address.
 */
export function loadScanNotes(fixture?: string): ScanNotesFile {
  const path = fixture?.trim() || process.env.ZCASH_SCAN_FIXTURE?.trim();
  if (path) return loadNotesFromFixture(path);

  const invoice = readInvoiceFile();
  if (!invoice || invoice.status !== "ready" || !invoice.address?.trim()) {
    throw new Error(
      "No scan notes. Pass --fixture, set ZCASH_SCAN_FIXTURE, or run pnpm hop && pnpm invoice so the watch-only observer can list received notes.",
    );
  }

  const notes = listReceived(invoice.address.trim());
  return {
    source: "zcashd-viewkey",
    network: invoice.network,
    notes,
  };
}
