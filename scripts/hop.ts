import { loadDotenv } from "../src/env.js";
import { runHop } from "../src/hop.js";

loadDotenv();

const proof = runHop();
console.log(proof.status);
console.log(proof.reason);
if (proof.resource_id) console.log("resource_id:", proof.resource_id);
if (proof.txid) console.log("txid:", proof.txid);
console.log("Official apply:", proof.officialApply);
console.log("Never use:", proof.neverUse);
if (proof.status !== "shielded") {
  process.exitCode = 1;
}
