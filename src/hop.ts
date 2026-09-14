import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { composeUp, dockerInfoOk, zcli } from "./cli.js";
import { payoutIdToMemoHex } from "./memo.js";

const ROOT = process.env.ZCASH_APP_ROOT ?? process.cwd();
const DATA = join(ROOT, "data");

export type HopProof = {
  status: "pending" | "shielded";
  network: "regtest" | "testnet" | "none";
  reason: string;
  officialApply: string;
  neverUse: string;
  updatedAt: string;
  payoutId?: string;
  omnibusAddress?: string;
  merchantAddress?: string;
  txid?: string;
};

const OFFICIAL_APPLY =
  "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/new?template=grant_application.yaml";
const NEVER_USE = "https://zcashgranthub.vercel.app/apply";

function writeProof(proof: HopProof): HopProof {
  mkdirSync(DATA, { recursive: true });
  writeFileSync(join(DATA, "testnet-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);
  return proof;
}

function pending(reason: string, extra: Partial<HopProof> = {}): HopProof {
  return writeProof({
    status: "pending",
    network: extra.network ?? "none",
    reason,
    officialApply: OFFICIAL_APPLY,
    neverUse: NEVER_USE,
    updatedAt: new Date().toISOString(),
    ...extra,
  });
}

function rpcText(args: string[]): { ok: boolean; out: string } {
  const result = zcli(args);
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return { ok: result.status === 0, out };
}

function rpcJson<T>(args: string[]): { ok: boolean; value?: T; out: string } {
  const { ok, out } = rpcText(args);
  if (!ok) return { ok, out };
  try {
    return { ok: true, value: JSON.parse(out) as T, out };
  } catch {
    return { ok: true, value: out as T, out };
  }
}

function waitReady(attempts: number): boolean {
  for (let i = 0; i < attempts; i += 1) {
    const ping = rpcText(["getblockchaininfo"]);
    if (ping.ok) return true;
    const legacy = rpcText(["getinfo"]);
    if (legacy.ok) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
  }
  return false;
}

function generateTo(address: string, blocks: number): boolean {
  return rpcText(["generatetoaddress", String(blocks), address]).ok;
}

function waitOp(opid: string): { ok: boolean; txid?: string; out: string } {
  for (let i = 0; i < 40; i += 1) {
    const result = rpcJson<Array<{ id?: string; status?: string; result?: { txid?: string }; error?: { message?: string } }>>(
      ["z_getoperationresult", `["${opid}"]`],
    );
    if (result.ok && Array.isArray(result.value) && result.value.length > 0) {
      const op = result.value[0];
      if (op.status === "success" && op.result?.txid) {
        return { ok: true, txid: op.result.txid, out: JSON.stringify(op) };
      }
      if (op.status === "failed") {
        return { ok: false, out: op.error?.message ?? JSON.stringify(op) };
      }
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
  return { ok: false, out: `operation ${opid} timed out` };
}

export function runHop(): HopProof {
  if (!dockerInfoOk() && !process.env.ZCASH_CLI?.trim()) {
    return pending(
      "Docker is not running and zcash-cli is not on PATH. Start Docker Desktop, then pnpm hop. Public Testnet is later; this hop is local regtest.",
    );
  }

  if (!process.env.ZCASH_CLI?.trim()) {
    const up = composeUp();
    if (up.status !== 0) {
      return pending(
        `docker compose up failed: ${(up.stderr || up.stdout || "").trim()}`,
      );
    }
  }

  if (!waitReady(40)) {
    return pending(
      "zcashd did not answer getinfo on regtest. First start downloads proving params; retry pnpm hop.",
      { network: "regtest" },
    );
  }

  const miner = rpcText(["getnewaddress"]);
  if (!miner.ok || !miner.out) {
    return pending(`getnewaddress failed: ${miner.out}`, { network: "regtest" });
  }

  const omnibus = rpcText(["z_getnewaddress", "sapling"]);
  const merchant = rpcText(["z_getnewaddress", "sapling"]);
  if (!omnibus.ok || !merchant.ok) {
    return pending(
      `z_getnewaddress failed: ${omnibus.out} ${merchant.out}`,
      { network: "regtest" },
    );
  }

  if (!generateTo(miner.out, 101)) {
    return pending("generatetoaddress 101 failed", {
      network: "regtest",
      omnibusAddress: omnibus.out,
      merchantAddress: merchant.out,
    });
  }

  const shield = rpcJson<{ opid?: string } | string>([
    "z_shieldcoinbase",
    miner.out,
    omnibus.out,
  ]);
  const shieldOp =
    typeof shield.value === "string"
      ? shield.value
      : shield.value?.opid ?? shield.out;
  if (!shield.ok || !shieldOp) {
    return pending(`z_shieldcoinbase failed: ${shield.out}`, {
      network: "regtest",
      omnibusAddress: omnibus.out,
      merchantAddress: merchant.out,
    });
  }
  const shieldWait = waitOp(shieldOp);
  if (!shieldWait.ok) {
    return pending(`z_shieldcoinbase op failed: ${shieldWait.out}`, {
      network: "regtest",
      omnibusAddress: omnibus.out,
      merchantAddress: merchant.out,
    });
  }
  generateTo(miner.out, 1);

  const payoutId = randomUUID();
  const memo = payoutIdToMemoHex(payoutId);
  const amounts = JSON.stringify([
    { address: merchant.out, amount: 1.0, memo },
  ]);
  const send = rpcJson<{ opid?: string } | string>([
    "z_sendmany",
    omnibus.out,
    amounts,
    "1",
    "0.0001",
    "FullPrivacy",
  ]);
  const sendOp =
    typeof send.value === "string" ? send.value : send.value?.opid ?? send.out;
  if (!send.ok || !sendOp) {
    return pending(`z_sendmany failed: ${send.out}`, {
      network: "regtest",
      payoutId,
      omnibusAddress: omnibus.out,
      merchantAddress: merchant.out,
    });
  }
  const sendWait = waitOp(sendOp);
  if (!sendWait.ok || !sendWait.txid) {
    return pending(`z_sendmany op failed: ${sendWait.out}`, {
      network: "regtest",
      payoutId,
      omnibusAddress: omnibus.out,
      merchantAddress: merchant.out,
    });
  }
  generateTo(miner.out, 1);

  return writeProof({
    status: "shielded",
    network: "regtest",
    reason:
      "Regtest shielded Payment with memo = payout_id. Not public Testnet. Public Testnet is milestone 1.",
    officialApply: OFFICIAL_APPLY,
    neverUse: NEVER_USE,
    updatedAt: new Date().toISOString(),
    payoutId,
    omnibusAddress: omnibus.out,
    merchantAddress: merchant.out,
    txid: sendWait.txid,
  });
}
