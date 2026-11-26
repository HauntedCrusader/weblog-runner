import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSitemap } from "../src/sitemap.js";

const head = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
const foot = "</urlset>\n";

test("with and without a date", () => {
  assert.equal(
    renderSitemap([
      { loc: "https://example.com/blog/", lastmod: "2026-11-18" },
      { loc: "https://example.com/blog/no-date/" },
    ]),
    head +
      "  <url><loc>https://example.com/blog/</loc><lastmod>2026-11-18</lastmod></url>\n" +
      "  <url><loc>https://example.com/blog/no-date/</loc></url>\n" +
      foot,
  );
});

test("escapes the URL", () => {
  assert.equal(renderSitemap([{ loc: "https://example.com/?a=1&b=2" }]), head + "  <url><loc>https://example.com/?a=1&amp;b=2</loc></url>\n" + foot);
});

test("empty list", () => {
  assert.equal(renderSitemap([]), head + foot);
});
