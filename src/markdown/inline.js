/*
 * Inline Markdown: what happens INSIDE a paragraph, heading, list item or
 * table cell.
 *
 *   `code`            →  <code>code</code>   (escaped only, nothing else)
 *   **strong**        →  <strong>strong</strong>
 *   *emphasis* _emph_ →  <em>emphasis</em>
 *   [text](url)       →  <a href="url">text</a>
 *   ![alt](image)     →  <img src="image" alt="alt">
 *   \*                →  *   (works for \ ` * _ [ ] ( ) ! # |)
 *   <kbd>Ctrl</kbd>   →  passes through as is (inline HTML; see options)
 *
 * Everything else is escaped. They nest (**strong with *emphasis* inside**).
 * Left as is: a marker without its pair ("a ** b"), * or _ with a space on
 * the inner side ("2 * 3 * 4"), _ inside a word ("my_file_name") and empty
 * markers ("****"). A "<" that doesn't open a tag ("a < b", "<3") is text.
 *
 * Options: { html: false } escapes tags too (for text from people you don't
 * trust). The default is { html: true }.
 *
 * How it works: reads left to right; on a marker it looks for its pair
 * further ahead, and the piece in between goes through inline() again.
 */

import { escapeHtml } from "../escape.js";

const ESCAPABLE = "\\`*_[]()!#|";
// A complete HTML tag (<a href="x">, </a>, <br/>) or a comment.
const TAG = /^(?:<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>|<!--[\s\S]*?-->)/;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * @param {string} text
 * @param {{ html?: boolean }} [options]
 * @returns {string} HTML
 */
export function inline(text, options = {}) {
  const allowHtml = options.html !== false;
  const s = String(text);
  let html = "";
  let i = 0;

  while (i < s.length) {
    const c = s[i];

    // \* → a literal *
    if (c === "\\" && ESCAPABLE.includes(s[i + 1] ?? "")) {
      html += escapeHtml(s[i + 1]);
      i += 2;
      continue;
    }

    // `code`
    if (c === "`") {
      const end = s.indexOf("`", i + 1);
      if (end > i + 1) {
        html += `<code>${escapeHtml(s.slice(i + 1, end))}</code>`;
        i = end + 1;
        continue;
      }
    }

    // inline <tag>
    if (c === "<" && allowHtml) {
      const tag = TAG.exec(s.slice(i));
      if (tag) {
        html += tag[0];
        i += tag[0].length;
        continue;
      }
    }

    // ![alt](image)
    if (c === "!" && s[i + 1] === "[") {
      const link = readLink(s, i + 1);
      if (link) {
        html += `<img src="${escapeHtml(link.url)}" alt="${escapeHtml(link.text)}">`;
        i = link.after;
        continue;
      }
    }

    // [text](url)
    if (c === "[") {
      const link = readLink(s, i);
      if (link) {
        html += `<a href="${escapeHtml(link.url)}">${inline(link.text, options)}</a>`;
        i = link.after;
        continue;
      }
    }

    // **strong**
    if (s.startsWith("**", i) && opens(s, i + 2)) {
      const end = closing(s, "**", i + 3);
      if (end !== -1) {
        html += `<strong>${inline(s.slice(i + 2, end), options)}</strong>`;
        i = end + 2;
        continue;
      }
    }

    // *emphasis* or _emphasis_
    if ((c === "*" || c === "_") && s[i + 1] !== c && opens(s, i + 1) && !(c === "_" && LETTER_OR_DIGIT.test(s[i - 1] ?? ""))) {
      const end = closing(s, c, i + 2);
      if (end !== -1) {
        html += `<em>${inline(s.slice(i + 1, end), options)}</em>`;
        i = end + 1;
        continue;
      }
    }

    html += escapeHtml(c);
    i++;
  }
  return html;
}

/** Emphasis content can't start with a space (nor be empty). */
function opens(s, start) {
  return start < s.length && s[start] !== " ";
}

/**
 * Where the closing marker is, from `from` on; -1 if there's none. Skips
 * escaped characters and `code`, and never closes right after a space.
 */
function closing(s, marker, from) {
  for (let j = from; j < s.length; j++) {
    if (s[j] === "\\") { j++; continue; }
    if (s[j] === "`") {
      const end = s.indexOf("`", j + 1);
      if (end > j + 1) { j = end; continue; }
    }
    // Looking for a single *: a ** along the way belongs to another marker.
    if (marker.length === 1 && s[j] === marker && s[j + 1] === marker) { j++; continue; }
    if (!s.startsWith(marker, j) || s[j - 1] === " ") continue;
    if (marker === "_" && LETTER_OR_DIGIT.test(s[j + 1] ?? "")) continue;
    return j;
  }
  return -1;
}

/** Reads "[text](url)" from the "[" at `start`; null if it isn't a link. */
function readLink(s, start) {
  const middle = s.indexOf("](", start + 1);
  if (middle === -1) return null;
  const end = s.indexOf(")", middle + 2);
  if (end === -1) return null;
  return { text: s.slice(start + 1, middle), url: s.slice(middle + 2, end), after: end + 1 };
}
