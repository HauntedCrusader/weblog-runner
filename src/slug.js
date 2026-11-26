/*
 * Slugify: the version of a text that can go in a URL.
 *
 *   "Hello, World!"      →  "hello-world"
 *   "Ação & Reação"      →  "acao-reacao"
 *
 * Used for each post's URL (posts/my-post.md → /blog/my-post/), heading ids
 * (## The name → <h2 id="the-name">) and tag pages.
 */

/**
 * @param {string} text
 * @returns {string} lowercase letters without accents, digits and hyphens;
 *   no hyphen at either end and never two in a row. May be "" (e.g. "!!!").
 */
export function slugify(text) {
  return String(text)
    // "ã" becomes "a" + a loose tilde (NFD form), and loose accents go away.
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Any run of non-letters/digits becomes a single hyphen.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
