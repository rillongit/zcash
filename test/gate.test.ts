import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const root = mkdtempSync(join(tmpdir(), "zcash-gate-"));
process.env.ZCASH_APP_ROOT = root;
mkdirSync(join(root, "data"), { recursive: true });

const { handleLabGate } = await import("../src/gate.js");
const { writeLabReceipt } = await import("../src/unlock.js");
const { writeHopProof } = await import("../src/proof.js");

const resourceId = "11111111-1111-4111-8111-111111111111";
const receiveAddress =
  "uregtest1ma4nrsg5fn6ucrguedj7k08tyk48tsaru4m8f02syrwgdgfap5zhkwkwvuzcegtecwk29m7e3u6hgvcwuc7sx802egc3dem4z532w6cd5978uau9n8h3c2gg9shjxpwevs8nu4qmadtew6qcztdn4cyx3a7pqqa0576nm9gquvjfw3sng5e57fupnvmxmpgkyq7y62gc2rccvjetucj";
const uri = `zcash:${receiveAddress}?amount=0.001&memo=MTExMTExMTEtMTExMS00MTExLTgxMTEtMTExMTExMTExMTEx`;

writeFileSync(
  join(root, "data", "invoice.json"),
  `${JSON.stringify({
    resource_id: resourceId,
    amount_zec: "0.001",
    address: receiveAddress,
    uri,
    memo: "MTExMTExMTEtMTExMS00MTExLTgxMTEtMTExMTExMTExMTEx",
    network: "regtest",
    status: "ready",
    reason: "test",
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`,
);

test("lab gate is 402 unpaid, 404 unknown, 200 only after hop-bound receipt", () => {
  const unpaid = handleLabGate(resourceId);
  assert.equal(unpaid.status, 402);
  assert.equal(
    (unpaid.body.payment_terms as { zip321_uri?: string }).zip321_uri,
    uri,
  );
  assert.equal(unpaid.body.zip321_uri, uri);

  const missing = handleLabGate("22222222-2222-4222-8222-222222222222");
  assert.equal(missing.status, 404);

  writeHopProof({
    status: "shielded",
    network: "regtest",
    reason: "test",
    officialApply: "",
    neverUse: "",
    updatedAt: new Date().toISOString(),
    resource_id: resourceId,
    receiveAddress,
    txid: "txid-lab",
  });
  const unlocked = writeLabReceipt();
  assert.equal(unlocked.status, "unlocked");
  const paid = handleLabGate(resourceId);
  assert.equal(paid.status, 200);
  assert.equal(paid.body.unlocked, true);
  assert.equal(paid.body.txid, "txid-lab");
  assert.equal(paid.body.source, "lab-stub");
});
