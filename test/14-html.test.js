import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml } from "../src/markdown/blocks.js";
import { inline } from "../src/markdown/inline.js";

const md = (linhas) => linhas.join("\n");

test("tags in the middle of a sentence pass through", () => {
  assert.equal(inline("Press <kbd>Ctrl</kbd> + <kbd>C</kbd>"), "Press <kbd>Ctrl</kbd> + <kbd>C</kbd>");
  assert.equal(inline('<abbr title="Design System">DS</abbr> and **strong**'), '<abbr title="Design System">DS</abbr> and <strong>strong</strong>');
  assert.equal(inline("line<br>break"), "line<br>break");
});

test("a paragraph that starts with an inline tag is still a paragraph", () => {
  assert.equal(markdownToHtml("<kbd>Ctrl</kbd> + C copies."), "<p><kbd>Ctrl</kbd> + C copies.</p>");
});

test("an HTML block runs until the blank line, with no Markdown inside", () => {
  assert.equal(
    markdownToHtml(md(["<figure>", '  <img src="a.png" alt="">', "  <figcaption>A *caption*</figcaption>", "</figure>", "", "After *here*."])),
    '<figure>\n  <img src="a.png" alt="">\n  <figcaption>A *caption*</figcaption>\n</figure>\n<p>After <em>here</em>.</p>',
  );
});

test("<details> with Markdown inside (separated by blank lines)", () => {
  assert.equal(
    markdownToHtml(md(["<details>", "<summary>See more</summary>", "", "Text **in Markdown**.", "", "</details>"])),
    "<details>\n<summary>See more</summary>\n<p>Text <strong>in Markdown</strong>.</p>\n</details>",
  );
});

test("<pre> and <script> run until their closing tag, even across blank lines", () => {
  assert.equal(markdownToHtml(md(["<pre>", "a", "", "  b", "</pre>", "end"])), "<pre>\na\n\n  b\n</pre>\n<p>end</p>");
});

test("multi-line comment", () => {
  assert.equal(markdownToHtml(md(["<!-- note", "", "to self -->", "Text"])), "<!-- note\n\nto self -->\n<p>Text</p>");
});

test("iframe and video are blocks", () => {
  assert.equal(
    markdownToHtml('<iframe src="https://example.com/v" title="Video"></iframe>'),
    '<iframe src="https://example.com/v" title="Video"></iframe>',
  );
});

test("a block tag interrupts a paragraph", () => {
  assert.equal(markdownToHtml(md(["Text", "<div>box</div>"])), "<p>Text</p>\n<div>box</div>");
});

test("any single tag alone on a line opens a block, but doesn't interrupt a paragraph", () => {
  assert.equal(markdownToHtml(md(['<span class="badge">', "new", "</span>"])), '<span class="badge">\nnew\n</span>');
  assert.equal(markdownToHtml(md(["Text", '<span class="x">'])), '<p>Text\n<span class="x"></p>');
});

test("HTML inside a quote", () => {
  assert.equal(markdownToHtml(md(["> <cite>Someone</cite>", ">", "> <div>x</div>"])), "<blockquote>\n<p><cite>Someone</cite></p>\n<div>x</div>\n</blockquote>");
});

test("{ html: false } turns it all off", () => {
  assert.equal(markdownToHtml(md(["<div>", "a", "</div>"]), { html: false }), "<p>&lt;div&gt;\na\n&lt;/div&gt;</p>");
  assert.equal(markdownToHtml("<kbd>x</kbd>", { html: false }), "<p>&lt;kbd&gt;x&lt;/kbd&gt;</p>");
});

test("inside code, HTML stays escaped", () => {
  assert.equal(markdownToHtml(md(["```html", "<div>", "```"])), '<pre><code class="language-html">&lt;div&gt;</code></pre>');
  assert.equal(inline("`<div>`"), "<code>&lt;div&gt;</code>");
});
