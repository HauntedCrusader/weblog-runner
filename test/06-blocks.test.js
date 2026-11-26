import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml } from "../src/markdown/blocks.js";

const md = (lines) => lines.join("\n");

test("empty document", () => {
  assert.equal(markdownToHtml(""), "");
  assert.equal(markdownToHtml("\n\n  \n"), "");
});

test("a paragraph", () => {
  assert.equal(markdownToHtml("Hello, *world*."), "<p>Hello, <em>world</em>.</p>");
});

test("consecutive lines are the same paragraph; a blank line separates", () => {
  assert.equal(
    markdownToHtml(md(["First line", "  second line  ", "", "", "Another paragraph"])),
    "<p>First line\nsecond line</p>\n<p>Another paragraph</p>",
  );
});

test("headings with ids", () => {
  assert.equal(
    markdownToHtml(md(["# Title", "## Why do we exist?", "###### Bottom"])),
    '<h1 id="title">Title</h1>\n<h2 id="why-do-we-exist">Why do we exist?</h2>\n<h6 id="bottom">Bottom</h6>',
  );
});

test("heading with Markdown inside: the id uses the text", () => {
  assert.equal(markdownToHtml("## The *name*"), '<h2 id="the-name">The <em>name</em></h2>');
});

test("a repeated id gets -2, -3", () => {
  assert.equal(
    markdownToHtml(md(["## Example", "## Example", "### Example"])),
    '<h2 id="example">Example</h2>\n<h2 id="example-2">Example</h2>\n<h3 id="example-3">Example</h3>',
  );
});

test("# without a space isn't a heading", () => {
  assert.equal(markdownToHtml("#tag"), "<p>#tag</p>");
});

test("list with -, * and +", () => {
  const expected = "<ul>\n<li>one</li>\n<li><strong>two</strong></li>\n</ul>";
  assert.equal(markdownToHtml(md(["- one", "- **two**"])), expected);
  assert.equal(markdownToHtml(md(["* one", "* **two**"])), expected);
  assert.equal(markdownToHtml(md(["+ one", "+ **two**"])), expected);
});

test("numbered list", () => {
  assert.equal(markdownToHtml(md(["1. one", "2. two"])), "<ol>\n<li>one</li>\n<li>two</li>\n</ol>");
  assert.equal(markdownToHtml(md(["1) one", "2) two"])), "<ol>\n<li>one</li>\n<li>two</li>\n</ol>");
});

test("numbered list that doesn't start at 1", () => {
  assert.equal(markdownToHtml(md(["3. three", "4. four"])), '<ol start="3">\n<li>three</li>\n<li>four</li>\n</ol>');
});

test("different list types in a row are different lists", () => {
  assert.equal(markdownToHtml(md(["- a", "1. b"])), "<ul>\n<li>a</li>\n</ul>\n<ol>\n<li>b</li>\n</ol>");
});

test("quote", () => {
  assert.equal(
    markdownToHtml(md(["> A good system", ">solves and lets you go."])),
    "<blockquote>\n<p>A good system\nsolves and lets you go.</p>\n</blockquote>",
  );
});

test("quote with blocks inside (recursion)", () => {
  assert.equal(
    markdownToHtml(md(["> ## Attention", ">", "> - one", "> - two"])),
    '<blockquote>\n<h2 id="attention">Attention</h2>\n<ul>\n<li>one</li>\n<li>two</li>\n</ul>\n</blockquote>',
  );
});

test("code block with a language", () => {
  assert.equal(
    markdownToHtml(md(["```js", "const a = 1 < 2;", "", "// **not** Markdown", "```"])),
    '<pre><code class="language-js">const a = 1 &lt; 2;\n\n// **not** Markdown</code></pre>',
  );
});

test("code block without a language, keeping indentation", () => {
  assert.equal(markdownToHtml(md(["```", "  indented", "```"])), "<pre><code>  indented</code></pre>");
});

test("an unclosed code block runs to the end", () => {
  assert.equal(markdownToHtml(md(["```", "a", "", "b"])), "<pre><code>a\n\nb</code></pre>");
});

test("horizontal rule", () => {
  assert.equal(markdownToHtml(md(["Before", "", "---", "", "***", "", "_____", "", "After"])), "<p>Before</p>\n<hr>\n<hr>\n<hr>\n<p>After</p>");
});

test("heading, list, quote, code and rule end the paragraph", () => {
  assert.equal(markdownToHtml(md(["text", "## Heading"])), '<p>text</p>\n<h2 id="heading">Heading</h2>');
  assert.equal(markdownToHtml(md(["text", "- item"])), "<p>text</p>\n<ul>\n<li>item</li>\n</ul>");
  assert.equal(markdownToHtml(md(["text", "> quote"])), "<p>text</p>\n<blockquote>\n<p>quote</p>\n</blockquote>");
  assert.equal(markdownToHtml(md(["text", "```", "x", "```"])), "<p>text</p>\n<pre><code>x</code></pre>");
  assert.equal(markdownToHtml(md(["text", "---"])), "<p>text</p>\n<hr>");
});

test("with { html: false } HTML written in the text shows as text", () => {
  assert.equal(markdownToHtml("<div>hi</div>", { html: false }), "<p>&lt;div&gt;hi&lt;/div&gt;</p>");
});

test("Windows line endings", () => {
  assert.equal(markdownToHtml("# Title\r\n\r\nText\r\n- a\r\n- b\r\n"), '<h1 id="title">Title</h1>\n<p>Text</p>\n<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
});

test("a whole post", () => {
  const post = md([
    "Lorem ipsum dolor sit amet, **consectetur** adipiscing elit.",
    "",
    "## Sed ut perspiciatis",
    "",
    "Ut enim ad minim *veniam*, quis nostrud.",
    "See the [HDS](https://example.com/hds/).",
    "",
    "> Duis aute irure dolor.",
    "",
    "1. Lorem",
    "2. Ipsum",
    "",
    "```html",
    '<a class="hds-btn">Button</a>',
    "```",
    "",
    "---",
    "",
    "![A photo](/img/photo.jpg)",
  ]);
  assert.equal(
    markdownToHtml(post),
    [
      "<p>Lorem ipsum dolor sit amet, <strong>consectetur</strong> adipiscing elit.</p>",
      '<h2 id="sed-ut-perspiciatis">Sed ut perspiciatis</h2>',
      '<p>Ut enim ad minim <em>veniam</em>, quis nostrud.\nSee the <a href="https://example.com/hds/">HDS</a>.</p>',
      "<blockquote>\n<p>Duis aute irure dolor.</p>\n</blockquote>",
      "<ol>\n<li>Lorem</li>\n<li>Ipsum</li>\n</ol>",
      '<pre><code class="language-html">&lt;a class=&quot;hds-btn&quot;&gt;Button&lt;/a&gt;</code></pre>',
      "<hr>",
      '<p><img src="/img/photo.jpg" alt="A photo"></p>',
    ].join("\n"),
  );
});
