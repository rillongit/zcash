import { join } from "node:path";

export function appRoot(): string {
  return process.env.ZCASH_APP_ROOT ?? process.cwd();
}

export function dataDir(): string {
  return join(appRoot(), "data");
}

export function hopProofPath(): string {
  return join(dataDir(), "hop-proof.json");
}

/** Kept so ZCG issue links to data/testnet-proof.json still resolve. */
export function hopProofLegacyPath(): string {
  return join(dataDir(), "testnet-proof.json");
}

export function invoicePath(): string {
  return join(dataDir(), "invoice.json");
}

export function receiptPath(): string {
  return join(dataDir(), "receipt.json");
}
