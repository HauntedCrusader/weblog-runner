/*
 * Tags: one page per topic.
 *
 *   groupByTag(posts) → [{ tag: "Principles", slug: "principles", posts: [...] }, …]
 *
 * "Principles" and "principles" are the same tag (compared by slug); the
 * name used is the first one seen. Posts keep the order received, without
 * repeats; tags with an empty slug are ignored; tags are sorted
 * alphabetically, ignoring accents and case.
 */

import { slugify } from "./slug.js";

/**
 * @param {Array<{tags?: string[]}>} posts
 * @returns {Array<{tag: string, slug: string, posts: object[]}>}
 */
export function groupByTag(posts) {
  const groups = new Map();
  for (const post of posts) {
    for (const tag of post.tags ?? []) {
      const key = slugify(tag);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, { tag, slug: key, posts: [] });
      const group = groups.get(key);
      if (!group.posts.includes(post)) group.posts.push(post);
    }
  }
  return [...groups.values()].sort((a, b) => a.tag.localeCompare(b.tag, "en", { sensitivity: "base" }));
}
