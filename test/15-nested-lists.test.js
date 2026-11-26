import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml } from "../src/markdown/blocks.js";

const md = (linhas) => linhas.join("\n");

test("list inside a list", () => {
  assert.equal(
    markdownToHtml(md(["- Lorem", "  - Dolor", "  - Sit", "- Amet"])),
    "<ul>\n<li>Lorem\n<ul>\n<li>Dolor</li>\n<li>Sit</li>\n</ul>\n</li>\n<li>Amet</li>\n</ul>",
  );
});

test("three levels, with 4-space indentation", () => {
  assert.equal(
    markdownToHtml(md(["- a", "    - b", "        - c", "    - d"])),
    "<ul>\n<li>a\n<ul>\n<li>b\n<ul>\n<li>c</li>\n</ul>\n</li>\n<li>d</li>\n</ul>\n</li>\n</ul>",
  );
});

test("numbered inside bullets and vice versa", () => {
  assert.equal(
    markdownToHtml(md(["1. First", "   - a detail", "2. Second"])),
    "<ol>\n<li>First\n<ul>\n<li>a detail</li>\n</ul>\n</li>\n<li>Second</li>\n</ol>",
  );
});

test("a tab in the indentation counts as 4 spaces", () => {
  assert.equal(markdownToHtml("- a\n\t- b"), "<ul>\n<li>a\n<ul>\n<li>b</li>\n</ul>\n</li>\n</ul>");
});

test("an indented line right below continues the item's text", () => {
  assert.equal(markdownToHtml(md(["- first line", "  continues here", "- another"])), "<ul>\n<li>first line\ncontinues here</li>\n<li>another</li>\n</ul>");
});

test("a code block inside an item", () => {
  assert.equal(
    markdownToHtml(md(["1. Run:", "", "   ```sh", "   npm test", "   ```", "2. Done."])),
    '<ol>\n<li>Run:\n<pre><code class="language-sh">npm test</code></pre>\n</li>\n<li>Done.</li>\n</ol>',
  );
});

test("blank lines between items don't break the list", () => {
  assert.equal(markdownToHtml(md(["- a", "", "- b"])), "<ul>\n<li>a</li>\n<li>b</li>\n</ul>");
});

test("an unindented paragraph after the list ends the list", () => {
  assert.equal(markdownToHtml(md(["- a", "  - b", "", "The end."])), "<ul>\n<li>a\n<ul>\n<li>b</li>\n</ul>\n</li>\n</ul>\n<p>The end.</p>");
});

test("a nested numbered list that starts at another number", () => {
  assert.equal(markdownToHtml(md(["- a", "  3. c", "  4. d"])), '<ul>\n<li>a\n<ol start="3">\n<li>c</li>\n<li>d</li>\n</ol>\n</li>\n</ul>');
});

test("inside a quote", () => {
  assert.equal(
    markdownToHtml(md(["> - a", ">   - b"])),
    "<blockquote>\n<ul>\n<li>a\n<ul>\n<li>b</li>\n</ul>\n</li>\n</ul>\n</blockquote>",
  );
});
