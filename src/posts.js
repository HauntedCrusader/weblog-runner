/*
 * Gets the posts ready for the pages:
 *   1. drops drafts (unless includeDrafts);
 *   2. sorts newest first (same date: by title);
 *   3. refuses two posts with the same slug (one would overwrite the other);
 *   4. links each post to its neighbors: previous = the older one right
 *      below, next = the newer one right above — { slug, title, path } or null.
 * Returns copies; the objects it receives don't change.
 */

/**
 * @param {Array<{slug: string, title: string, date: string, draft?: boolean, path?: string}>} posts
 * @param {{ includeDrafts?: boolean }} [options]
 */
export function preparePosts(posts, options = {}) {
  const list = posts
    .filter((p) => options.includeDrafts || p.draft !== true)
    .map((p) => ({ ...p }));

  const seen = new Set();
  for (const p of list) {
    if (seen.has(p.slug)) throw new Error(`duplicate slug: ${p.slug}`);
    seen.add(p.slug);
  }

  list.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.title.localeCompare(b.title, "en");
  });

  const neighbor = (p) => (p ? { slug: p.slug, title: p.title, path: p.path } : null);
  list.forEach((p, i) => {
    p.next = neighbor(list[i - 1]);
    p.previous = neighbor(list[i + 1]);
  });
  return list;
}
