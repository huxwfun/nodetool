#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const selfPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(selfPath), "..");

// Pin to the .nvmrc Node, which matches Electron 39's embedded Node (22.22.1).
// Diverging majors causes API/runtime drift between dev and the packaged app,
// and better-sqlite3 is compiled for exactly one ABI.
const pinnedVersion = readFileSync(join(repoRoot, ".nvmrc"), "utf8").trim();
const pinnedMajor = pinnedVersion.split(".")[0];

// Re-exec under the pinned Node rather than making every shell run `nvm use`
// first. RELAUNCHED guards against a loop if the pinned binary somehow reports
// a different major than its path claims.
const RELAUNCH_FLAG = "NODETOOL_ELECTRON_DEV_RELAUNCHED";
if (process.versions.node.split(".")[0] !== pinnedMajor) {
  const nvmDir = process.env["NVM_DIR"] || join(homedir(), ".nvm");
  const pinnedNode = join(nvmDir, "versions", "node", `v${pinnedVersion}`, "bin", "node");

  if (!process.env[RELAUNCH_FLAG] && existsSync(pinnedNode)) {
    console.log(`Switching to Node ${pinnedVersion} (.nvmrc) from ${process.version}...`);
    const relaunch = spawnSync(pinnedNode, [selfPath, ...process.argv.slice(2)], {
      stdio: "inherit",
      env: { ...process.env, [RELAUNCH_FLAG]: "1" },
    });
    process.exit(relaunch.status ?? 1);
  }

  console.error(`ERROR: Node.js ${pinnedMajor}.x required (found ${process.version})`);
  console.error("  Matches Electron 39's embedded Node — see .nvmrc.");
  console.error(`  Run: nvm install ${pinnedVersion}`);
  process.exit(1);
}

const isWindows = platform() === "win32";

if (isWindows) {
  console.log("Starting Electron development mode...");
  const r = spawnSync(
    "powershell",
    ["-ExecutionPolicy", "Bypass", "-File", "scripts/electron-dev.ps1"],
    { stdio: "inherit" }
  );
  process.exit(r.status ?? 1);
} else {
  console.log("Starting Electron development mode...");
  const r = spawnSync("bash", ["scripts/electron-dev.sh"], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}
