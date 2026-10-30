import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { writeInvoice } from "../src/invoice.js";

test("invoice stays pending with no URI when there is no hop", () => {
  const root = mkdtempSync(join(tmpdir(), "zcash-invoice-"));
  process.env.ZCASH_APP_ROOT = root;
  delete process.env.ZCASH_INVOICE_ADDRESS;
  const invoice = writeInvoice();
  assert.equal(invoice.status, "pending");
  assert.equal(invoice.uri, "");
  assert.equal(invoice.address, "");
  const written = JSON.parse(
    readFileSync(join(root, "data", "invoice.json"), "utf8"),
  ) as { uri: string; status: string };
  assert.equal(written.status, "pending");
  assert.equal(written.uri, "");
});
