import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter } from "../src/frontmatter.js";

test("splits data from body", () => {
  const md = "---\ntitle: Hello\ndate: 2026-11-18\n---\nThe text.";
  assert.deepEqual(parseFrontmatter(md), { data: { title: "Hello", date: "2026-11-18" }, body: "The text." });
});

test("leading blank lines of the body go away", () => {
  const md = "---\ntitle: Hello\n---\n\n\nFirst paragraph.\n\nSecond.\n";
  assert.equal(parseFrontmatter(md).body, "First paragraph.\n\nSecond.\n");
});

test("the value is whatever comes after the FIRST colon", () => {
  const { data } = parseFrontmatter("---\ntitle: Tools: a guide\ntime: 10:30\n---\n");
  assert.deepEqual(data, { title: "Tools: a guide", time: "10:30" });
});

test("surrounding whitespace goes away", () => {
  const { data } = parseFrontmatter("---\n  title   :   With spaces   \n---\n");
  assert.deepEqual(data, { title: "With spaces" });
});

test("booleans and numbers", () => {
  const { data } = parseFrontmatter("---\ndraft: true\nfeatured: false\norder: 42\n---\n");
  assert.deepEqual(data, { draft: true, featured: false, order: 42 });
});

test("quoted stays text, without the quotes", () => {
  const { data } = parseFrontmatter(`---\na: "true"\nb: '42'\nc: "With: a colon"\n---\n`);
  assert.deepEqual(data, { a: "true", b: "42", c: "With: a colon" });
});

test("bracket list", () => {
  const { data } = parseFrontmatter("---\ntags: [Principles, Interfaces,  HDS ]\nempty: []\n---\n");
  assert.deepEqual(data, { tags: ["Principles", "Interfaces", "HDS"], empty: [] });
});

test("multi-line list", () => {
  const md = "---\ntitle: X\ntags:\n  - Principles\n  - Interfaces\n- No indentation too\ndate: 2026-11-18\n---\n";
  assert.deepEqual(parseFrontmatter(md).data, {
    title: "X",
    tags: ["Principles", "Interfaces", "No indentation too"],
    date: "2026-11-18",
  });
});

test("key without a value and without items becomes empty text", () => {
  assert.deepEqual(parseFrontmatter("---\ncover:\ntitle: X\n---\n").data, { cover: "", title: "X" });
});

test("blank lines and comments are ignored", () => {
  const md = "---\n# a comment\ntitle: X\n\n# another\ndate: 2026-11-18\n---\n";
  assert.deepEqual(parseFrontmatter(md).data, { title: "X", date: "2026-11-18" });
});

test("Windows line endings (\\r\\n)", () => {
  const md = "---\r\ntitle: Hello\r\ntags:\r\n  - a\r\n  - b\r\n---\r\n\r\nText.\r\n";
  const r = parseFrontmatter(md);
  assert.deepEqual(r.data, { title: "Hello", tags: ["a", "b"] });
  assert.equal(r.body.replace(/\r/g, ""), "Text.\n");
});

test("without frontmatter: empty data and the whole text is the body", () => {
  assert.deepEqual(parseFrontmatter("# Just Markdown\n\nText."), { data: {}, body: "# Just Markdown\n\nText." });
});

test("a --- that isn't on the first line isn't frontmatter", () => {
  const md = "Text\n---\ntitle: X\n---\n";
  assert.deepEqual(parseFrontmatter(md), { data: {}, body: md });
});

test("frontmatter without the closing --- throws", () => {
  assert.throws(() => parseFrontmatter("---\ntitle: X\n\nText with no end."), /^Error: frontmatter without the closing ---/);
});

test("the body may contain --- (a rule) after the frontmatter", () => {
  const md = "---\ntitle: X\n---\nBefore\n\n---\n\nAfter";
  assert.deepEqual(parseFrontmatter(md), { data: { title: "X" }, body: "Before\n\n---\n\nAfter" });
});
