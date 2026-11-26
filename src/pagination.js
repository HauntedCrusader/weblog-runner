/*
 * Pagination of the blog list: /blog/, /blog/page/2/, …
 *
 *   paginate(["a","b","c"], 2) → [
 *     { number: 1, total: 2, items: ["a","b"], previous: null, next: 2 },
 *     { number: 2, total: 2, items: ["c"],     previous: 1,    next: null },
 *   ]
 *
 * An empty list still gives one page (a blog without posts has its page).
 */

/**
 * @template T
 * @param {T[]} items
 * @param {number} perPage integer ≥ 1
 */
export function paginate(items, perPage) {
  if (!Number.isInteger(perPage) || perPage < 1) {
    throw new Error(`invalid perPage: ${String(perPage)} (use an integer from 1 up)`);
  }
  const total = Math.max(1, Math.ceil(items.length / perPage));
  return Array.from({ length: total }, (_, i) => ({
    number: i + 1,
    total,
    items: items.slice(i * perPage, (i + 1) * perPage),
    previous: i > 0 ? i : null,
    next: i + 1 < total ? i + 2 : null,
  }));
}

/**
 * Where each page lives: (1, "blog/") → "blog/"; (3, "blog/") → "blog/page/3/".
 * @param {number} number
 * @param {string} [base=""]
 */
export function pagePath(number, base = "") {
  return number === 1 ? base : `${base}page/${number}/`;
}
