// Folder posts (with images), cover, href, language, site root and output cleanup.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, rename, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { loadConfig, validateConfig } from "../src/config.js";
import { build } from "../src/build.js";
import { href } from "../src/links.js";

const exists = (p) => access(p).then(() => true, () => false);

/** A blog in a temp folder. Its templates remember what they received. */
async function blog(files, extra = "") {
  const dir = await mkdtemp(join(tmpdir(), "weblog-runner-folders-"));
  await writeFile(
    join(dir, "weblog.config.js"),
    `export const received = [];
export default {
  site: { title: "T", url: "https://t.com/" },
  input: "posts", output: "public/blog", basePath: "blog/",
  ${extra}
  templates: {
    post: (post) => { received.push(post); return "<main>" + post.html + "</main>"; },
    list: () => "<list>",
  },
};`,
  );
  for (const [name, content] of Object.entries(files)) {
    await mkdir(join(dir, "posts", name, ".."), { recursive: true });
    await writeFile(join(dir, "posts", name), content);
  }
  const run = async (options) => build(await loadConfig(join(dir, "weblog.config.js")), options);
  return { dir, output: join(dir, "public", "blog"), run };
}

const post = (title, extra = "") => `---\ntitle: ${title}\ndate: 2026-11-20\n${extra}---\n`;

test("folder post: the address comes from the folder and images go along", async (t) => {
  const { dir, output, run } = await blog({
    "with-images/index.md": post("With images") + "![A photo](photo.svg)\n",
    "with-images/photo.svg": "<svg/>",
    "with-images/files/manual.pdf": "pdf",
    "with-images/draft-notes.md": "neither a post nor an asset",
    "with-images/.hidden": "x",
    "simple.md": post("Simple") + "Text.",
  });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const r = await run();

  assert.equal(r.posts, 2);
  assert.match(await readFile(join(output, "with-images", "index.html"), "utf8"), /<img src="photo.svg" alt="A photo">/);
  assert.equal(await readFile(join(output, "with-images", "photo.svg"), "utf8"), "<svg/>");
  assert.ok(await exists(join(output, "with-images", "files", "manual.pdf")));
  assert.equal(await exists(join(output, "with-images", "draft-notes.md")), false, ".md isn't copied");
  assert.equal(await exists(join(output, "with-images", ".hidden")), false, "hidden files aren't copied");
  assert.ok(r.files.includes("with-images/photo.svg"));
});

test("a folder without index.md is ignored; a folder and a file with the same name throw", async (t) => {
  const { dir, run } = await blog({
    "images/loose.png": "x",
    "dup/index.md": post("A"),
    "dup.md": post("B"),
  });
  t.after(() => rm(dir, { recursive: true, force: true }));
  await assert.rejects(run(), /dup.md and dup\/index.md: both get the same address \(dup\)|dup\/index.md and dup.md: both get the same address \(dup\)/);
});

test("cover: relative, from the root and external", async (t) => {
  const { dir, run } = await blog({
    "a/index.md": post("A", "cover: cover.jpg\n"),
    "b.md": post("B", "cover: /img/b.png\n"),
    "c.md": post("C", "cover: https://cdn.example.com/c.png\n"),
    "d.md": post("D"),
  });
  t.after(() => rm(dir, { recursive: true, force: true }));
  await run();
  const { received } = await import(pathToFileURL(join(dir, "weblog.config.js")).href);
  const by = Object.fromEntries(received.map((p) => [p.slug, p]));
  assert.deepEqual([by.a.cover, by.a.coverUrl], ["blog/a/cover.jpg", "https://t.com/blog/a/cover.jpg"]);
  assert.deepEqual([by.b.cover, by.b.coverUrl], ["img/b.png", "https://t.com/img/b.png"]);
  assert.deepEqual([by.c.cover, by.c.coverUrl], ["https://cdn.example.com/c.png", "https://cdn.example.com/c.png"]);
  assert.deepEqual([by.d.cover, by.d.coverUrl], [null, null]);
  assert.equal("folder" in by.a, false, "the folder on disk doesn't go to the template");
  assert.equal(by.a.file, "a/index.md");
});

test("href joins the root; external URLs stay the same", () => {
  const ctx = { root: "../../" };
  assert.equal(href(ctx, "blog/a/"), "../../blog/a/");
  assert.equal(href(ctx, "/img/x.png"), "../../img/x.png");
  assert.equal(href(ctx, "https://x.com/a"), "https://x.com/a");
  assert.equal(href(ctx, "mailto:a@b.c"), "mailto:a@b.c");
  assert.equal(href(ctx, "#top"), "#top");
  assert.equal(href(ctx, null), "");
  assert.equal(href({ root: "" }, "blog/"), "blog/");
});

test("markdown.html: false in the config escapes HTML in posts", async (t) => {
  const { dir, output, run } = await blog({ "a.md": post("A") + "<b>x</b>" }, "markdown: { html: false },");
  t.after(() => rm(dir, { recursive: true, force: true }));
  await run();
  assert.match(await readFile(join(output, "a", "index.html"), "utf8"), /&lt;b&gt;x&lt;\/b&gt;/);
});

test("cleanup: what stopped being generated goes; what belongs to others stays", async (t) => {
  const { dir, output, run } = await blog({
    "old.md": post("Old"),
    "with-photo/index.md": post("With photo"),
    "with-photo/photo.png": "png",
    "draft.md": post("Draft", "draft: true\n"),
  });
  t.after(() => rm(dir, { recursive: true, force: true }));

  // 1st build, with drafts (like dev mode).
  const r1 = await run({ includeDrafts: true });
  assert.deepEqual(r1.removed, []);
  assert.ok(await exists(join(output, "draft", "index.html")));
  await writeFile(join(output, "my-file.txt"), "not weblog-runner's");

  // Rename a post and remove the other's photo; 2nd build without drafts.
  await rename(join(dir, "posts", "old.md"), join(dir, "posts", "new.md"));
  await rm(join(dir, "posts", "with-photo", "photo.png"));
  const r2 = await run();

  assert.deepEqual(r2.removed.sort(), ["draft/index.html", "old/index.html", "with-photo/photo.png"]);
  assert.equal(await exists(join(output, "old")), false, "the empty folder goes too");
  assert.equal(await exists(join(output, "draft")), false);
  assert.ok(await exists(join(output, "new", "index.html")));
  assert.ok(await exists(join(output, "with-photo", "index.html")));
  assert.equal(await readFile(join(output, "my-file.txt"), "utf8"), "not weblog-runner's");

  const manifest = JSON.parse(await readFile(join(output, ".weblog-runner.json"), "utf8"));
  assert.ok(manifest.files.includes("new/index.html"));
  assert.equal(manifest.files.includes("old/index.html"), false);
});

test("cleanup never leaves the output folder, even with a tampered list", async (t) => {
  const { dir, output, run } = await blog({ "a.md": post("A") });
  t.after(() => rm(dir, { recursive: true, force: true }));
  await run();
  await writeFile(join(dir, "important.txt"), "stays");
  await writeFile(join(output, ".weblog-runner.json"), JSON.stringify({ files: ["../../important.txt", "../../weblog.config.js"] }));
  const r = await run();
  assert.deepEqual(r.removed, []);
  assert.equal(await readFile(join(dir, "important.txt"), "utf8"), "stays");
});

test("the site language applies to post dates", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "weblog-runner-lang-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, "posts"));
  await writeFile(join(dir, "posts", "a.md"), post("Olá"));
  await writeFile(
    join(dir, "weblog.config.js"),
    `export default {
  site: { title: "T", url: "https://t.com/", lang: "pt-BR" },
  input: "posts", output: "out", basePath: "",
  templates: { post: (p) => p.longDate + " | " + p.shortDate, list: () => "" },
};`,
  );
  await build(await loadConfig(join(dir, "weblog.config.js")));
  assert.equal(await readFile(join(dir, "out", "a", "index.html"), "utf8"), "20 de novembro de 2026 | 20 nov. 2026");
});

test("English is the default language", () => {
  const templates = { post: () => "", list: () => "" };
  const c = validateConfig({ site: { title: "T", url: "https://t.com/" }, input: "p", output: "o", templates }, ".");
  assert.equal(c.site.lang, "en");
});

test("an invalid language in the config", () => {
  const templates = { post: () => "", list: () => "" };
  assert.throws(
    () => validateConfig({ site: { title: "T", url: "https://t.com/", lang: "pt_BR" }, input: "p", output: "o", templates }, "."),
    /site\.lang: "pt_BR" is not a valid language tag/,
  );
});

test("site root inferred from output and basePath", () => {
  const templates = { post: () => "", list: () => "" };
  const base = { site: { title: "T", url: "https://t.com/" }, input: "posts", templates };
  const site = resolve("/site"); // C:\site on Windows, /site elsewhere
  const root = (output, basePath, extra = {}) => validateConfig({ ...base, output, basePath, ...extra }, site).siteDir;
  assert.equal(root("blog", "blog/"), site);
  assert.equal(root("public/blog", "blog/"), join(site, "public"));
  assert.equal(root("public/notes/blog", "notes/blog/"), join(site, "public"));
  assert.equal(root("public", ""), join(site, "public"));
  assert.equal(root("output", "blog/"), join(site, "output"), "doesn't match: uses the output itself");
  assert.equal(root("public/blog", "blog/", { root: "." }), site, "an explicit root wins");
});
