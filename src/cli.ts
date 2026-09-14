import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { join } from "node:path";

const ROOT = process.env.ZCASH_APP_ROOT ?? process.cwd();
const CONTAINER = "lomi-zcashd-regtest";

export function dockerInfoOk(): boolean {
  return spawnSync("docker", ["info"], { encoding: "utf8" }).status === 0;
}

export function composeUp(): SpawnSyncReturns<string> {
  return spawnSync("docker", ["compose", "up", "-d"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 10 * 60 * 1000,
  });
}

export function zcli(args: string[]): SpawnSyncReturns<string> {
  const fromEnv = process.env.ZCASH_CLI?.trim();
  if (fromEnv) {
    return spawnSync(fromEnv, ["-regtest", ...args], {
      encoding: "utf8",
      timeout: 120_000,
    });
  }
  return spawnSync(
    "docker",
    ["exec", CONTAINER, "zcash-cli", "-regtest", ...args],
    { encoding: "utf8", timeout: 120_000 },
  );
}

export function composeFile(): string {
  return join(ROOT, "docker-compose.yml");
}
