import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml } from "../src/markdown/blocks.js";

const md = (linhas) => linhas.join("\n");

test("simple table", () => {
  assert.equal(
    markdownToHtml(md(["| Item | Status |", "|---|---|", "| Lorem | Active |", "| Ipsum | Done |"])),
    [
      "<table>",
      "<thead>",
      "<tr><th>Item</th><th>Status</th></tr>",
      "</thead>",
      "<tbody>",
      "<tr><td>Lorem</td><td>Active</td></tr>",
      "<tr><td>Ipsum</td><td>Done</td></tr>",
      "</tbody>",
      "</table>",
    ].join("\n"),
  );
});

test("alignment becomes a class (no style, so it works with a CSP)", () => {
  assert.equal(
    markdownToHtml(md(["| L | C | R | N |", "|:--|:-:|--:|---|", "| 1 | 2 | 3 | 4 |"])),
    [
      "<table>",
      "<thead>",
      '<tr><th class="align-left">L</th><th class="align-center">C</th><th class="align-right">R</th><th>N</th></tr>',
      "</thead>",
      "<tbody>",
      '<tr><td class="align-left">1</td><td class="align-center">2</td><td class="align-right">3</td><td>4</td></tr>',
      "</tbody>",
      "</table>",
    ].join("\n"),
  );
});

test("outer pipes are optional", () => {
  assert.equal(
    markdownToHtml(md(["a | b", "--- | ---", "1 | 2"])),
    "<table>\n<thead>\n<tr><th>a</th><th>b</th></tr>\n</thead>\n<tbody>\n<tr><td>1</td><td>2</td></tr>\n</tbody>\n</table>",
  );
});

test("Markdown inside cells and \\| for a real pipe", () => {
  assert.equal(
    markdownToHtml(md(["| Code | Note |", "|---|---|", "| `a \\| b` | **strong** and [link](/x) |"])),
    '<table>\n<thead>\n<tr><th>Code</th><th>Note</th></tr>\n</thead>\n<tbody>\n<tr><td><code>a | b</code></td><td><strong>strong</strong> and <a href="/x">link</a></td></tr>\n</tbody>\n</table>',
  );
});

test("a missing cell stays empty; an extra one is ignored", () => {
  assert.equal(
    markdownToHtml(md(["| a | b |", "|---|---|", "| 1 |", "| 1 | 2 | 3 |"])),
    "<table>\n<thead>\n<tr><th>a</th><th>b</th></tr>\n</thead>\n<tbody>\n<tr><td>1</td><td></td></tr>\n<tr><td>1</td><td>2</td></tr>\n</tbody>\n</table>",
  );
});

test("header only: no tbody", () => {
  assert.equal(markdownToHtml(md(["| a | b |", "|---|---|"])), "<table>\n<thead>\n<tr><th>a</th><th>b</th></tr>\n</thead>\n</table>");
});

test("the table ends at a blank line or a line without a pipe", () => {
  assert.equal(
    markdownToHtml(md(["| a |", "|---|", "| 1 |", "After"])),
    "<table>\n<thead>\n<tr><th>a</th></tr>\n</thead>\n<tbody>\n<tr><td>1</td></tr>\n</tbody>\n</table>\n<p>After</p>",
  );
});

test("a table interrupts a paragraph", () => {
  assert.equal(
    markdownToHtml(md(["Before", "| a |", "|---|"])),
    "<p>Before</p>\n<table>\n<thead>\n<tr><th>a</th></tr>\n</thead>\n</table>",
  );
});

test("without the dash line it isn't a table", () => {
  assert.equal(markdownToHtml(md(["a | b", "c | d"])), "<p>a | b\nc | d</p>");
});

test("a different column count between header and dashes isn't a table", () => {
  assert.equal(markdownToHtml(md(["| a | b |", "|---|"])), "<p>| a | b |\n|---|</p>");
});
