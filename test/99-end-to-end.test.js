// End to end: builds the example blog (example/) into a temp folder and
// checks the result.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../src/config.js";
import { build } from "../src/build.js";

const configFile = fileURLToPath(new URL("../example/weblog.config.js", import.meta.url));

async function generate(options) {
  // A whole temporary site: the blog goes to <dir>/blog/, and the warnings
  // check looks for files there too (not in the example's real output).
  const dir = await mkdtemp(join(tmpdir(), "weblog-runner-"));
  const config = { ...(await loadConfig(configFile)), outputDir: join(dir, "blog"), siteDir: dir };
  const report = await build(config, options);
  const read = (file) => readFile(join(dir, "blog", file), "utf8");
  const exists = (file) => access(join(dir, "blog", file)).then(() => true, () => false);
  return { dir, report, read, exists };
}

test("builds the whole example blog", async (t) => {
  const { dir, report, read, exists } = await generate();
  t.after(() => rm(dir, { recursive: true, force: true }));

  assert.equal(report.posts, 3, "3 posts");
  assert.equal(report.pages, 2, "2 per page → 2 list pages");
  assert.equal(report.tags, 3, "Ipsum, Lorem and Markdown (lorem is the same as Lorem)");

  for (const file of [
    "index.html",
    "page/2/index.html",
    "markdown-showcase/index.html",
    "markdown-showcase/placeholder.svg",
    "example-post-1/index.html",
    "example-post-2/index.html",
    "tag/ipsum/index.html",
    "tag/lorem/index.html",
    "tag/markdown/index.html",
    "feed.xml",
    "sitemap.xml",
  ]) {
    assert.ok(await exists(file), `should exist: ${file}`);
  }

  const showcase = await read("markdown-showcase/index.html");
  assert.match(showcase, /<h2 id="lists">Lists<\/h2>/);
  assert.match(showcase, /<a href="#tables">jump to Tables<\/a>/, "a link to a heading's id");
  assert.match(showcase, /<time datetime="2026-11-01">November 1, 2026<\/time>/);
  assert.match(showcase, /<pre><code class="language-js">export function greet\(name\) \{/);
  assert.match(showcase, /escapes a character: \*this is not italic\*/);
  assert.match(showcase, /<blockquote>\n<p>A blockquote can hold any other block\.<\/p>\n<ul>\n<li>Including lists<\/li>\n<\/ul>\n<\/blockquote>/);
  assert.match(showcase, /<p><img src="placeholder.svg" alt="A placeholder image"><\/p>/, "the folder's image, with a relative path");
  assert.match(showcase, /<li>Another item\n<ul>\n<li>A nested item<\/li>/, "list inside a list");
  assert.match(showcase, /<th class="align-right">Right aligned<\/th>/, "table");
  assert.match(showcase, /<kbd>Ctrl<\/kbd>/, "inline HTML");
  assert.match(showcase, /<details>\n<summary>[^<]+<\/summary>\n<p>After a blank line, the content inside the HTML block is <strong>Markdown<\/strong> again\.<\/p>\n<\/details>/, "HTML block with Markdown inside");
  assert.match(showcase, /<meta property="og:image" content="https:\/\/example.com\/blog\/markdown-showcase\/placeholder.svg">/, "a relative cover becomes a full URL");

  const own = await read("example-post-1/index.html");
  assert.match(own, /<title>Example post 1 — Example Blog<\/title>/);
  assert.match(own, /content="Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur\."/, "the frontmatter description");

  const auto = await read("example-post-2/index.html");
  assert.match(auto, /content="Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis…"/, "the automatic excerpt, cut at 160");
  assert.match(auto, /← <a href="..\/..\/blog\/example-post-1\/">Example post 1<\/a>/);

  const list1 = await read("index.html");
  assert.match(list1, /href="..\/blog\/example-post-2\/"/);
  assert.match(list1, /href="..\/blog\/page\/2\/">Older →/);
  const list2 = await read("page/2/index.html");
  assert.match(list2, /href="..\/..\/..\/blog\/markdown-showcase\/"/);
  assert.match(list2, /<img src="..\/..\/..\/blog\/markdown-showcase\/placeholder.svg"/, "the cover on the list card");

  const feed = await read("feed.xml");
  assert.match(feed, /<atom:link href="https:\/\/example.com\/blog\/feed.xml"/);
  assert.equal(feed.match(/<item>/g).length, 3);

  const map = await read("sitemap.xml");
  assert.match(map, /<url><loc>https:\/\/example.com\/blog\/markdown-showcase\/<\/loc><lastmod>2026-11-01<\/lastmod><\/url>/);
  assert.match(map, /<url><loc>https:\/\/example.com\/blog\/<\/loc><lastmod>2026-11-18<\/lastmod><\/url>/);

  assert.deepEqual(report.warnings, [], "the example has no broken image or link");
});
