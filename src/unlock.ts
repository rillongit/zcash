import { mkdirSync, writeFileSync } from "node:fs";
import { dataDir, receiptPath } from "./paths.js";
import { readHopProof } from "./proof.js";
import { readInvoiceFile, receiptIdFor, type LabReceipt } from "./gate.js";

export type UnlockResult = {
  status: "unlocked" | "closed";
  reason: string;
  receipt?: LabReceipt;
};

/** Lab-only stub receipt from a shielded hop. Not view-key reconcile. */
export function writeLabReceipt(): UnlockResult {
  const invoice = readInvoiceFile();
  const proof = readHopProof();
  if (!invoice || invoice.status !== "ready" || !invoice.resource_id) {
    return {
      status: "closed",
      reason: "No ready invoice. Run pnpm hop && pnpm invoice first.",
    };
  }
  if (proof?.status !== "shielded" || !proof.txid || !proof.resource_id) {
    return {
      status: "closed",
      reason: "No shielded hop txid. Run pnpm hop first.",
    };
  }
  if (proof.resource_id !== invoice.resource_id) {
    return {
      status: "closed",
      reason:
        "Hop resource_id does not match invoice. Re-run pnpm hop && pnpm invoice.",
    };
  }
  if (proof.receiveAddress && proof.receiveAddress !== invoice.address) {
    return {
      status: "closed",
      reason: "Hop receive address does not match invoice address.",
    };
  }

  const receipt: LabReceipt = {
    resource_id: invoice.resource_id,
    receipt_id: receiptIdFor("lab-stub", invoice.resource_id),
    txid: proof.txid,
    source: "lab-stub",
  };
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(receiptPath(), `${JSON.stringify(receipt, null, 2)}\n`);
  return {
    status: "unlocked",
    reason:
      "Wrote lab-stub receipt from hop txid. Not view-key scan. Paid path is pnpm scan.",
    receipt,
  };
}
