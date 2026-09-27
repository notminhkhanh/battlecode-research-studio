import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendor = path.join(root, "vendor", "unswbc");
const patch = path.join(root, "patches", "unswbc-research-hooks.patch");

function git(args) {
  return spawnSync("git", ["-C", vendor, ...args], { encoding: "utf8" });
}

const alreadyApplied = git(["apply", "--reverse", "--check", patch]);
if (alreadyApplied.status === 0) process.exit(0);

const applicable = git(["apply", "--check", patch]);
if (applicable.status !== 0) {
  console.error("Could not apply the Battlecode research hooks to vendor/unswbc.");
  console.error("Run `git submodule update --init --recursive`, then retry.");
  console.error(applicable.stderr.trim());
  process.exit(applicable.status ?? 1);
}

const applied = git(["apply", patch]);
if (applied.status !== 0) {
  console.error(applied.stderr.trim());
  process.exit(applied.status ?? 1);
}
