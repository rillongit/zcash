import { loadDotenv } from "../src/env.js";
import { writeInvoice } from "../src/invoice.js";

loadDotenv();

const invoice = writeInvoice();
console.log(invoice.status);
console.log(invoice.reason);
if (invoice.uri) console.log(invoice.uri);
if (invoice.status !== "ready") {
  process.exitCode = 1;
}
