import { test } from "node:test";
import assert from "node:assert/strict";
import { inline } from "../src/markdown/inline.js";

const cases = (list) => {
  for (const [input, expected] of list) assert.equal(inline(input), expected, `inline(${JSON.stringify(input)})`);
};

test("plain text stays the same", () => {
  cases([["Just text, nothing else.", "Just text, nothing else."], ["", ""]]);
});

test("escapes what isn't a tag", () => {
  cases([["a < b & c > d", "a &lt; b &amp; c &gt; d"], ["I <3 this", "I &lt;3 this"]]);
});

test("with { html: false } even tags are escaped", () => {
  assert.equal(inline('<script>alert("x")</script>', { html: false }), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});

test("code", () => {
  cases([["run `npm test` in the terminal", "run <code>npm test</code> in the terminal"]]);
});

test("inside code: escaped only, no Markdown", () => {
  cases([["`<b>**x**</b>`", "<code>&lt;b&gt;**x**&lt;/b&gt;</code>"]]);
});

test("strong", () => {
  cases([["an **important** notice", "an <strong>important</strong> notice"]]);
});

test("emphasis with * and with _", () => {
  cases([["*this* and _that_", "<em>this</em> and <em>that</em>"]]);
});

test("accents inside emphasis", () => {
  cases([["_ênfase_ and *ação*", "<em>ênfase</em> and <em>ação</em>"]]);
});

test("nesting", () => {
  cases([
    ["**strong with *emphasis* inside**", "<strong>strong with <em>emphasis</em> inside</strong>"],
    ["*emphasis with **strong** inside*", "<em>emphasis with <strong>strong</strong> inside</em>"],
    ["**strong with `code`**", "<strong>strong with <code>code</code></strong>"],
  ]);
});

test("link", () => {
  cases([["see the [HDS](https://example.com/hds/)", 'see the <a href="https://example.com/hds/">HDS</a>']]);
});

test("the link URL is escaped too", () => {
  cases([["[search](/s?q=1&p=2)", '<a href="/s?q=1&amp;p=2">search</a>']]);
});

test("the link text may contain Markdown", () => {
  cases([["[**strong** and `code`](/a)", '<a href="/a"><strong>strong</strong> and <code>code</code></a>']]);
});

test("image", () => {
  cases([
    ["![A photo](img/photo.jpg)", '<img src="img/photo.jpg" alt="A photo">'],
    ['![said "so"](a.png)', '<img src="a.png" alt="said &quot;so&quot;">'],
  ]);
});

test("several on the same line", () => {
  cases([["*a* and *b*, **c** and [d](/d)", '<em>a</em> and <em>b</em>, <strong>c</strong> and <a href="/d">d</a>']]);
});

test("a marker without its pair stays as is", () => {
  cases([
    ["a ** b", "a ** b"],
    ["`no end", "`no end"],
    ["[just brackets]", "[just brackets]"],
    ["[text](unclosed", "[text](unclosed"],
    ["*no pair", "*no pair"],
  ]);
});

test("* with a space next to it isn't emphasis", () => {
  cases([["2 * 3 * 4 = 24", "2 * 3 * 4 = 24"]]);
});

test("_ inside a word isn't emphasis; * inside a word is", () => {
  cases([
    ["my_test_file.md", "my_test_file.md"],
    ["pre*fi*x", "pre<em>fi</em>x"],
  ]);
});

test("an empty marker doesn't become an empty tag", () => {
  cases([["****", "****"], ["``", "``"]]);
});

test("a backslash takes away the power of the next character", () => {
  cases([
    ["\\*not emphasis\\*", "*not emphasis*"],
    ["\\[not a link\\](/x)", "[not a link](/x)"],
    ["a \\\\ backslash", "a \\ backslash"],
    ["\\a stays the same", "\\a stays the same"],
  ]);
});
