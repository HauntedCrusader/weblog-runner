import { test } from "node:test";
import assert from "node:assert/strict";
import { paginate, pagePath } from "../src/pagination.js";

test("splits into pages", () => {
  assert.deepEqual(paginate(["a", "b", "c"], 2), [
    { number: 1, total: 2, items: ["a", "b"], previous: null, next: 2 },
    { number: 2, total: 2, items: ["c"], previous: 1, next: null },
  ]);
});

test("exact fit", () => {
  const p = paginate([1, 2, 3, 4, 5, 6], 3);
  assert.equal(p.length, 2);
  assert.deepEqual(p.map((x) => x.items), [[1, 2, 3], [4, 5, 6]]);
});

test("everything fits on one page", () => {
  assert.deepEqual(paginate(["a"], 10), [{ number: 1, total: 1, items: ["a"], previous: null, next: null }]);
});

test("a middle page has previous and next", () => {
  const p = paginate([1, 2, 3, 4, 5], 2);
  assert.deepEqual({ ...p[1], items: undefined }, { number: 2, total: 3, items: undefined, previous: 1, next: 3 });
});

test("an empty list still has one page", () => {
  assert.deepEqual(paginate([], 10), [{ number: 1, total: 1, items: [], previous: null, next: null }]);
});

test("doesn't touch the list it receives", () => {
  const list = [1, 2, 3];
  paginate(list, 2);
  assert.deepEqual(list, [1, 2, 3]);
});

test("invalid perPage", () => {
  for (const bad of [0, -1, 1.5, NaN, "10"]) {
    assert.throws(() => paginate([1], bad), /^Error: invalid perPage/, `perPage = ${String(bad)}`);
  }
});

test("each page's path", () => {
  assert.equal(pagePath(1, "blog/"), "blog/");
  assert.equal(pagePath(2, "blog/"), "blog/page/2/");
  assert.equal(pagePath(12, "blog/"), "blog/page/12/");
  assert.equal(pagePath(1), "");
  assert.equal(pagePath(2), "page/2/");
});
