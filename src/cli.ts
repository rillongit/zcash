import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { join } from "node:path";

const ROOT = process.env.ZCASH_APP_ROOT ?? process.cwd();
const PAYER_CONTAINER = "rill-zcashd-regtest";
const OBSERVER_CONTAINER = "rill-zcashd-observer";

export type ZcashNode = "payer" | "observer";

export function dockerInfoOk(): boolean {
  return spawnSync("docker", ["info"], { encoding: "utf8" }).status === 0;
}

export function composeUp(): SpawnSyncReturns<string> {
  return spawnSync("docker", ["compose", "up", "-d", "--remove-orphans"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 20 * 60 * 1000,
  });
}

export function zcli(
  args: string[],
  node: ZcashNode = "payer",
): SpawnSyncReturns<string> {
  const fromEnv = (
    node === "observer" ? process.env.ZCASH_OBSERVER_CLI : process.env.ZCASH_CLI
  )?.trim();
  if (fromEnv) {
    return spawnSync(fromEnv, ["-regtest", ...args], {
      encoding: "utf8",
      timeout: 10 * 60 * 1000,
    });
  }
  const container = node === "observer" ? OBSERVER_CONTAINER : PAYER_CONTAINER;
  return spawnSync(
    "docker",
    [
      "exec",
      container,
      "zcash-cli",
      "-regtest",
      "-rpcuser=rill",
      "-rpcpassword=regtest",
      ...args,
    ],
    { encoding: "utf8", timeout: 10 * 60 * 1000 },
  );
}

export function composeFile(): string {
  return join(ROOT, "docker-compose.yml");
}
