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

function generateBlocks(blocks: number): boolean {
  return rpcText(["generate", String(blocks)]).ok;
}

function saplingZec(account: number): number {
  const bal = rpcJson<{ pools?: { sapling?: { valueZat?: number } } }>([
    "z_getbalanceforaccount",
    String(account),
  ]);
  const zat = bal.value?.pools?.sapling?.valueZat ?? 0;
  return zat / 1e8;
}

function accountSapling(account: number): { ok: boolean; ua?: string; sapling?: string; out: string } {
  const created = rpcJson<{ account?: number }>(["z_getnewaccount"]);
  if (!created.ok && !`${created.out}`.includes("already")) {
    // z_getnewaccount may fail if we just want an existing account
  }
  const addr = rpcJson<{ address?: string }>([
    "z_getaddressforaccount",
    String(account),
  ]);
  if (!addr.ok || !addr.value?.address) {
    return { ok: false, out: addr.out };
  }
  const receivers = rpcJson<{ sapling?: string }>([
    "z_listunifiedreceivers",
    addr.value.address,
  ]);
  if (!receivers.ok || !receivers.value?.sapling) {
    return { ok: false, ua: addr.value.address, out: receivers.out };
  }
  return {
    ok: true,
    ua: addr.value.address,
    sapling: receivers.value.sapling,
    out: addr.out,
  };
}

function opidFrom(out: string, value: unknown): string | undefined {
  if (value && typeof value === "object" && "opid" in value) {
    const opid = (value as { opid?: string }).opid;
    if (opid) return opid;
  }
  if (typeof value === "string" && value.startsWith("opid-")) return value;
  const match = out.match(/opid-[0-9a-f-]+/i);
  return match?.[0];
}

function waitOp(opid: string): { ok: boolean; txid?: string; out: string } {
  for (let i = 0; i < 90; i += 1) {
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

  const omnibus = accountSapling(0);
  const merchant = accountSapling(1);
  if (!omnibus.ok || !omnibus.ua || !omnibus.sapling || !merchant.ok || !merchant.ua || !merchant.sapling) {
    return pending(
      `unified sapling address failed: ${omnibus.out} ${merchant.out}`,
      { network: "regtest" },
    );
  }

  if (saplingZec(0) < 1.1) {
    if (!generateBlocks(101)) {
      return pending("generate 101 failed", {
        network: "regtest",
        omnibusAddress: omnibus.ua,
        merchantAddress: merchant.ua,
      });
    }

    // ZIP 317: do not pass a tiny fee, and do not shield every coinbase (limit 0).
    const shield = rpcJson<Record<string, unknown>>([
      "z_shieldcoinbase",
      "*",
      omnibus.ua,
      "null",
      "5",
      "",
      "AllowLinkingAccountAddresses",
    ]);
    const shieldOp = opidFrom(shield.out, shield.value);
    if (!shield.ok || !shieldOp) {
      return pending(`z_shieldcoinbase failed: ${shield.out}`, {
        network: "regtest",
        omnibusAddress: omnibus.ua,
        merchantAddress: merchant.ua,
      });
    }
    const shieldWait = waitOp(shieldOp);
    if (!shieldWait.ok) {
      return pending(`z_shieldcoinbase op failed: ${shieldWait.out}`, {
        network: "regtest",
        omnibusAddress: omnibus.ua,
        merchantAddress: merchant.ua,
      });
    }
    generateBlocks(1);
  }

  const payoutId = randomUUID();
  const memo = payoutIdToMemoHex(payoutId);
  const amounts = JSON.stringify([
    { address: merchant.ua, amount: 1.0, memo },
  ]);
  const send = rpcJson<Record<string, unknown>>([
    "z_sendmany",
    omnibus.ua,
    amounts,
    "1",
    "null",
    "FullPrivacy",
  ]);
  const sendOp = opidFrom(send.out, send.value);
  if (!send.ok || !sendOp) {
    return pending(`z_sendmany failed: ${send.out}`, {
      network: "regtest",
      payoutId,
      omnibusAddress: omnibus.ua,
      merchantAddress: merchant.ua,
    });
  }
  const sendWait = waitOp(sendOp);
  if (!sendWait.ok || !sendWait.txid) {
    return pending(`z_sendmany op failed: ${sendWait.out}`, {
      network: "regtest",
      payoutId,
      omnibusAddress: omnibus.ua,
      merchantAddress: merchant.ua,
    });
  }
  generateBlocks(1);

  return writeProof({
    status: "shielded",
    network: "regtest",
    reason:
      "Regtest shielded Payment with memo = payout_id. Not public Testnet. Public Testnet is milestone 1.",
    officialApply: OFFICIAL_APPLY,
    neverUse: NEVER_USE,
    updatedAt: new Date().toISOString(),
    payoutId,
    omnibusAddress: omnibus.ua,
    merchantAddress: merchant.ua,
    txid: sendWait.txid,
  });
}
