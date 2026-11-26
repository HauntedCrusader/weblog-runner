import { test } from "node:test";
import assert from "node:assert/strict";
import { preparePosts } from "../src/posts.js";

const post = (slug, date, extra = {}) => ({ slug, title: slug.toUpperCase(), date, path: `blog/${slug}/`, ...extra });

test("newest first", () => {
  const r = preparePosts([post("a", "2026-01-10"), post("b", "2026-03-01"), post("c", "2025-12-31")]);
  assert.deepEqual(r.map((p) => p.slug), ["b", "a", "c"]);
});

test("same date: alphabetical by title", () => {
  const r = preparePosts([
    { slug: "z", title: "Zebra", date: "2026-01-01" },
    { slug: "a", title: "Ábaco", date: "2026-01-01" },
    { slug: "m", title: "maçã", date: "2026-01-01" },
  ]);
  assert.deepEqual(r.map((p) => p.title), ["Ábaco", "maçã", "Zebra"]);
});

test("drafts are left out…", () => {
  const r = preparePosts([post("a", "2026-01-10"), post("b", "2026-03-01", { draft: true })]);
  assert.deepEqual(r.map((p) => p.slug), ["a"]);
});

test("…unless asked to include them", () => {
  const r = preparePosts([post("a", "2026-01-10"), post("b", "2026-03-01", { draft: true })], { includeDrafts: true });
  assert.deepEqual(r.map((p) => p.slug), ["b", "a"]);
});

test("previous (older) and next (newer)", () => {
  const [newest, middle, oldest] = preparePosts([post("middle", "2026-02-01"), post("oldest", "2026-01-01"), post("newest", "2026-03-01")]);
  assert.equal(newest.next, null);
  assert.deepEqual(newest.previous, { slug: "middle", title: "MIDDLE", path: "blog/middle/" });
  assert.deepEqual(middle.next, { slug: "newest", title: "NEWEST", path: "blog/newest/" });
  assert.deepEqual(middle.previous, { slug: "oldest", title: "OLDEST", path: "blog/oldest/" });
  assert.equal(oldest.previous, null);
});

test("a single post: no neighbors", () => {
  const [only] = preparePosts([post("a", "2026-01-01")]);
  assert.equal(only.previous, null);
  assert.equal(only.next, null);
});

test("the post's fields are still there", () => {
  const [p] = preparePosts([post("a", "2026-01-01", { html: "<p>x</p>", tags: ["t"] })]);
  assert.equal(p.html, "<p>x</p>");
  assert.deepEqual(p.tags, ["t"]);
});

test("doesn't touch the objects it receives", () => {
  const input = [post("a", "2026-01-01"), post("b", "2026-02-01")];
  const copy = structuredClone(input);
  const r = preparePosts(input);
  assert.deepEqual(input, copy);
  assert.notEqual(r[1], input[0]);
});

test("a duplicate slug throws", () => {
  assert.throws(() => preparePosts([post("a", "2026-01-01"), post("a", "2026-02-01")]), /^Error: duplicate slug: a/);
});

test("empty list", () => {
  assert.deepEqual(preparePosts([]), []);
});
