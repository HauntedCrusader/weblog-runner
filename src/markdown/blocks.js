/*
 * Block Markdown: the whole document, one block per line in the HTML.
 *
 *   # Heading … ######  →  <h1 id="heading">…</h1>  (id = slug; repeated → -2, -3)
 *   consecutive lines   →  <p>line 1\nline 2</p>
 *   - item / * / +      →  <ul>          ┐ one item per marker; indented lines
 *   1. item / 1) item   →  <ol>          ┘ below it belong to it: nested lists,
 *                                          code, paragraphs
 *   > quote             →  <blockquote>, with a whole document inside
 *   ```js … ```         →  <pre><code class="language-js">  (no Markdown inside)
 *   --- / *** / ___     →  <hr>
 *   | a | b |           →  <table>  (2nd line |---|:--:|--:| sets the alignment)
 *   <div> … </div>      →  passes through as is (HTML; see below)
 *
 * HTML IN THE TEXT (on by default; { html: false } turns it off and
 * everything becomes escaped text):
 *   - A line that starts with a block tag (<div>, <figure>, <details>,
 *     <iframe>, <video>, <table>, <section>, …) opens an HTML block that
 *     runs until the next blank line, with no Markdown inside. After the
 *     blank line Markdown is back: <details> + blank line + Markdown text +
 *     blank line + </details> works.
 *   - <pre>, <script>, <style> and <textarea> run until their closing tag,
 *     even across blank lines. <!-- comments --> run until "-->".
 *   - A line holding a single tag of any kind (<span class="x">) also opens
 *     an HTML block (but doesn't interrupt a paragraph).
 *   - Tags in the middle of a sentence (<kbd>, <abbr>, <br>) go through
 *     inline().
 *
 * Blank lines separate blocks; a heading, list, quote, code fence, rule,
 * table or HTML block also ends a paragraph.
 */

import { inline } from "./inline.js";
import { slugify } from "../slug.js";
import { escapeHtml } from "../escape.js";

const HEADING = /^(#{1,6})\s+(.*)$/;
const ITEM = /^([-*+])\s+(.*)$/;
const NUMBERED_ITEM = /^(\d+)([.)])\s+(.*)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;
const FENCE = "```";
const TABLE_DELIMITER = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;

// HTML: the ones that run until their closing tag, block tags, and "a tag alone".
const HTML_UNTIL_CLOSED = /^<(script|pre|style|textarea)(?:\s|>|$)/i;
const BLOCK_TAGS = new Set(("address article aside audio blockquote body canvas caption center col colgroup dd details dialog " +
  "dir div dl dt embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html iframe legend li " +
  "link main menu nav noscript object ol optgroup option p picture search section source summary svg table tbody td tfoot th " +
  "thead title tr track ul video").split(" "));
const BLOCK_TAG = /^<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s|\/?>|$)/;
const LONE_TAG = /^(?:<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>|<\/[A-Za-z][A-Za-z0-9-]*\s*>)$/;

/**
 * @param {string} md
 * @param {{ html?: boolean }} [options] html: false escapes HTML written in the text.
 * @returns {string} HTML, one block per line.
 */
export function markdownToHtml(md, options = {}) {
  const lines = String(md).split(/\r?\n/).map(tabsToSpaces);
  return convert(lines, { ids: new Map(), html: options.html !== false });
}

/**
 * @param {string[]} lines
 * @param {{ ids: Map<string, number>, html: boolean }} state ids counts the
 *   ids already used in the document (quotes and lists share it).
 */
function convert(lines, state) {
  const blocks = [];
  const inlineHtml = (text) => inline(text, { html: state.html });
  let i = 0;

  while (i < lines.length) {
    const t = lines[i].trim();
    let m;

    if (!t) {
      i++;
    } else if (t.startsWith(FENCE)) {
      const language = t.slice(FENCE.length).trim();
      const indent = indentOf(lines[i]);
      const code = [];
      i++;
      while (i < lines.length && lines[i].trim() !== FENCE) code.push(dedent(lines[i++], indent));
      i++; // the closing fence (or the end of the document)
      const cls = language ? ` class="language-${escapeHtml(language)}"` : "";
      blocks.push(`<pre><code${cls}>${escapeHtml(code.join("\n"))}</code></pre>`);
    } else if (state.html && htmlKind(t, false)) {
      const { html, next } = readHtml(lines, i, htmlKind(t, false));
      blocks.push(html);
      i = next;
    } else if ((m = HEADING.exec(t))) {
      const level = m[1].length;
      const text = m[2].trim();
      blocks.push(`<h${level} id="${newId(text, state.ids)}">${inlineHtml(text)}</h${level}>`);
      i++;
    } else if (RULE.test(t)) {
      blocks.push("<hr>");
      i++;
    } else if (t.startsWith(">")) {
      const inside = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        inside.push(lines[i++].trim().replace(/^> ?/, ""));
      }
      blocks.push(`<blockquote>\n${convert(inside, state)}\n</blockquote>`);
    } else if (listMarker(t)) {
      const { html, next } = readList(lines, i, state);
      blocks.push(html);
      i = next;
    } else if (startsTable(lines, i)) {
      const { html, next } = readTable(lines, i, inlineHtml);
      blocks.push(html);
      i = next;
    } else {
      const paragraph = [t];
      i++;
      while (i < lines.length && lines[i].trim() && !interruptsParagraph(lines, i, state)) {
        paragraph.push(lines[i++].trim());
      }
      blocks.push(`<p>${inlineHtml(paragraph.join("\n"))}</p>`);
    }
  }
  return blocks.join("\n");
}

/* -------------------------------------------------------------- lists -- */

/** { type: "ul"|"ol", start, text } for the marker at the start of `t`, or null. */
function listMarker(t) {
  let m = ITEM.exec(t);
  if (m) return { type: "ul", start: 1, text: m[2] };
  m = NUMBERED_ITEM.exec(t);
  if (m) return { type: "ol", start: Number(m[1]), text: m[3] };
  return null;
}

/**
 * A whole list from line `i` on. An item is the marker line plus every
 * line below it with more indentation (even after blank lines). Sibling
 * items share the indentation (up to 1 extra space).
 */
function readList(lines, i, state) {
  const indent = indentOf(lines[i]);
  const first = listMarker(lines[i].trim());
  const sameType = (m) => m && m.type === first.type;
  const items = [];
  let current = null;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      // Blank line: the list goes on if the next line with text belongs to
      // the item (more indentation) or is a sibling.
      let k = i;
      while (k < lines.length && !lines[k].trim()) k++;
      if (k === lines.length) break;
      const r = indentOf(lines[k]);
      const goesOn = r > indent + 1 || (r >= indent && sameType(listMarker(lines[k].trim())));
      if (!goesOn) break;
      if (current) current.rest.push(...lines.slice(i, k).map(() => ""));
      i = k;
      continue;
    }
    const r = indentOf(line);
    const m = listMarker(line.trim());
    if (r <= indent + 1 && sameType(m)) {
      current = { text: [m.text], rest: [] };
      items.push(current);
    } else if (r > indent + 1 && current) {
      current.rest.push(line);
    } else if (r > indent && current && !m) {
      current.rest.push(line);
    } else {
      break;
    }
    i++;
  }

  const lis = items.map((item) => {
    // Text lines right below the marker continue the item's text.
    while (item.rest.length && item.rest[0].trim() && !startsBlockInItem(item.rest, 0, state)) {
      item.text.push(item.rest.shift().trim());
    }
    while (item.rest.length && !item.rest[item.rest.length - 1].trim()) item.rest.pop();
    const text = inline(item.text.join("\n"), { html: state.html });
    if (!item.rest.length) return `<li>${text}</li>`;
    const least = Math.min(...item.rest.filter((l) => l.trim()).map(indentOf));
    const inside = convert(item.rest.map((l) => dedent(l, least)), state);
    return `<li>${text}\n${inside}\n</li>`;
  });

  const start = first.type === "ol" && first.start !== 1 ? ` start="${first.start}"` : "";
  return { html: `<${first.type}${start}>\n${lis.join("\n")}\n</${first.type}>`, next: i };
}

function startsBlockInItem(lines, i, state) {
  return interruptsParagraph(lines, i, state) || Boolean(listMarker(lines[i].trim()));
}

/* ------------------------------------------------------------- tables -- */

function startsTable(lines, i) {
  if (i + 1 >= lines.length) return false;
  const head = lines[i].trim();
  const delimiter = lines[i + 1].trim();
  if (!head.includes("|") || !delimiter.includes("-") || !TABLE_DELIMITER.test(delimiter)) return false;
  return cells(head).length === cells(delimiter).length;
}

function readTable(lines, i, inlineHtml) {
  const head = cells(lines[i].trim());
  const alignments = cells(lines[i + 1].trim()).map((c) => {
    const left = c.startsWith(":");
    const right = c.endsWith(":");
    if (left && right) return ' class="align-center"';
    if (right) return ' class="align-right"';
    if (left) return ' class="align-left"';
    return "";
  });
  i += 2;

  const row = (values, tag) => {
    const tds = alignments.map((cls, n) => `<${tag}${cls}>${inlineHtml(values[n] ?? "")}</${tag}>`);
    return `<tr>${tds.join("")}</tr>`;
  };

  const body = [];
  while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
    body.push(row(cells(lines[i].trim()), "td"));
    i++;
  }

  const parts = ["<table>", "<thead>", row(head, "th"), "</thead>"];
  if (body.length) parts.push("<tbody>", ...body, "</tbody>");
  parts.push("</table>");
  return { html: parts.join("\n"), next: i };
}

/** "| a | b \| c |" → ["a", "b | c"]. The outer pipes are optional. */
function cells(line) {
  let s = line;
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const result = [];
  let current = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      current += "|";
      i++;
    } else if (s[i] === "|") {
      result.push(current.trim());
      current = "";
    } else {
      current += s[i];
    }
  }
  result.push(current.trim());
  return result;
}

/* --------------------------------------------------------------- HTML -- */

/**
 * Which kind of HTML block line `t` opens: "closed" (<pre>, <script>…),
 * "comment", "block" (block tag), "lone" (any single tag alone on the line)
 * or null. `inParagraph`: "lone" doesn't interrupt a paragraph.
 */
function htmlKind(t, inParagraph) {
  if (HTML_UNTIL_CLOSED.test(t)) return "closed";
  if (t.startsWith("<!--")) return "comment";
  const m = BLOCK_TAG.exec(t);
  if (m && BLOCK_TAGS.has(m[1].toLowerCase())) return "block";
  if (!inParagraph && LONE_TAG.test(t)) return "lone";
  return null;
}

function readHtml(lines, i, kind) {
  const out = [];
  if (kind === "closed") {
    const name = HTML_UNTIL_CLOSED.exec(lines[i].trim())[1].toLowerCase();
    const closes = new RegExp(`</${name}>`, "i");
    while (i < lines.length) {
      out.push(lines[i]);
      if (closes.test(lines[i++])) break;
    }
  } else if (kind === "comment") {
    while (i < lines.length) {
      out.push(lines[i]);
      if (lines[i++].includes("-->")) break;
    }
  } else {
    while (i < lines.length && lines[i].trim()) out.push(lines[i++]);
  }
  return { html: out.join("\n"), next: i };
}

/* ------------------------------------------------------------- shared -- */

function interruptsParagraph(lines, i, state) {
  const t = lines[i].trim();
  return t.startsWith(FENCE) || HEADING.test(t) || RULE.test(t) || t.startsWith(">") ||
    Boolean(listMarker(t)) || startsTable(lines, i) || (state.html && Boolean(htmlKind(t, true)));
}

function newId(text, ids) {
  const base = slugify(text);
  const times = (ids.get(base) ?? 0) + 1;
  ids.set(base, times);
  return times === 1 ? base : `${base}-${times}`;
}

function indentOf(line) {
  return line.length - line.trimStart().length;
}

function dedent(line, amount) {
  return line.slice(Math.min(amount, indentOf(line)));
}

/** A tab in the indentation counts as 4 spaces (the rest of the line is kept). */
function tabsToSpaces(line) {
  return line.replace(/^[ \t]+/, (indent) => indent.replace(/\t/g, "    "));
}
