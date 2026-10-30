import { mkdirSync, writeFileSync } from "node:fs";
import { dataDir, receiptPath } from "./paths.js";
import { readInvoiceFile, receiptIdFor, type LabReceipt } from "./gate.js";
import { memoFieldToUtf8 } from "./memo.js";
import { settledConfirmations } from "./observer.js";

export type DecryptedNote = {
  txid: string;
  memo_utf8: string;
  address?: string;
  confirmations?: number;
  amount_zec?: string;
};

export type ScanNotesFile = {
  source: string;
  network?: string;
  notes: DecryptedNote[];
};

export type ScanResult = {
  status: "unlocked" | "closed";
  reason: string;
  receipt?: LabReceipt;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseScanNotes(raw: unknown): ScanNotesFile {
  const row = asRecord(raw);
  if (!row || !Array.isArray(row.notes)) {
    throw new Error("scan notes JSON needs a notes array");
  }
  const notes: DecryptedNote[] = [];
  for (const item of row.notes) {
    const note = asRecord(item);
    if (!note) continue;
    const txid = typeof note.txid === "string" ? note.txid.trim() : "";
    const memo = typeof note.memo_utf8 === "string" ? note.memo_utf8 : "";
    if (!txid || !memo) continue;
    const address = typeof note.address === "string" ? note.address : undefined;
    const confirmations =
      typeof note.confirmations === "number" &&
      Number.isFinite(note.confirmations)
        ? note.confirmations
        : undefined;
    const amount_zec =
      typeof note.amount_zec === "string"
        ? note.amount_zec
        : typeof note.amount_zec === "number"
          ? String(note.amount_zec)
          : undefined;
    notes.push({ txid, memo_utf8: memo, address, confirmations, amount_zec });
  }
  return {
    source: typeof row.source === "string" ? row.source : "unknown",
    network: typeof row.network === "string" ? row.network : undefined,
    notes,
  };
}

/** Match a decrypted memo to resource_id. Wrong or missing memo stays closed. */
export function reconcileNotes(
  notes: DecryptedNote[],
  resourceId: string,
): ScanResult {
  const id = resourceId.trim();
  if (!id) {
    return { status: "closed", reason: "No resource_id." };
  }
  const hit = notes.find(
    (note) => memoFieldToUtf8(note.memo_utf8) === id && note.txid,
  );
  if (!hit) {
    return {
      status: "closed",
      reason:
        "No decrypted note memo matches resource_id. Unpaid stays closed.",
    };
  }
  const receipt: LabReceipt = {
    resource_id: id,
    receipt_id: receiptIdFor("scan", id),
    txid: hit.txid,
    source: "scan",
  };
  return {
    status: "unlocked",
    reason: "Memo matched resource_id.",
    receipt,
  };
}

export function writeScanReceipt(receipt: LabReceipt): void {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(receiptPath(), `${JSON.stringify(receipt, null, 2)}\n`);
}

export type ScanInvoiceOptions = {
  observer?: "fixture" | "zcashd-viewkey";
  network?: string;
};

/** Reconcile decrypted notes against the lab invoice and write a scan receipt. */
export function scanInvoice(
  notes: DecryptedNote[],
  options?: ScanInvoiceOptions,
): ScanResult {
  const invoice = readInvoiceFile();
  if (!invoice || invoice.status !== "ready" || !invoice.resource_id) {
    return {
      status: "closed",
      reason: "No ready invoice. Run pnpm hop && pnpm invoice first.",
    };
  }
  const result = reconcileNotes(notes, invoice.resource_id);
  if (result.status !== "unlocked" || !result.receipt) return result;

  const id = invoice.resource_id.trim();
  const hit = notes.find(
    (note) => memoFieldToUtf8(note.memo_utf8) === id && note.txid,
  );
  const threshold = settledConfirmations();
  if (typeof hit?.confirmations === "number" && hit.confirmations < threshold) {
    return {
      status: "closed",
      reason: `Matching memo has ${hit.confirmations} confirmations; need ${threshold} to settle.`,
    };
  }

  const observer = options?.observer ?? "fixture";
  const receipt: LabReceipt = {
    ...result.receipt,
    status: "settled",
    confirmations: hit?.confirmations ?? threshold,
    network: options?.network ?? invoice.network,
    observer,
  };
  writeScanReceipt(receipt);
  return {
    status: "unlocked",
    reason: result.reason,
    receipt,
  };
}
