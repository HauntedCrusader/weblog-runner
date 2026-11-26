/*
 * npm test             → runs every test
 * npm test frontmatter → only the test files with "frontmatter" in their name
 * npm test 05          → only file 05-*
 *
 * (Works the same on Windows, Linux and macOS: doesn't rely on the shell
 * expanding "*".)
 */

import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const dir = fileURLToPath(new URL("../test/", import.meta.url));
const filter = process.argv[2]?.toLowerCase();
const all = readdirSync(dir).filter((n) => n.endsWith(".test.js")).sort();
const chosen = filter ? all.filter((n) => n.toLowerCase().includes(filter)) : all;

if (!chosen.length) {
  console.error(`No test file with "${filter}" in its name. The ones that exist:\n  ${all.join("\n  ")}`);
  process.exit(1);
}

const r = spawnSync(process.execPath, ["--test", ...chosen.map((n) => join(dir, n))], { stdio: "inherit" });
process.exit(r.status ?? 1);
