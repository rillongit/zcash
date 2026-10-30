import assert from "node:assert/strict";
import { test } from "node:test";
import { memoBase64UrlToPayoutId } from "../src/memo.js";
import { parseHopProof, bindMemos } from "../src/proof.js";
import { createInvoiceFromHopProof } from "../src/invoice.js";
import { parseZip321Uri } from "../src/zip321.js";

test("hop proof and invoice share resource_id memo and receive UA", () => {
  const resourceId = "c69b98b8-4f69-45a2-adfa-b8d8072b44ad";
  const receiveAddress =
    "uregtest18fg9hwm2kf5lt2lalzm2xtry3tay6qp4g6n9w49unmwpsgxpcsuu6fqxuk69g0lmnztljwaj3rs8yup3cp2w7ehdw5hqskvqwmgew6prnsdgtvcrtvd9na0gzgke7ru9734h3h7smx9xcl6z8v8e4s2ms6f56as9gg0h60czsm07c3s4wpsn4tp0frx757jyw33uqhfd6z30k3ayc94";
  const memos = bindMemos(resourceId);
  assert.equal(Buffer.from(memos.memo_hex, "hex").toString("utf8"), resourceId);
  assert.equal(memoBase64UrlToPayoutId(memos.memo_base64url), resourceId);

  const invoice = createInvoiceFromHopProof(
    {
      status: "shielded",
      network: "regtest",
      reason: "test",
      officialApply: "",
      neverUse: "",
      updatedAt: new Date().toISOString(),
      resource_id: resourceId,
      receiveAddress,
      ...memos,
    },
    "0.001",
  );
  assert.equal(invoice.resource_id, resourceId);
  assert.equal(invoice.address, receiveAddress);
  assert.equal(invoice.memo, memos.memo_base64url);
  assert.equal(
    memoBase64UrlToPayoutId(parseZip321Uri(invoice.uri).memo),
    resourceId,
  );
});

test("legacy testnet-proof payoutId maps to resource_id and receive UA", () => {
  const parsed = parseHopProof({
    status: "shielded",
    network: "regtest",
    reason: "legacy",
    officialApply: "x",
    neverUse: "y",
    updatedAt: "2026-09-14T21:00:36.067Z",
    payoutId: "c69b98b8-4f69-45a2-adfa-b8d8072b44ad",
    omnibusAddress: "uregtest1funding",
    merchantAddress: "uregtest1receive",
    txid: "abc",
  });
  assert.ok(parsed);
  assert.equal(parsed.resource_id, "c69b98b8-4f69-45a2-adfa-b8d8072b44ad");
  assert.equal(parsed.receiveAddress, "uregtest1receive");
  assert.equal(parsed.fundingAddress, "uregtest1funding");
});
