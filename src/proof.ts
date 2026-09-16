import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  dataDir,
  hopProofLegacyPath,
  hopProofPath,
  invoicePath,
} from "./paths.js";
import { payoutIdToMemoBase64Url, payoutIdToMemoHex } from "./memo.js";

export type HopProof = {
  status: "pending" | "shielded";
  network: "regtest" | "testnet" | "none";
  reason: string;
  officialApply: string;
  neverUse: string;
  updatedAt: string;
  resource_id?: string;
  memo_hex?: string;
  memo_base64url?: string;
  receiveAddress?: string;
  fundingAddress?: string;
  txid?: string;
};

export type HopProofPointer = {
  status: "moved";
  canonical: "hop-proof.json";
  reason: string;
};

export const OFFICIAL_APPLY =
  "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/new?template=grant_application.yaml";
export const NEVER_USE = "https://zcashgranthub.vercel.app/apply";

const MOVED_REASON =
  "Renamed to hop-proof.json. This hop is local regtest, not public Testnet.";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/** Normalize current hop-proof.json or a pre-rename testnet-proof.json. */
export function parseHopProof(raw: unknown): HopProof | null {
  const row = asRecord(raw);
  if (!row) return null;
  if (row.status === "moved") return null;
  const status = row.status;
  if (status !== "pending" && status !== "shielded") return null;
  const network = row.network;
  if (network !== "regtest" && network !== "testnet" && network !== "none") {
    return null;
  }
  const resourceId =
    optionalString(row.resource_id) ?? optionalString(row.payoutId);
  const receiveAddress =
    optionalString(row.receiveAddress) ??
    optionalString(row.merchantAddress);
  const fundingAddress =
    optionalString(row.fundingAddress) ??
    optionalString(row.omnibusAddress);
  return {
    status,
    network,
    reason: optionalString(row.reason) ?? "",
    officialApply: optionalString(row.officialApply) ?? OFFICIAL_APPLY,
    neverUse: optionalString(row.neverUse) ?? NEVER_USE,
    updatedAt: optionalString(row.updatedAt) ?? new Date().toISOString(),
    resource_id: resourceId,
    memo_hex: optionalString(row.memo_hex),
    memo_base64url: optionalString(row.memo_base64url),
    receiveAddress,
    fundingAddress,
    txid: optionalString(row.txid),
  };
}

export function bindMemos(resourceId: string): {
  memo_hex: string;
  memo_base64url: string;
} {
  return {
    memo_hex: payoutIdToMemoHex(resourceId),
    memo_base64url: payoutIdToMemoBase64Url(resourceId),
  };
}

export function writeHopProof(proof: HopProof): HopProof {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(hopProofPath(), `${JSON.stringify(proof, null, 2)}\n`);
  const pointer: HopProofPointer = {
    status: "moved",
    canonical: "hop-proof.json",
    reason: MOVED_REASON,
  };
  writeFileSync(hopProofLegacyPath(), `${JSON.stringify(pointer, null, 2)}\n`);
  return proof;
}

export function readHopProof(): HopProof | null {
  for (const path of [hopProofPath(), hopProofLegacyPath()]) {
    if (!existsSync(path)) continue;
    try {
      const parsed = parseHopProof(JSON.parse(readFileSync(path, "utf8")));
      if (parsed) return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

export function readExistingResourceId(): string | undefined {
  try {
    const invoice = JSON.parse(readFileSync(invoicePath(), "utf8")) as {
      resource_id?: string;
    };
    if (invoice.resource_id?.trim()) return invoice.resource_id.trim();
  } catch {
    /* no invoice yet */
  }
  const proof = readHopProof();
  return proof?.resource_id?.trim() || undefined;
}
