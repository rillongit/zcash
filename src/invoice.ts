import { mkdirSync, writeFileSync } from "node:fs";
import { dataDir, invoicePath } from "./paths.js";
import { payoutIdToMemoBase64Url } from "./memo.js";
import { readHopProof, type HopProof } from "./proof.js";
import { buildZip321Uri } from "./zip321.js";
import { randomUUID } from "node:crypto";

export type Zip321Invoice = {
  resource_id: string;
  amount_zec: string;
  address: string;
  uri: string;
  memo: string;
  network: "regtest" | "testnet" | "none";
  status: "ready" | "pending";
  reason: string;
  updatedAt: string;
};

export function createInvoice(input: {
  resourceId: string;
  amountZec: string;
  address: string;
  message?: string;
}): Pick<Zip321Invoice, "resource_id" | "amount_zec" | "address" | "uri" | "memo"> {
  const uri = buildZip321Uri({
    address: input.address,
    amount: input.amountZec,
    resourceId: input.resourceId,
    message: input.message,
  });
  return {
    resource_id: input.resourceId,
    amount_zec: input.amountZec,
    address: input.address,
    uri,
    memo: payoutIdToMemoBase64Url(input.resourceId),
  };
}

/** Build the ZIP-321 invoice from a hop proof so memo and receive address match the send. */
export function createInvoiceFromHopProof(
  proof: HopProof,
  amountZec: string,
): ReturnType<typeof createInvoice> {
  const resourceId = proof.resource_id?.trim();
  const address = proof.receiveAddress?.trim();
  if (!resourceId || !address) {
    throw new Error("hop proof is missing resource_id or receiveAddress");
  }
  return createInvoice({
    resourceId,
    amountZec,
    address,
    message: "Rill ZIP-321 Accept invoice",
  });
}

function writePending(reason: string): Zip321Invoice {
  mkdirSync(dataDir(), { recursive: true });
  const pending: Zip321Invoice = {
    resource_id: randomUUID(),
    amount_zec: process.env.ZCASH_INVOICE_AMOUNT?.trim() || "0.001",
    address: "",
    uri: "",
    memo: "",
    network: "none",
    status: "pending",
    reason,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(invoicePath(), `${JSON.stringify(pending, null, 2)}\n`);
  return pending;
}

function sniffNetwork(address: string, proofNetwork?: HopProof["network"]): Zip321Invoice["network"] {
  if (proofNetwork === "testnet" || proofNetwork === "regtest") return proofNetwork;
  if (address.startsWith("uregtest") || address.startsWith("zregtestsapling")) {
    return "regtest";
  }
  return "testnet";
}

export function writeInvoice(): Zip321Invoice {
  mkdirSync(dataDir(), { recursive: true });
  const fromEnv = process.env.ZCASH_INVOICE_ADDRESS?.trim();
  const proof = readHopProof();
  const address = fromEnv || proof?.receiveAddress;
  const resourceId = proof?.resource_id;
  if (!address || !resourceId) {
    return writePending(
      "No bound hop. Run pnpm hop or set ZCASH_INVOICE_ADDRESS after a hop-proof with resource_id, then pnpm invoice.",
    );
  }

  const built = createInvoice({
    resourceId,
    amountZec: process.env.ZCASH_INVOICE_AMOUNT?.trim() || "0.001",
    address,
    message: "Rill ZIP-321 Accept invoice",
  });

  const invoice: Zip321Invoice = {
    ...built,
    network: sniffNetwork(address, proof?.network),
    status: "ready",
    reason:
      "ZIP-321 invoice with memo = resource_id on the hop receive address. Not public Testnet. Public Testnet is still milestone 1.",
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(invoicePath(), `${JSON.stringify(invoice, null, 2)}\n`);
  return invoice;
}
