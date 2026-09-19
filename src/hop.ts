import { randomUUID } from "node:crypto";
import { composeUp, dockerInfoOk, zcli, type ZcashNode } from "./cli.js";
import { payoutIdToMemoHex } from "./memo.js";
import {
  bindMemos,
  OFFICIAL_APPLY,
  NEVER_USE,
  readExistingResourceId,
  writeHopProof,
  type HopProof,
} from "./proof.js";

export type { HopProof };

function pending(reason: string, extra: Partial<HopProof> = {}): HopProof {
  return writeHopProof({
    status: "pending",
    network: extra.network ?? "none",
    reason,
    officialApply: OFFICIAL_APPLY,
    neverUse: NEVER_USE,
    updatedAt: new Date().toISOString(),
    ...extra,
  });
}

function rpcText(
  args: string[],
  node: ZcashNode = "payer",
): { ok: boolean; out: string } {
  const result = zcli(args, node);
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return { ok: result.status === 0, out };
}

function rpcJson<T>(
  args: string[],
  node: ZcashNode = "payer",
): { ok: boolean; value?: T; out: string } {
  const { ok, out } = rpcText(args, node);
  if (!ok) return { ok, out };
  try {
    return { ok: true, value: JSON.parse(out) as T, out };
  } catch {
    return { ok: true, value: out as T, out };
  }
}

function waitReady(attempts: number, node: ZcashNode = "payer"): boolean {
  for (let i = 0; i < attempts; i += 1) {
    const ping = rpcText(["getblockchaininfo"], node);
    if (ping.ok) return true;
    const legacy = rpcText(["getinfo"], node);
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

function accountSapling(account: number): {
  ok: boolean;
  ua?: string;
  sapling?: string;
  out: string;
} {
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
    const result = rpcJson<
      Array<{
        id?: string;
        status?: string;
        result?: { txid?: string };
        error?: { message?: string };
      }>
    >(["z_getoperationresult", `["${opid}"]`]);
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

function exportViewingKey(address: string): string | undefined {
  const result = zcli(["z_exportviewingkey", address], "payer");
  if (result.status !== 0) return undefined;
  const out = (result.stdout ?? "").trim();
  try {
    const parsed = JSON.parse(out);
    if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
  } catch {
    if (out) return out;
  }
  return undefined;
}

function importViewingKey(vk: string): boolean {
  const result = zcli(
    ["z_importviewingkey", vk, "whenkeyisnew", "0"],
    "observer",
  );
  return result.status === 0;
}

function waitObserverCatchup(attempts: number): boolean {
  for (let i = 0; i < attempts; i += 1) {
    const payer = rpcJson<{ blocks?: number }>(["getblockchaininfo"], "payer");
    const observer = rpcJson<{ blocks?: number }>(
      ["getblockchaininfo"],
      "observer",
    );
    const payerBlocks = payer.value?.blocks ?? 0;
    const observerBlocks = observer.value?.blocks ?? 0;
    if (
      payer.ok &&
      observer.ok &&
      payerBlocks > 0 &&
      observerBlocks >= payerBlocks
    ) {
      return true;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
  return false;
}

function resolveReceiveSapling(): {
  ok: boolean;
  sapling?: string;
  out: string;
} {
  const uaReceive = accountSapling(1);
  if (uaReceive.ok && uaReceive.sapling) {
    const vk = exportViewingKey(uaReceive.sapling);
    if (vk) {
      if (!importViewingKey(vk)) {
        return { ok: false, out: "observer z_importviewingkey failed" };
      }
      return { ok: true, sapling: uaReceive.sapling, out: uaReceive.out };
    }
  }

  const created = rpcJson<string>(["z_getnewaddress", "sapling"]);
  const sapling = typeof created.value === "string" ? created.value.trim() : "";
  if (!created.ok || !sapling) {
    return { ok: false, out: created.out || uaReceive.out };
  }
  const vk = exportViewingKey(sapling);
  if (!vk) {
    return {
      ok: false,
      sapling,
      out: "z_exportviewingkey failed on sapling address",
    };
  }
  if (!importViewingKey(vk)) {
    return { ok: false, sapling, out: "observer z_importviewingkey failed" };
  }
  return { ok: true, sapling, out: created.out };
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

  if (!waitReady(40, "payer")) {
    return pending(
      "zcashd did not answer getinfo on regtest. First start downloads proving params; retry pnpm hop.",
      { network: "regtest" },
    );
  }

  if (!waitReady(80, "observer")) {
    return pending(
      "Watch-only observer zcashd did not answer RPC. Check rill-zcashd-observer and retry pnpm hop.",
      { network: "regtest" },
    );
  }

  const funding = accountSapling(0);
  if (!funding.ok || !funding.ua || !funding.sapling) {
    return pending(`unified sapling funding address failed: ${funding.out}`, {
      network: "regtest",
    });
  }

  const receive = resolveReceiveSapling();
  if (!receive.ok || !receive.sapling) {
    return pending(`sapling viewing key import failed: ${receive.out}`, {
      network: "regtest",
      fundingAddress: funding.ua,
    });
  }

  const addresses = {
    network: "regtest" as const,
    receiveAddress: receive.sapling,
    fundingAddress: funding.ua,
  };

  if (saplingZec(0) < 1.1) {
    if (!generateBlocks(101)) {
      return pending("generate 101 failed", addresses);
    }

    // ZIP 317: do not pass a tiny fee, and do not shield every coinbase (limit 0).
    const shield = rpcJson<Record<string, unknown>>([
      "z_shieldcoinbase",
      "*",
      funding.sapling,
      "null",
      "5",
      "",
      "AllowLinkingAccountAddresses",
    ]);
    const shieldOp = opidFrom(shield.out, shield.value);
    if (!shield.ok || !shieldOp) {
      return pending(`z_shieldcoinbase failed: ${shield.out}`, addresses);
    }
    const shieldWait = waitOp(shieldOp);
    if (!shieldWait.ok) {
      return pending(
        `z_shieldcoinbase op failed: ${shieldWait.out}`,
        addresses,
      );
    }
    generateBlocks(1);
  }

  const resourceId = readExistingResourceId() ?? randomUUID();
  const memos = bindMemos(resourceId);
  const memo = payoutIdToMemoHex(resourceId);
  const bound = { ...addresses, resource_id: resourceId, ...memos };
  const amounts = JSON.stringify([
    { address: receive.sapling, amount: 1.0, memo },
  ]);
  const send = rpcJson<Record<string, unknown>>([
    "z_sendmany",
    funding.ua,
    amounts,
    "1",
    "null",
    "FullPrivacy",
  ]);
  const sendOp = opidFrom(send.out, send.value);
  if (!send.ok || !sendOp) {
    return pending(`z_sendmany failed: ${send.out}`, bound);
  }
  const sendWait = waitOp(sendOp);
  if (!sendWait.ok || !sendWait.txid) {
    return pending(`z_sendmany op failed: ${sendWait.out}`, bound);
  }
  if (!generateBlocks(10)) {
    return pending("generate 10 failed", { ...bound, txid: sendWait.txid });
  }

  if (!waitObserverCatchup(90)) {
    return pending(
      "Observer chain height did not catch the payer after the shielded send. Check -connect=zcashd / payer listen flags.",
      { ...bound, txid: sendWait.txid },
    );
  }

  return writeHopProof({
    status: "shielded",
    network: "regtest",
    reason:
      "Regtest shielded Payment with memo = resource_id (hex on chain, base64url in ZIP-321). Same sapling receive address as pnpm invoice. Watch-only observer imported a sapling viewing key. Not public Testnet. Public Testnet is milestone 1.",
    officialApply: OFFICIAL_APPLY,
    neverUse: NEVER_USE,
    updatedAt: new Date().toISOString(),
    resource_id: resourceId,
    memo_hex: memos.memo_hex,
    memo_base64url: memos.memo_base64url,
    receiveAddress: receive.sapling,
    fundingAddress: funding.ua,
    txid: sendWait.txid,
    observer: {
      node: "zcashd-viewkey",
      imported: true,
      key_kind: "sapling_extfvk",
    },
  });
}
