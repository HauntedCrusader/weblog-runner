import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/slug.js";

test("removes accents and punctuation, adds hyphens", () => {
  assert.equal(slugify("Hello, World!"), "hello-world");
  assert.equal(slugify("Ferramentas, não armadilhas!"), "ferramentas-nao-armadilhas");
});

test("ç becomes c and uppercase becomes lowercase", () => {
  assert.equal(slugify("Ação & Reação"), "acao-reacao");
});

test("no hyphen at the ends and never two in a row", () => {
  assert.equal(slugify("  --Hello,   world--  "), "hello-world");
});

test("digits stay", () => {
  assert.equal(slugify("Top 10 of 2026"), "top-10-of-2026");
});

test("punctuation only becomes empty", () => {
  assert.equal(slugify("!!!"), "");
});
