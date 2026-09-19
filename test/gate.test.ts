import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const root = mkdtempSync(join(tmpdir(), "zcash-gate-"));
process.env.ZCASH_APP_ROOT = root;
mkdirSync(join(root, "data"), { recursive: true });

const { handleLabGate, zecToZatoshis } = await import("../src/gate.js");
const { writeLabReceipt } = await import("../src/unlock.js");
const { writeHopProof } = await import("../src/proof.js");
type LabObserver = import("../src/observer.js").LabObserver;

const resourceId = "11111111-1111-4111-8111-111111111111";
const receiveAddress =
  "uregtest1ma4nrsg5fn6ucrguedj7k08tyk48tsaru4m8f02syrwgdgfap5zhkwkwvuzcegtecwk29m7e3u6hgvcwuc7sx802egc3dem4z532w6cd5978uau9n8h3c2gg9shjxpwevs8nu4qmadtew6qcztdn4cyx3a7pqqa0576nm9gquvjfw3sng5e57fupnvmxmpgkyq7y62gc2rccvjetucj";
const uri = `zcash:${receiveAddress}?amount=0.001&memo=MTExMTExMTEtMTExMS00MTExLTgxMTEtMTExMTExMTExMTEx`;
const memo = "MTExMTExMTEtMTExMS00MTExLTgxMTEtMTExMTExMTExMTEx";

writeFileSync(
  join(root, "data", "invoice.json"),
  `${JSON.stringify(
    {
      resource_id: resourceId,
      amount_zec: "0.001",
      address: receiveAddress,
      uri,
      memo,
      network: "regtest",
      status: "ready",
      reason: "test",
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
);

function clearReceipt(): void {
  const path = join(root, "data", "receipt.json");
  if (existsSync(path)) unlinkSync(path);
}

const fakeObserver: LabObserver = {
  verifyTxid: ({ txid, resourceId: id }) => {
    if (txid === "settled-txid") {
      return {
        ok: true,
        status: "settled",
        confirmations: 10,
        reason: "settled",
        txid,
      };
    }
    if (txid === "final-txid") {
      return {
        ok: true,
        status: "final",
        confirmations: 2,
        reason: "final",
        txid,
      };
    }
    if (txid === "wrong-memo") {
      return { ok: false, confirmations: 10, reason: "memo mismatch", txid };
    }
    void id;
    return { ok: false, confirmations: 0, reason: "not found", txid };
  },
};

test("lab gate is 402 unpaid, 404 unknown, 200 only after hop-bound receipt", () => {
  const unpaid = handleLabGate(resourceId);
  assert.equal(unpaid.status, 402);
  assert.equal(
    (unpaid.body.payment_terms as { zip321_uri?: string }).zip321_uri,
    uri,
  );
  assert.equal(unpaid.body.zip321_uri, uri);

  const accepts = unpaid.body.accepts as Array<{
    scheme: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra: {
      zip321_uri: string;
      memo_base64url: string;
      caip2: string;
      payload_dialects: string[];
    };
  }>;
  assert.equal(accepts.length, 1);
  assert.equal(accepts[0].scheme, "exact");
  assert.equal(accepts[0].network, "zcash:regtest");
  assert.equal(accepts[0].asset, "ZEC");
  assert.equal(accepts[0].amount, zecToZatoshis("0.001"));
  assert.equal(accepts[0].amount, "100000");
  assert.equal(accepts[0].payTo, receiveAddress);
  assert.equal(accepts[0].maxTimeoutSeconds, 120);
  assert.equal(accepts[0].extra.zip321_uri, uri);
  assert.equal(accepts[0].extra.memo_base64url, memo);
  assert.equal(
    accepts[0].extra.caip2,
    "bip122:029f11d80ef9765602235e1bc9727e3e",
  );
  assert.deepEqual(accepts[0].extra.payload_dialects, ["txid"]);
  assert.ok(unpaid.headers?.["PAYMENT-REQUIRED"]);
  const required = JSON.parse(
    Buffer.from(unpaid.headers["PAYMENT-REQUIRED"], "base64").toString("utf8"),
  ) as { x402Version: number; accepts: unknown[]; resource: { url: string } };
  assert.equal(required.x402Version, 2);
  assert.equal(required.accepts.length, 1);
  assert.match(required.resource.url, /\/r\//);

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
  assert.equal(unlocked.receipt?.status, undefined);
  const paid = handleLabGate(resourceId);
  assert.equal(paid.status, 200);
  assert.equal(paid.body.unlocked, true);
  assert.equal(paid.body.txid, "txid-lab");
  assert.equal(paid.body.source, "lab-stub");
  assert.notEqual(paid.body.status, "settled");
});

test("PAYMENT-SIGNATURE txid dialect verifies via injected observer", () => {
  clearReceipt();

  const settledSig = Buffer.from(
    JSON.stringify({ payload: { txid: "settled-txid" } }),
    "utf8",
  ).toString("base64");
  const settled = handleLabGate(resourceId, "http://127.0.0.1:3210", {
    paymentSignature: settledSig,
    observer: fakeObserver,
  });
  assert.equal(settled.status, 200);
  assert.equal(settled.body.source, "scan");
  assert.equal(settled.body.status, "settled");
  assert.equal(settled.body.txid, "settled-txid");
  assert.equal(settled.body.confirmations, 10);
  assert.ok(settled.headers?.["PAYMENT-RESPONSE"]);

  clearReceipt();
  const finalSig = JSON.stringify({ payload: { txid: "final-txid" } });
  const final = handleLabGate(resourceId, "http://127.0.0.1:3210", {
    paymentSignature: finalSig,
    observer: fakeObserver,
  });
  assert.equal(final.status, 402);
  assert.equal(
    (final.body.payment_status as { status?: string }).status,
    "final",
  );
  assert.equal(
    (final.body.payment_status as { confirmations?: number }).confirmations,
    2,
  );
  assert.equal(existsSync(join(root, "data", "receipt.json")), false);

  const wrongSig = Buffer.from(
    JSON.stringify({ paymentPayload: { payload: { txid: "wrong-memo" } } }),
    "utf8",
  ).toString("base64");
  const wrong = handleLabGate(resourceId, "http://127.0.0.1:3210", {
    paymentSignature: wrongSig,
    observer: fakeObserver,
  });
  assert.equal(wrong.status, 402);
  assert.equal(wrong.body.payment_status, undefined);
  assert.equal(existsSync(join(root, "data", "receipt.json")), false);
});
