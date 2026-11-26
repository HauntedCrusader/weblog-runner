/*
 * Post checks: images, links and anchors that lead nowhere. (Only the pure
 * part; build.js is the one that looks at files.)
 *
 *   htmlReferences(html)            → the post's src="…" and href="…"
 *   htmlIds(html)                   → the id="…" (to check anchors)
 *   resolveReference(value, path)   → where it points, from the site root
 *
 * External URLs (https://, mailto:, tel:, data:…) aren't checked: that
 * would need the internet and slow the build down.
 */

import { unescapeHtml } from "./escape.js";

/**
 * @param {string} html
 * @returns {Array<{ attribute: "src"|"href", value: string }>}
 */
export function htmlReferences(html) {
  const refs = [];
  // Every opening tag (<img …>, <a …>); escaped text (&lt;img …&gt;, inside
  // code blocks) isn't a tag and stays out.
  for (const [tag] of String(html).matchAll(/<[a-zA-Z][^>]*>/g)) {
    for (const m of tag.matchAll(/\s(src|href)\s*=\s*"([^"]*)"/g)) {
      refs.push({ attribute: /** @type {"src"|"href"} */ (m[1]), value: unescapeHtml(m[2]) });
    }
  }
  return refs;
}

/**
 * @param {string} html
 * @returns {Set<string>}
 */
export function htmlIds(html) {
  return new Set([...String(html).matchAll(/\sid\s*=\s*"([^"]*)"/g)].map((m) => unescapeHtml(m[1])));
}

/**
 * Where a reference points.
 *
 *   ("photo.jpg", "blog/a/")        → { type: "local", path: "blog/a/photo.jpg" }
 *   ("../b/", "blog/a/")            → { type: "local", path: "blog/b/" }
 *   ("/img/x.png", "blog/a/")       → { type: "local", path: "img/x.png" }
 *   ("#section", "blog/a/")         → { type: "anchor", id: "section" }
 *   ("https://x.com", …)            → { type: "external" }
 *   ("../../../x", "blog/a/")       → { type: "outside" }  (goes above the root)
 *
 * A trailing "?…" or "#…" is ignored to find the file; %20 becomes a space.
 *
 * @param {string} value
 * @param {string} pagePath the page's folder, from the root ("blog/a/")
 * @returns {{ type: "external" } | { type: "anchor", id: string } | { type: "local", path: string } | { type: "outside" }}
 */
export function resolveReference(value, pagePath) {
  const v = String(value).trim();
  if (!v || /^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith("//")) return { type: "external" };
  if (v.startsWith("#")) return { type: "anchor", id: decode(v.slice(1)) };

  const base = v.split(/[?#]/)[0];
  if (!base) return { type: "external" }; // "?page=2": the page itself

  const parts = base.startsWith("/") ? [] : pagePath.split("/").filter(Boolean);
  const pieces = base.replace(/^\/+/, "").split("/");
  const isFolder = base.endsWith("/") || /(^|\/)\.\.?$/.test(base);
  for (const piece of pieces) {
    if (piece === "" || piece === ".") continue;
    if (piece === "..") {
      if (!parts.length) return { type: "outside" };
      parts.pop();
    } else {
      parts.push(decode(piece));
    }
  }
  const path = parts.join("/");
  return { type: "local", path: isFolder && path ? `${path}/` : path };
}

function decode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
