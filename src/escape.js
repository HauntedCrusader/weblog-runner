/*
 * HTML escaping: text that comes from outside (a title, a paragraph, a URL)
 * becomes safe inside HTML.
 *
 *   &  →  &amp;     <  →  &lt;     >  →  &gt;     "  →  &quot;     '  →  &#39;
 */

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

/**
 * The way back: the five entities above become characters again. "&amp;"
 * is undone last — otherwise "&amp;lt;" (the text "&lt;", written on
 * purpose) would become "<".
 * @param {string} text
 * @returns {string}
 */
export function unescapeHtml(text) {
  return String(text)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
