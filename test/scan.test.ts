import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { memoFieldToUtf8, payoutIdToMemoHex } from "../src/memo.js";
import { parseScanNotes, reconcileNotes, scanInvoice } from "../src/scan.js";
import { handleLabGate } from "../src/gate.js";
import { loadNotesFromFixture, loadScanNotes } from "../src/sidecar.js";

const matchPath = fileURLToPath(new URL("./fixtures/scan-notes.match.json", import.meta.url));
const mismatchPath = fileURLToPath(new URL("./fixtures/scan-notes.mismatch.json", import.meta.url));
const emptyPath = fileURLToPath(new URL("./fixtures/scan-notes.empty.json", import.meta.url));
const compactPath = fileURLToPath(new URL("./fixtures/compact-block.json", import.meta.url));

const resourceId = "c69b98b8-4f69-45a2-adfa-b8d8072b44ad";

test("scanner contract: matching memo unlocks, mismatch and empty stay closed", () => {
  const match = loadNotesFromFixture(matchPath);
  const matched = reconcileNotes(match.notes, resourceId);
  assert.equal(matched.status, "unlocked");
  assert.equal(matched.receipt?.source, "scan");
  assert.equal(matched.receipt?.resource_id, resourceId);
  assert.equal(
    matched.receipt?.txid,
    "e495cb6d132383e80f47170800bf32744fa4d576fba9d5566f056a9f39327059",
  );

  const mismatch = loadNotesFromFixture(mismatchPath);
  const missed = reconcileNotes(mismatch.notes, resourceId);
  assert.equal(missed.status, "closed");
  assert.equal(missed.receipt, undefined);

  const empty = loadNotesFromFixture(emptyPath);
  const unpaid = reconcileNotes(empty.notes, resourceId);
  assert.equal(unpaid.status, "closed");
});

test("scanner contract: padded hex memo still matches resource_id", () => {
  const hex = payoutIdToMemoHex(resourceId).padEnd(1024, "0");
  const result = reconcileNotes(
    [{ txid: "txid-hex", memo_utf8: hex }],
    resourceId,
  );
  assert.equal(memoFieldToUtf8(hex), resourceId);
  assert.equal(result.status, "unlocked");
  assert.equal(result.receipt?.txid, "txid-hex");
});

test("compact-block fixture records ZIP-307: memos are not in compact outputs", () => {
  const compact = JSON.parse(readFileSync(compactPath, "utf8")) as {
    comment: string;
    vtx: Array<{ outputs: Array<Record<string, string>> }>;
  };
  assert.match(compact.comment, /ZIP-307/);
  assert.equal("memo" in compact.vtx[0].outputs[0], false);
});

test("scan receipt is the only path that 200s the gate without a lab-stub", () => {
  const root = mkdtempSync(join(tmpdir(), "zcash-scan-"));
  process.env.ZCASH_APP_ROOT = root;
  mkdirSync(join(root, "data"), { recursive: true });
  const receiveAddress =
    "uregtest18fg9hwm2kf5lt2lalzm2xtry3tay6qp4g6n9w49unmwpsgxpcsuu6fqxuk69g0lmnztljwaj3rs8yup3cp2w7ehdw5hqskvqwmgew6prnsdgtvcrtvd9na0gzgke7ru9734h3h7smx9xcl6z8v8e4s2ms6f56as9gg0h60czsm07c3s4wpsn4tp0frx757jyw33uqhfd6z30k3ayc94";
  const uri = `zcash:${receiveAddress}?amount=0.001&memo=YzY5Yjk4YjgtNGY2OS00NWEyLWFkZmEtYjhkODA3MmI0NGFk`;
  writeFileSync(
    join(root, "data", "invoice.json"),
    `${JSON.stringify({
      resource_id: resourceId,
      amount_zec: "0.001",
      address: receiveAddress,
      uri,
      memo: "YzY5Yjk4YjgtNGY2OS00NWEyLWFkZmEtYjhkODA3MmI0NGFk",
      network: "regtest",
      status: "ready",
      reason: "test",
      updatedAt: new Date().toISOString(),
    }, null, 2)}\n`,
  );

  assert.equal(handleLabGate(resourceId).status, 402);

  const mismatch = parseScanNotes(
    JSON.parse(readFileSync(mismatchPath, "utf8")),
  );
  const closed = scanInvoice(mismatch.notes);
  assert.equal(closed.status, "closed");
  assert.equal(handleLabGate(resourceId).status, 402);

  const match = parseScanNotes(JSON.parse(readFileSync(matchPath, "utf8")));
  const opened = scanInvoice(match.notes);
  assert.equal(opened.status, "unlocked");
  const paid = handleLabGate(resourceId);
  assert.equal(paid.status, 200);
  assert.equal(paid.body.source, "scan");
  assert.equal(paid.body.txid, match.notes[0]?.txid);
});

test("sidecar without fixture or UFVK fails closed", () => {
  const previousUfvk = process.env.ZCASH_UFVK;
  const previousFixture = process.env.ZCASH_SCAN_FIXTURE;
  delete process.env.ZCASH_UFVK;
  delete process.env.ZCASH_SCAN_FIXTURE;
  assert.throws(() => loadScanNotes(), /No scan notes/);
  process.env.ZCASH_UFVK = "uview1-not-a-real-key";
  assert.throws(() => loadScanNotes(), /zcash-scan is missing|trial-decrypt is not in this binary/);
  if (previousUfvk === undefined) delete process.env.ZCASH_UFVK;
  else process.env.ZCASH_UFVK = previousUfvk;
  if (previousFixture === undefined) delete process.env.ZCASH_SCAN_FIXTURE;
  else process.env.ZCASH_SCAN_FIXTURE = previousFixture;
});
