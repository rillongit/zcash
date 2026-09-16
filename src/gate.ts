import { existsSync, readFileSync } from "node:fs";
import { memoBase64UrlToPayoutId } from "./memo.js";
import { invoicePath, receiptPath } from "./paths.js";
import type { Zip321Invoice } from "./invoice.js";
import { parseZip321Uri } from "./zip321.js";

export type ReceiptSource = "scan" | "lab-stub";

export type LabReceipt = {
  resource_id: string;
  receipt_id: string;
  txid: string;
  source: ReceiptSource;
};

export type LabPaymentTerms = {
  resource_id: string;
  amount: string;
  currency_code: "ZEC";
  gate_url: string;
  zip321_uri: string;
  rails: ["zip321"];
};

export type LabGateResult = {
  status: 200 | 402 | 404;
  body: Record<string, unknown>;
};

function readJson(path: string): unknown | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function parseReceiptSource(value: unknown): ReceiptSource {
  if (value === "scan") return "scan";
  return "lab-stub";
}

export function receiptIdFor(source: ReceiptSource, resourceId: string): string {
  switch (source) {
    case "scan":
      return `rcpt_zcash_${resourceId.slice(0, 8)}`;
    case "lab-stub":
      return `rcpt_zcash_lab_${resourceId.slice(0, 8)}`;
    default: {
      const _never: never = source;
      throw new Error(String(_never));
    }
  }
}

export function readInvoiceFile(): Zip321Invoice | null {
  const raw = readJson(invoicePath());
  if (!raw || typeof raw !== "object") return null;
  return raw as Zip321Invoice;
}

export function readReceiptFile(): LabReceipt | null {
  const raw = readJson(receiptPath());
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<LabReceipt>;
  if (!row.resource_id || !row.receipt_id || !row.txid) return null;
  return {
    resource_id: row.resource_id,
    receipt_id: row.receipt_id,
    txid: row.txid,
    source: parseReceiptSource(row.source),
  };
}

export function handleLabGate(resourceId: string, gateOrigin = "http://127.0.0.1:3210"): LabGateResult {
  const id = resourceId.trim();
  const invoice = readInvoiceFile();
  if (!invoice || invoice.status !== "ready" || !invoice.uri || invoice.resource_id !== id) {
    return {
      status: 404,
      body: {
        ok: false,
        error: {
          code: "not_found",
          message: "Unknown lab resource. Run pnpm hop && pnpm invoice first.",
        },
      },
    };
  }

  const receipt = readReceiptFile();
  if (receipt && receipt.resource_id === id) {
    return {
      status: 200,
      body: {
        ok: true,
        unlocked: true,
        resource_id: id,
        receipt_id: receipt.receipt_id,
        txid: receipt.txid,
        source: receipt.source,
      },
    };
  }

  const terms: LabPaymentTerms = {
    resource_id: id,
    amount: invoice.amount_zec,
    currency_code: "ZEC",
    gate_url: `${gateOrigin.replace(/\/$/, "")}/r/${id}`,
    zip321_uri: invoice.uri,
    rails: ["zip321"],
  };
  return {
    status: 402,
    body: {
      ok: false,
      error: {
        code: "payment_required",
        message:
          "Payment required. Pay the ZIP-321 URI, then pnpm scan (or pnpm unlock -- --lab-stub).",
      },
      payment_terms: terms,
      zip321_uri: invoice.uri,
    },
  };
}

export function decodeZip321Uri(uri: string): {
  resource_id: string;
  address: string;
  amount: string;
  memo: string;
} {
  const parsed = parseZip321Uri(uri);
  return {
    resource_id: memoBase64UrlToPayoutId(parsed.memo),
    address: parsed.address,
    amount: parsed.amount,
    memo: parsed.memo,
  };
}
