import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, unescapeHtml } from "../src/escape.js";

test("text without anything special stays the same", () => {
  assert.equal(escapeHtml("Hello, world"), "Hello, world");
});

test("replaces < and >", () => {
  assert.equal(escapeHtml("<div>"), "&lt;div&gt;");
});

test("replaces & without breaking the other replacements", () => {
  assert.equal(escapeHtml("Use <b> & <i>"), "Use &lt;b&gt; &amp; &lt;i&gt;");
});

test("replaces double and single quotes", () => {
  assert.equal(escapeHtml(`he said "hi" and 'bye'`), "he said &quot;hi&quot; and &#39;bye&#39;");
});

test("an entity already written gets escaped again (text is text)", () => {
  assert.equal(escapeHtml("&amp;"), "&amp;amp;");
});

test("empty text", () => {
  assert.equal(escapeHtml(""), "");
});

test("unescape is the way back", () => {
  const text = `Use <b> & "quotes" and 'apostrophe'`;
  assert.equal(unescapeHtml(escapeHtml(text)), text);
});

test("unescape undoes &amp; last", () => {
  assert.equal(unescapeHtml("&amp;lt;"), "&lt;");
});
