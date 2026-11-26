/*
 * Sitemap: the list of pages for search engines.
 *
 *   <?xml version="1.0" encoding="UTF-8"?>
 *   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 *     <url><loc>https://example.com/blog/</loc><lastmod>2026-11-18</lastmod></url>
 *   </urlset>
 */

import { escapeHtml } from "./escape.js";

/**
 * @param {Array<{loc: string, lastmod?: string}>} entries
 * @returns {string}
 */
export function renderSitemap(entries) {
  const urls = entries
    .map(({ loc, lastmod }) => {
      const date = lastmod ? `<lastmod>${escapeHtml(lastmod)}</lastmod>` : "";
      return `  <url><loc>${escapeHtml(loc)}</loc>${date}</url>\n`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`;
}
