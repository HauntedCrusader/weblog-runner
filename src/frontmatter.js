/*
 * Frontmatter: the header between two "---" lines at the top of a post.
 *
 *   ---
 *   title: Hello, world
 *   date: 2026-11-18
 *   tags: [Principles, Interfaces]
 *   draft: false
 *   ---
 *   The post text starts here.
 *
 * becomes { data: { title, date, tags: [...], draft: false },
 *           body: "The post text starts here." }
 *
 * It accepts a small piece of YAML:
 *   - "key: value" — the key runs up to the FIRST ":" ("time: 10:30" → "10:30");
 *   - "quoted" or 'quoted' → text, without the quotes and without conversion;
 *   - true / false → boolean; digits only → number; the date stays text;
 *   - [a, b] → list of strings; [] → [];
 *   - multi-line list: the key without a value and "- " items below it;
 *   - key without value and without items → "";
 *   - blank lines and "# comments" are ignored;
 *   - Windows line endings ("\r\n") work the same.
 *
 * Without "---" on the first line there is no frontmatter: data = {} and the
 * body is the whole text. Opened and never closed → error.
 */

/**
 * @param {string} text the whole .md file.
 * @returns {{ data: Record<string, string|number|boolean|string[]>, body: string }}
 */
export function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== "---") return { data: {}, body: text };

  const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  if (end === -1) throw new Error("frontmatter without the closing ---");

  const data = {};
  let listKey = null; // the last key without a value, which may receive "- " items
  for (const line of lines.slice(1, end)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;

    if (listKey && t.startsWith("- ")) {
      if (!Array.isArray(data[listKey])) data[listKey] = [];
      data[listKey].push(t.slice(2).trim());
      continue;
    }

    const colon = t.indexOf(":");
    if (colon === -1) continue;
    const key = t.slice(0, colon).trim();
    const value = t.slice(colon + 1).trim();
    data[key] = convert(value);
    listKey = value === "" ? key : null;
  }

  // The body keeps the original line endings: cut the text right after the
  // closing "---" line and drop the leading blank lines.
  const body = text.slice(lineStart(text, end + 1)).replace(/^(\r?\n)+/, "");
  return { data, body };
}

function convert(value) {
  if (value.length >= 2 && /^(["']).*\1$/.test(value)) return value.slice(1, -1);
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return Number(value);
  if (value.startsWith("[") && value.endsWith("]")) {
    const inside = value.slice(1, -1).trim();
    return inside ? inside.split(",").map((item) => item.trim()) : [];
  }
  return value;
}

/** Where, in the text, line number `n` (from 0) starts. */
function lineStart(text, n) {
  let position = 0;
  for (let i = 0; i < n; i++) {
    const newline = text.indexOf("\n", position);
    if (newline === -1) return text.length;
    position = newline + 1;
  }
  return position;
}
