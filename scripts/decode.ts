import { loadDotenv } from "../src/env.js";
import { decodeZip321Uri, readInvoiceFile } from "../src/gate.js";
import { readHopProof } from "../src/proof.js";

loadDotenv();

const fromArg = process.argv[2]?.trim();
const invoice = readInvoiceFile();
const uri = fromArg || invoice?.uri;
if (!uri) {
  console.error("No ZIP-321 URI. Pass one or run pnpm invoice first.");
  process.exitCode = 1;
} else {
  const decoded = decodeZip321Uri(uri);
  if (fromArg) {
    console.log(JSON.stringify(decoded, null, 2));
  } else {
    const proof = readHopProof();
    const bound = Boolean(
      proof &&
        proof.resource_id &&
        proof.resource_id === decoded.resource_id &&
        (!proof.receiveAddress || proof.receiveAddress === decoded.address),
    );
    console.log(
      JSON.stringify(
        {
          resource_id: decoded.resource_id,
          address: decoded.address,
          amount: decoded.amount,
          memo: decoded.memo,
          hop_resource_id: proof?.resource_id ?? null,
          hop_receive_address: proof?.receiveAddress ?? null,
          bound,
        },
        null,
        2,
      ),
    );
    if (!bound) process.exitCode = 1;
  }
}
