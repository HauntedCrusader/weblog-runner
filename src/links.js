/*
 * href(ctx, path): a link from a template page to anything on the site.
 *
 *   href(ctx, post.path)    → "../../blog/my-post/"    (path from the root + ctx.root)
 *   href(ctx, post.cover)   → "../../blog/my-post/cover.jpg"
 *   href(ctx, "https://x")  → "https://x"              (external URL: unchanged)
 *   href(ctx, null)         → ""
 */

/**
 * @param {{ root: string }} ctx
 * @param {string|null|undefined} path from the site root, or a full URL
 * @returns {string}
 */
export function href(ctx, path) {
  if (!path) return "";
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(path) || path.startsWith("#")) return path;
  return `${ctx.root}${path.replace(/^\//, "")}`;
}
