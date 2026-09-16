import { createServer } from "node:http";
import { loadDotenv } from "../src/env.js";
import { handleLabGate } from "../src/gate.js";

loadDotenv();

const port = Number(process.env.ZCASH_GATE_PORT?.trim() || "3210");
const host = process.env.ZCASH_GATE_HOST?.trim() || "127.0.0.1";
const origin = `http://${host}:${port}`;

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", origin);
  const match = url.pathname.match(/^\/r\/([^/]+)\/?$/);
  if (req.method !== "GET" || !match) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      `${JSON.stringify({
        ok: false,
        error: { code: "not_found", message: "Lab gate is GET /r/:resource_id" },
      })}\n`,
    );
    return;
  }

  const result = handleLabGate(decodeURIComponent(match[1] ?? ""), origin);
  res.writeHead(result.status, { "content-type": "application/json" });
  res.end(`${JSON.stringify(result.body, null, 2)}\n`);
});

server.listen(port, host, () => {
  console.log(`lab 402 on ${origin}/r/{resource_id}`);
  console.log("Unpaid until data/receipt.json exists (pnpm scan, or pnpm unlock -- --lab-stub).");
});
