import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { appRoot } from "./paths.js";
import { parseScanNotes, type ScanNotesFile } from "./scan.js";

export function scannerBinary(): string | null {
  const release = join(appRoot(), "scanner", "target", "release", "zcash-scan");
  const debug = join(appRoot(), "scanner", "target", "debug", "zcash-scan");
  if (existsSync(release)) return release;
  if (existsSync(debug)) return debug;
  return null;
}

export function loadNotesFromFixture(path: string): ScanNotesFile {
  return parseScanNotes(JSON.parse(readFileSync(path, "utf8")));
}

/**
 * Load decrypted notes. CI and reviewers use a recorded fixture.
 * Live UFVK trial-decrypt is the Rust sidecar; TypeScript will not decrypt.
 */
export function loadScanNotes(fixture?: string): ScanNotesFile {
  const path = fixture?.trim() || process.env.ZCASH_SCAN_FIXTURE?.trim();
  if (path) return loadNotesFromFixture(path);

  const ufvk = process.env.ZCASH_UFVK?.trim();
  if (!ufvk) {
    throw new Error(
      "No scan notes. Pass --fixture, set ZCASH_SCAN_FIXTURE, or set ZCASH_UFVK after cargo build --release in scanner/.",
    );
  }

  const bin = scannerBinary();
  if (!bin) {
    throw new Error(
      "ZCASH_UFVK is set but scanner/target/{release,debug}/zcash-scan is missing. cargo build --release in scanner/. TypeScript will not trial-decrypt.",
    );
  }

  const lwd = process.env.ZCASH_LIGHTWALLETD?.trim() || "127.0.0.1:9067";
  const result = spawnSync(bin, ["--lightwalletd", lwd], {
    encoding: "utf8",
    env: { ...process.env, ZCASH_UFVK: ufvk },
  });
  if (result.status !== 0) {
    throw new Error(
      (result.stderr || result.stdout || "scanner --lightwalletd failed").trim(),
    );
  }
  return parseScanNotes(JSON.parse(result.stdout));
}
