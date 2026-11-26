import { test } from "node:test";
import assert from "node:assert/strict";
import { excerpt } from "../src/excerpt.js";

test("a short paragraph comes back whole, without tags", () => {
  assert.equal(excerpt('<p>A <em>good</em> system and the <a href="/hds/">HDS</a>.</p>'), "A good system and the HDS.");
});

test("uses the first paragraph, even after a heading", () => {
  assert.equal(excerpt('<h2 id="a">Heading</h2>\n<p>First.</p>\n<p>Second.</p>'), "First.");
});

test("line breaks and repeated spaces become a single space", () => {
  assert.equal(excerpt("<p>line one\nline   two  </p>"), "line one line two");
});

test("cuts at the last space before the limit and adds an ellipsis", () => {
  assert.equal(excerpt("<p>Tools that solve the problem and get out of the way.</p>", 20), "Tools that solve the…");
});

test("drops leftover punctuation before the ellipsis", () => {
  assert.equal(excerpt("<p>Fast, simple, direct and honest.</p>", 13), "Fast, simple…");
  assert.equal(excerpt("<p>First this — then that.</p>", 12), "First this…");
});

test("the default limit is 160", () => {
  const text = "word ".repeat(64).trim(); // 319 characters
  const r = excerpt(`<p>${text}</p>`);
  assert.ok(r.endsWith("…"));
  assert.ok(r.length <= 161, `it got ${r.length}`);
  assert.equal(r, "word ".repeat(32).trim() + "…");
});

test("exactly at the limit doesn't cut", () => {
  assert.equal(excerpt("<p>12345 7890</p>", 10), "12345 7890");
});

test("entities become characters again (plain text)", () => {
  assert.equal(excerpt("<p>R &amp; D &lt;3 &quot;hi&quot; &#39;bye&#39;</p>"), `R & D <3 "hi" 'bye'`);
});

test("&amp; is undone last", () => {
  assert.equal(excerpt("<p>write &amp;lt; in HTML</p>"), "write &lt; in HTML");
});

test("without a paragraph, an empty excerpt", () => {
  assert.equal(excerpt('<h2 id="x">Just a heading</h2>'), "");
  assert.equal(excerpt(""), "");
});
