import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { memoBase64UrlToPayoutId } from "./memo.js";
import { dataDir, invoicePath, receiptPath } from "./paths.js";
import type { Zip321Invoice } from "./invoice.js";
import { parseZip321Uri } from "./zip321.js";
import {
  liveObserver,
  zecToZatoshis,
  type LabObserver,
} from "./observer.js";

export { zecToZatoshis };
export type { LabObserver };

export type ReceiptSource = "scan" | "lab-stub";

export type LabReceipt = {
  resource_id: string;
  receipt_id: string;
  txid: string;
  source: ReceiptSource;
  status?: "final" | "settled";
  confirmations?: number;
  network?: string;
  observer?: string;
};

export type LabPaymentTerms = {
  resource_id: string;
  amount: string;
  currency_code: "ZEC";
  gate_url: string;
  zip321_uri: string;
  rails: ["zip321"];
};

export type LabAccept = {
  scheme: "exact";
  network: "zcash:regtest";
  asset: "ZEC";
  amount: string;
  payTo: string;
  maxTimeoutSeconds: 120;
  extra: {
    zip321_uri: string;
    memo_base64url: string;
    caip2: "bip122:029f11d80ef9765602235e1bc9727e3e";
    payload_dialects: ["txid"];
  };
};

export type LabGateResult = {
  status: 200 | 402 | 404;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
};

export type LabGateOptions = {
  paymentSignature?: string;
  observer?: LabObserver;
};

const CAIP2_REGTEST = "bip122:029f11d80ef9765602235e1bc9727e3e";
const MAX_TIMEOUT_SECONDS = 120;

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
  const status = row.status === "final" || row.status === "settled" ? row.status : undefined;
  return {
    resource_id: row.resource_id,
    receipt_id: row.receipt_id,
    txid: row.txid,
    source: parseReceiptSource(row.source),
    status,
    confirmations: typeof row.confirmations === "number" ? row.confirmations : undefined,
    network: typeof row.network === "string" ? row.network : undefined,
    observer: typeof row.observer === "string" ? row.observer : undefined,
  };
}

function writeReceipt(receipt: LabReceipt): void {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(receiptPath(), `${JSON.stringify(receipt, null, 2)}\n`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function decodeJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** CipherPay dialect 1: `{ payload: { txid } }` as JSON or base64 JSON. */
export function parsePaymentSignatureTxid(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const trimmed = raw.trim();
  let parsed = decodeJson(trimmed);
  if (parsed == null) {
    try {
      parsed = decodeJson(Buffer.from(trimmed, "base64").toString("utf8"));
    } catch {
      return undefined;
    }
  }
  const row = asRecord(parsed);
  if (!row) return undefined;
  const payload = asRecord(row.payload);
  const nested = asRecord(row.paymentPayload);
  const nestedPayload = nested ? asRecord(nested.payload) : null;
  const txid = payload?.txid ?? nestedPayload?.txid;
  return typeof txid === "string" && txid.trim() ? txid.trim() : undefined;
}

function labAccepts(invoice: Zip321Invoice): LabAccept[] {
  return [
    {
      scheme: "exact",
      network: "zcash:regtest",
      asset: "ZEC",
      amount: zecToZatoshis(invoice.amount_zec),
      payTo: invoice.address,
      maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
      extra: {
        zip321_uri: invoice.uri,
        memo_base64url: invoice.memo,
        caip2: CAIP2_REGTEST,
        payload_dialects: ["txid"],
      },
    },
  ];
}

function paymentRequiredHeader(gateUrl: string, accepts: LabAccept[]): string {
  const body = {
    x402Version: 2,
    resource: {
      url: gateUrl,
      description: "Rill ZIP-321 Accept invoice",
    },
    accepts,
    validUntil: new Date(Date.now() + MAX_TIMEOUT_SECONDS * 1000).toISOString(),
  };
  return Buffer.from(JSON.stringify(body), "utf8").toString("base64");
}

function paymentResponseHeader(receipt: LabReceipt): string {
  const body = {
    x402Version: 2,
    success: true,
    txid: receipt.txid,
    receipt_id: receipt.receipt_id,
  };
  return Buffer.from(JSON.stringify(body), "utf8").toString("base64");
}

function challengeBody(
  invoice: Zip321Invoice,
  id: string,
  gateUrl: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const terms: LabPaymentTerms = {
    resource_id: id,
    amount: invoice.amount_zec,
    currency_code: "ZEC",
    gate_url: gateUrl,
    zip321_uri: invoice.uri,
    rails: ["zip321"],
  };
  const accepts = labAccepts(invoice);
  return {
    ok: false,
    error: {
      code: "payment_required",
      message:
        "Payment required. Pay the ZIP-321 URI, then retry with PAYMENT-SIGNATURE { payload: { txid } }, or pnpm scan (or pnpm unlock -- --lab-stub).",
    },
    payment_terms: terms,
    zip321_uri: invoice.uri,
    accepts,
    ...extra,
  };
}

function receiptBody(id: string, receipt: LabReceipt): Record<string, unknown> {
  return {
    ok: true,
    unlocked: true,
    resource_id: id,
    receipt_id: receipt.receipt_id,
    txid: receipt.txid,
    source: receipt.source,
    ...(receipt.status ? { status: receipt.status } : {}),
    ...(typeof receipt.confirmations === "number" ? { confirmations: receipt.confirmations } : {}),
    ...(receipt.network ? { network: receipt.network } : {}),
    ...(receipt.observer ? { observer: receipt.observer } : {}),
  };
}

export function handleLabGate(
  resourceId: string,
  gateOrigin = "http://127.0.0.1:3210",
  options?: LabGateOptions,
): LabGateResult {
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

  const existing = readReceiptFile();
  if (existing && existing.resource_id === id) {
    return {
      status: 200,
      body: receiptBody(id, existing),
    };
  }

  const gateUrl = `${gateOrigin.replace(/\/$/, "")}/r/${id}`;
  const accepts = labAccepts(invoice);
  const challengeHeaders = {
    "PAYMENT-REQUIRED": paymentRequiredHeader(gateUrl, accepts),
  };

  const txid = parsePaymentSignatureTxid(options?.paymentSignature);
  if (txid) {
    try {
      const observer = options?.observer ?? liveObserver;
      const verified = observer.verifyTxid({
        txid,
        address: invoice.address,
        amountZec: invoice.amount_zec,
        resourceId: id,
      });
      if (verified.ok && verified.status === "settled") {
        const receipt: LabReceipt = {
          resource_id: id,
          receipt_id: receiptIdFor("scan", id),
          txid: verified.txid ?? txid,
          source: "scan",
          status: "settled",
          confirmations: verified.confirmations,
          network: invoice.network,
          observer: "zcashd-viewkey",
        };
        writeReceipt(receipt);
        return {
          status: 200,
          body: receiptBody(id, receipt),
          headers: {
            "PAYMENT-RESPONSE": paymentResponseHeader(receipt),
          },
        };
      }
      if (verified.ok && verified.status === "final") {
        return {
          status: 402,
          body: challengeBody(invoice, id, gateUrl, {
            payment_status: {
              status: "final",
              confirmations: verified.confirmations,
              txid: verified.txid ?? txid,
            },
          }),
          headers: challengeHeaders,
        };
      }
    } catch {
      // Fail closed: unpaid 402, no leak of observer internals.
    }
  }

  return {
    status: 402,
    body: challengeBody(invoice, id, gateUrl),
    headers: challengeHeaders,
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
