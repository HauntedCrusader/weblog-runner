import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByTag } from "../src/tags.js";

test("groups each tag's posts, alphabetically", () => {
  const a = { slug: "a", tags: ["Principles", "HDS"] };
  const b = { slug: "b", tags: ["Automation"] };
  const c = { slug: "c", tags: ["HDS"] };
  assert.deepEqual(groupByTag([a, b, c]), [
    { tag: "Automation", slug: "automation", posts: [b] },
    { tag: "HDS", slug: "hds", posts: [a, c] },
    { tag: "Principles", slug: "principles", posts: [a] },
  ]);
});

test("the same tag written differently; the first name wins", () => {
  const a = { slug: "a", tags: ["Princípios"] };
  const b = { slug: "b", tags: ["principios"] };
  const c = { slug: "c", tags: ["PRINCÍPIOS"] };
  assert.deepEqual(groupByTag([a, b, c]), [{ tag: "Princípios", slug: "principios", posts: [a, b, c] }]);
});

test("a post with the same tag twice shows up once", () => {
  const a = { slug: "a", tags: ["HDS", "hds"] };
  assert.deepEqual(groupByTag([a]), [{ tag: "HDS", slug: "hds", posts: [a] }]);
});

test("posts without tags and tags with an empty slug are ignored", () => {
  const a = { slug: "a" };
  const b = { slug: "b", tags: [] };
  const c = { slug: "c", tags: ["!!!", "Real"] };
  assert.deepEqual(groupByTag([a, b, c]), [{ tag: "Real", slug: "real", posts: [c] }]);
});

test("alphabetical order ignoring accents and case", () => {
  const p = { slug: "p", tags: ["ética", "Zebra", "abacaxi", "Éden"] };
  assert.deepEqual(groupByTag([p]).map((g) => g.tag), ["abacaxi", "Éden", "ética", "Zebra"]);
});

test("no posts", () => {
  assert.deepEqual(groupByTag([]), []);
});
