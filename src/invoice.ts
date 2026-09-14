import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { payoutIdToMemoBase64Url } from "./memo.js";
import { buildZip321Uri } from "./zip321.js";

const ROOT = process.env.ZCASH_APP_ROOT ?? process.cwd();
const DATA = join(ROOT, "data");

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

function proofAddress(): { address?: string; network?: "regtest" | "testnet" } {
  try {
    const raw = readFileSync(join(DATA, "testnet-proof.json"), "utf8");
    const proof = JSON.parse(raw) as {
      omnibusAddress?: string;
      network?: "regtest" | "testnet";
    };
    return { address: proof.omnibusAddress, network: proof.network };
  } catch {
    return {};
  }
}

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

export function writeInvoice(): Zip321Invoice {
  mkdirSync(DATA, { recursive: true });
  const fromEnv = process.env.ZCASH_INVOICE_ADDRESS?.trim();
  const proof = proofAddress();
  const address = fromEnv || proof.address;
  if (!address) {
    const pending: Zip321Invoice = {
      resource_id: randomUUID(),
      amount_zec: process.env.ZCASH_INVOICE_AMOUNT?.trim() || "0.001",
      address: "",
      uri: "",
      memo: "",
      network: "none",
      status: "pending",
      reason:
        "No shielded address. Run pnpm hop or set ZCASH_INVOICE_ADDRESS, then pnpm invoice.",
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(join(DATA, "invoice.json"), `${JSON.stringify(pending, null, 2)}\n`);
    return pending;
  }

  const built = createInvoice({
    resourceId: randomUUID(),
    amountZec: process.env.ZCASH_INVOICE_AMOUNT?.trim() || "0.001",
    address,
    message: "Rill ZIP-321 Accept invoice",
  });
  const invoice: Zip321Invoice = {
    ...built,
    network: proof.network ?? (address.startsWith("uregtest") ? "regtest" : "testnet"),
    status: "ready",
    reason:
      "ZIP-321 invoice with memo = resource_id. Scan with Zashi. Not a Wave hop. Public Testnet is still milestone 1.",
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(join(DATA, "invoice.json"), `${JSON.stringify(invoice, null, 2)}\n`);
  return invoice;
}
