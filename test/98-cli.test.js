// The command line: error messages and "new".
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const bin = fileURLToPath(new URL("../bin/weblog-runner.js", import.meta.url));
const templates = pathToFileURL(fileURLToPath(new URL("../example/templates.js", import.meta.url))).href;

const run = (dir, ...args) => spawnSync(process.execPath, [bin, ...args], { cwd: dir, encoding: "utf8" });

async function blog(posts) {
  const dir = await mkdtemp(join(tmpdir(), "weblog-runner-cli-"));
  await mkdir(join(dir, "posts"));
  await writeFile(
    join(dir, "weblog.config.js"),
    `import { post, list } from ${JSON.stringify(templates)};
export default { site: { title: "T", url: "https://t.com/" }, input: "posts", output: "out", basePath: "blog/", templates: { post, list } };`,
  );
  for (const [name, text] of Object.entries(posts)) await writeFile(join(dir, "posts", name), text);
  return dir;
}

test("build works and says what it generated", async (t) => {
  const dir = await blog({ "a.md": "---\ntitle: A\ndate: 2026-01-01\n---\nText." });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const r = run(dir, "build");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /✓ 1 post, 1 list page, 0 tags → out/);
  assert.match(await readFile(join(dir, "out", "a", "index.html"), "utf8"), /<p>Text\.<\/p>/);
});

test("invalid date: the error names the file", async (t) => {
  const dir = await blog({ "bad.md": "---\ntitle: Bad\ndate: 2026-02-30\n---\nText." });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const r = run(dir, "build");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /✗ bad\.md: invalid date/);
});

test("missing title", async (t) => {
  const dir = await blog({ "none.md": "---\ndate: 2026-01-01\n---\nText." });
  t.after(() => rm(dir, { recursive: true, force: true }));
  assert.match(run(dir, "build").stderr, /✗ none\.md: missing "title:"/);
});

test("two posts with the same address: names both files", async (t) => {
  const dir = await blog({
    "a.md": "---\ntitle: A\ndate: 2026-01-01\nslug: same\n---\nx",
    "b.md": "---\ntitle: B\ndate: 2026-01-02\nslug: same\n---\ny",
  });
  t.after(() => rm(dir, { recursive: true, force: true }));
  assert.match(run(dir, "build").stderr, /✗ a\.md and b\.md: both get the same address \(same\)/);
});

test("a config with problems lists them all", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "weblog-runner-cli-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, "weblog.config.js"), `export default { site: { url: "no-slash" } };`);
  const r = run(dir, "build");
  assert.equal(r.status, 1);
  for (const field of ["site.title", "site.url", "input", "output", "templates.post", "templates.list"]) {
    assert.match(r.stderr, new RegExp(`- ${field.replace(".", "\\.")}:`));
  }
});

test("new creates the post as a draft, in a folder, and doesn't overwrite", async (t) => {
  const dir = await blog({ "old-flat-post.md": "---\ntitle: Old\ndate: 2026-01-01\n---\nText." });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const r = run(dir, "new", "My First Post!");
  assert.equal(r.status, 0, r.stderr);
  const text = await readFile(join(dir, "posts", "my-first-post", "index.md"), "utf8");
  assert.match(text, /^---\ntitle: "My First Post!"\ndate: \d{4}-\d{2}-\d{2}\ntags: \[\]\ndraft: true\n---\n/);
  assert.equal(run(dir, "new", "My First Post!").status, 1);
  // a flat post with the same address also counts as taken
  const flat = run(dir, "new", "Old flat post");
  assert.equal(flat.status, 1);
  assert.match(flat.stderr, /Already exists: .*old-flat-post\.md/);
  // and the created post builds, with the title intact (even one that looks like a number)
  run(dir, "new", "42");
  const r2 = run(dir, "build", "--drafts");
  assert.equal(r2.status, 0, r2.stderr);
  assert.match(await readFile(join(dir, "out", "42", "index.html"), "utf8"), /<h1>42<\/h1>/);
});

test("unknown command", () => {
  const r = run(tmpdir(), "xyz");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown command: xyz/);
});

test("--version prints the package version", async () => {
  const pkg = JSON.parse(await readFile(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"));
  assert.equal(run(tmpdir(), "--version").stdout.trim(), pkg.version);
});
