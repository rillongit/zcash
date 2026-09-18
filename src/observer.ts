import { memoFieldToUtf8 } from "./memo.js";
import { zcli } from "./cli.js";
import type { DecryptedNote } from "./scan.js";

export type VerifyTxidInput = {
  txid: string;
  address: string;
  amountZec: string;
  resourceId: string;
};

export type VerifyTxidResult = {
  ok: boolean;
  status?: "final" | "settled";
  confirmations: number;
  reason: string;
  txid?: string;
};

export type LabObserver = {
  verifyTxid: (input: VerifyTxidInput) => VerifyTxidResult;
  listReceived?: (address: string) => DecryptedNote[];
};

/** 8-decimal ZEC string to zatoshis (no floating point). */
export function zecToZatoshis(zec: string): string {
  const trimmed = zec.trim();
  if (!trimmed) throw new Error("invalid ZEC amount");
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [wholeRaw, fracRaw = ""] = unsigned.split(".");
  if (!/^\d+$/.test(wholeRaw || "0") || (fracRaw && !/^\d+$/.test(fracRaw))) {
    throw new Error(`invalid ZEC amount: ${zec}`);
  }
  const whole = wholeRaw || "0";
  const frac = (fracRaw + "00000000").slice(0, 8);
  const zat = BigInt(whole) * 100000000n + BigInt(frac);
  return negative ? `-${zat}` : String(zat);
}

export function settledConfirmations(): number {
  const raw = process.env.ZCASH_SETTLED_CONFIRMATIONS?.trim();
  const parsed = raw ? Number(raw) : 10;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function outputAmountZat(row: Record<string, unknown>): bigint | undefined {
  if (typeof row.valueZat === "number" && Number.isFinite(row.valueZat)) {
    return BigInt(Math.round(row.valueZat));
  }
  if (typeof row.amountZat === "number" && Number.isFinite(row.amountZat)) {
    return BigInt(Math.round(row.amountZat));
  }
  if (typeof row.valueZat === "string" && row.valueZat.trim()) {
    return BigInt(row.valueZat.trim());
  }
  if (typeof row.amountZat === "string" && row.amountZat.trim()) {
    return BigInt(row.amountZat.trim());
  }
  const zec = row.value ?? row.amount;
  if (typeof zec === "number" && Number.isFinite(zec)) {
    return BigInt(zecToZatoshis(zec.toFixed(8)));
  }
  if (typeof zec === "string" && zec.trim()) {
    return BigInt(zecToZatoshis(zec.trim()));
  }
  return undefined;
}

function outputMemoUtf8(row: Record<string, unknown>): string {
  if (typeof row.memoStr === "string" && row.memoStr.trim()) {
    return memoFieldToUtf8(row.memoStr);
  }
  if (typeof row.memo === "string") {
    return memoFieldToUtf8(row.memo);
  }
  return "";
}

function rpcJson(args: string[], node: "payer" | "observer"): { ok: boolean; value?: unknown; out: string } {
  const result = zcli(args, node);
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.status !== 0) return { ok: false, out };
  try {
    return { ok: true, value: JSON.parse(out), out };
  } catch {
    return { ok: true, value: out, out };
  }
}

function fetchConfirmations(txid: string): number {
  const verbose = rpcJson(["getrawtransaction", txid, "1"], "observer");
  if (verbose.ok) {
    const row = asRecord(verbose.value);
    if (typeof row?.confirmations === "number" && Number.isFinite(row.confirmations)) {
      return row.confirmations;
    }
  }
  const wallet = rpcJson(["gettransaction", txid], "observer");
  const row = asRecord(wallet.value);
  if (typeof row?.confirmations === "number" && Number.isFinite(row.confirmations)) {
    return row.confirmations;
  }
  return 0;
}

/** Map zcashd `z_listreceivedbyaddress` JSON to decrypted notes. */
export function notesFromListReceived(raw: unknown): DecryptedNote[] {
  const rows = Array.isArray(raw)
    ? raw
    : asRecord(raw) && Array.isArray(asRecord(raw)?.result)
      ? (asRecord(raw)?.result as unknown[])
      : [];
  const notes: DecryptedNote[] = [];
  for (const item of rows) {
    const row = asRecord(item);
    if (!row) continue;
    const txid = typeof row.txid === "string" ? row.txid.trim() : "";
    const memo = typeof row.memo === "string" ? memoFieldToUtf8(row.memo) : "";
    if (!txid || !memo) continue;
    const confirmations =
      typeof row.confirmations === "number" && Number.isFinite(row.confirmations)
        ? row.confirmations
        : undefined;
    let amount_zec: string | undefined;
    if (typeof row.amount === "number" && Number.isFinite(row.amount)) {
      amount_zec = row.amount.toFixed(8).replace(/\.?0+$/, "") || "0";
      if (amount_zec.endsWith(".")) amount_zec = amount_zec.slice(0, -1);
      if (!amount_zec.includes(".")) {
        amount_zec = typeof row.amount === "number" ? String(row.amount) : amount_zec;
      }
    } else if (typeof row.amount === "string" && row.amount.trim()) {
      amount_zec = row.amount.trim();
    }
    notes.push({
      txid,
      memo_utf8: memo,
      address: typeof row.address === "string" ? row.address : undefined,
      confirmations,
      amount_zec,
    });
  }
  return notes;
}

export function listReceived(address: string): DecryptedNote[] {
  const result = rpcJson(["z_listreceivedbyaddress", address, "0"], "observer");
  if (!result.ok) {
    throw new Error(`observer z_listreceivedbyaddress failed: ${result.out}`);
  }
  return notesFromListReceived(result.value);
}

export function verifyTxid(input: VerifyTxidInput): VerifyTxidResult {
  const viewed = rpcJson(["z_viewtransaction", input.txid], "observer");
  if (!viewed.ok) {
    return {
      ok: false,
      confirmations: 0,
      reason: "transaction not visible to observer",
    };
  }
  const body = asRecord(viewed.value);
  const outputs = Array.isArray(body?.outputs) ? body.outputs : [];
  const expectedZat = BigInt(zecToZatoshis(input.amountZec));
  const wantMemo = input.resourceId.trim();
  const wantAddress = input.address.trim();
  let memoMismatch = false;
  let found = false;
  for (const item of outputs) {
    const row = asRecord(item);
    if (!row) continue;
    const address = typeof row.address === "string" ? row.address.trim() : "";
    if (wantAddress && address && address !== wantAddress) continue;
    const memo = outputMemoUtf8(row);
    if (memo !== wantMemo) {
      if (wantAddress && address === wantAddress) memoMismatch = true;
      continue;
    }
    const amountZat = outputAmountZat(row);
    if (amountZat === undefined || amountZat < expectedZat) continue;
    found = true;
    break;
  }
  if (!found) {
    return {
      ok: false,
      confirmations: 0,
      reason: memoMismatch ? "memo mismatch" : "no matching output",
      txid: input.txid,
    };
  }

  const confirmations = fetchConfirmations(input.txid);
  const settled = settledConfirmations();
  if (confirmations >= settled) {
    return {
      ok: true,
      status: "settled",
      confirmations,
      reason: "settled",
      txid: input.txid,
    };
  }
  if (confirmations >= 1) {
    return {
      ok: true,
      status: "final",
      confirmations,
      reason: "final",
      txid: input.txid,
    };
  }
  return {
    ok: false,
    confirmations,
    reason: "unconfirmed",
    txid: input.txid,
  };
}

export const liveObserver: LabObserver = {
  verifyTxid,
  listReceived,
};
