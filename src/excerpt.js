/*
 * Excerpt: the automatic description of a post without "description:" in
 * its frontmatter.
 *
 * Takes the FIRST <p> of the HTML, strips the tags, undoes the entities (the
 * result is plain text, like a description written by hand) and collapses
 * whitespace. If it's over the limit, cuts at the last space before it (or
 * right at the limit, if that falls exactly at the end of a word), drops
 * trailing punctuation and adds "…".
 *
 *   excerpt("<p>Tools that solve the problem and get out of the way.</p>", 20)
 *     → "Tools that solve the…"
 */

import { unescapeHtml } from "./escape.js";

/**
 * @param {string} html the post HTML.
 * @param {number} [limit=160] maximum length, not counting the "…".
 * @returns {string} plain text; "" if there's no paragraph.
 */
export function excerpt(html, limit = 160) {
  const paragraph = /<p>([\s\S]*?)<\/p>/.exec(String(html));
  if (!paragraph) return "";

  const text = unescapeHtml(paragraph[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;

  let cut = text.slice(0, limit);
  const splitsWord = text[limit] !== " ";
  if (splitsWord) {
    const space = cut.lastIndexOf(" ");
    if (space > 0) cut = cut.slice(0, space);
  }
  return cut.replace(/[\s,.;:!?—-]+$/, "") + "…";
}
