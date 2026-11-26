// Warnings for broken images, links and anchors.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { htmlReferences, htmlIds, resolveReference } from "../src/check.js";
import { loadConfig } from "../src/config.js";
import { build } from "../src/build.js";

test("references: src and href of real tags, not of code", () => {
  assert.deepEqual(
    htmlReferences('<p><img src="a.png" alt=""> <a href="/b/?x=1&amp;y=2">b</a> <code>&lt;img src="c.png"&gt;</code></p>'),
    [
      { attribute: "src", value: "a.png" },
      { attribute: "href", value: "/b/?x=1&y=2" },
    ],
  );
});

test("the post's ids", () => {
  assert.deepEqual([...htmlIds('<h2 id="a">A</h2><div id="b-c"></div>')], ["a", "b-c"]);
});

test("where each reference points", () => {
  const cases = [
    ["photo.jpg", { type: "local", path: "blog/a/photo.jpg" }],
    ["./photos/b.jpg", { type: "local", path: "blog/a/photos/b.jpg" }],
    ["../b/", { type: "local", path: "blog/b/" }],
    ["..", { type: "local", path: "blog/" }],
    ["../../", { type: "local", path: "" }],
    ["/img/x.png", { type: "local", path: "img/x.png" }],
    ["../b/#section", { type: "local", path: "blog/b/" }],
    ["my%20photo.png", { type: "local", path: "blog/a/my photo.png" }],
    ["#section", { type: "anchor", id: "section" }],
    ["https://x.com/a.png", { type: "external" }],
    ["//cdn.x.com/a.js", { type: "external" }],
    ["mailto:a@b.c", { type: "external" }],
    ["data:image/png;base64,AAA", { type: "external" }],
    ["?page=2", { type: "external" }],
    ["../../../outside.png", { type: "outside" }],
  ];
  for (const [value, expected] of cases) assert.deepEqual(resolveReference(value, "blog/a/"), expected, value);
});

/** A site with the blog at blog/, a site image and a contact page. */
async function site(posts) {
  const dir = await mkdtemp(join(tmpdir(), "weblog-runner-warnings-"));
  await mkdir(join(dir, "img"), { recursive: true });
  await writeFile(join(dir, "img", "logo.png"), "png");
  await mkdir(join(dir, "contact"));
  await writeFile(join(dir, "contact", "index.html"), "<p>contact</p>");
  await writeFile(
    join(dir, "weblog.config.js"),
    `export default {
  site: { title: "T", url: "https://t.com/" },
  input: "posts", output: "blog", basePath: "blog/",
  templates: { post: (p) => p.html, list: () => "" },
};`,
  );
  for (const [name, text] of Object.entries(posts)) {
    await mkdir(join(dir, "posts", name, ".."), { recursive: true });
    await writeFile(join(dir, "posts", name), text);
  }
  return dir;
}

const head = (title, extra = "") => `---\ntitle: ${title}\ndate: 2026-11-20\n${extra}---\n`;

test("the build warns about what doesn't exist and says nothing about what does", async (t) => {
  const dir = await site({
    "good/index.md": head("Good", "cover: cover.png\n") + [
      "![ok](photo.png) ![site](/img/logo.png) [other](../bad/) [contact](/contact/) [list](../)",
      "[external](https://x.com/nothing.png) [email](mailto:a@b.c) [here](#heading)",
      "",
      "## Heading",
    ].join("\n"),
    "good/photo.png": "png",
    "good/cover.png": "png",
    "bad.md": head("Bad", "cover: /img/missing.png\n") + [
      "![none](photo.png) ![none2](/img/nothing.png) [a post that doesn't exist](../ghost/)",
      "[anchor](#not-here) [too far up](../../../x.html) [folder without index](/img/)",
      '<img src="not-either.jpg" alt="">',
    ].join("\n"),
  });
  t.after(() => rm(dir, { recursive: true, force: true }));

  const r = await build(await loadConfig(join(dir, "weblog.config.js")));
  assert.deepEqual(
    r.warnings.map((w) => `${w.file}: ${w.message}`),
    [
      "bad.md: image not found: photo.png",
      "bad.md: image not found: /img/nothing.png",
      "bad.md: broken link: ../ghost/",
      "bad.md: anchor not found in the post: #not-here",
      "bad.md: broken link (goes above the site root): ../../../x.html",
      "bad.md: broken link: /img/",
      "bad.md: image not found: not-either.jpg",
      "bad.md: cover not found: /img/missing.png",
    ],
  );
});

test("a link to a post that only exists in this build counts too", async (t) => {
  const dir = await site({
    "a.md": head("A") + "[to b](../b/) and [to page 1](../)",
    "b.md": head("B") + "Text.",
  });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const r = await build(await loadConfig(join(dir, "weblog.config.js")));
  assert.deepEqual(r.warnings, []);
});

test("a link to a draft warns in a normal build, not with drafts", async (t) => {
  const dir = await site({
    "a.md": head("A") + "[see the draft](../d/)",
    "d.md": head("D", "draft: true\n") + "x",
  });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const config = await loadConfig(join(dir, "weblog.config.js"));
  assert.equal((await build(config, { includeDrafts: true })).warnings.length, 0);
  // and after the normal build the draft's page was cleaned up: the link breaks
  assert.deepEqual((await build(config)).warnings.map((w) => w.message), ["broken link: ../d/"]);
});

test("the command shows the warnings; with --strict, it fails", async (t) => {
  const dir = await site({ "a.md": head("A") + "![none](nothing.png)" });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const bin = fileURLToPath(new URL("../bin/weblog-runner.js", import.meta.url));

  const normal = spawnSync(process.execPath, [bin, "build"], { cwd: dir, encoding: "utf8" });
  assert.equal(normal.status, 0);
  assert.match(normal.stdout, /⚠ a\.md: image not found: nothing\.png/);

  const strict = spawnSync(process.execPath, [bin, "build", "--strict"], { cwd: dir, encoding: "utf8" });
  assert.equal(strict.status, 1);
  assert.match(strict.stderr, /✗ 1 warning \(--strict\)/);
});
