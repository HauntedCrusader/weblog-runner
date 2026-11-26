/*
 * RSS 2.0 feed, for people who follow the blog in a feed reader.
 *
 * One <item> per post, in the order received. All text is escaped; a
 * missing description becomes an empty tag. The date uses the RSS format,
 * at midnight UTC: "2026-11-18" → "Wed, 18 Nov 2026 00:00:00 GMT".
 */

import { escapeHtml as e } from "./escape.js";
import { parseDate } from "./dates.js";

/**
 * @param {{ site: {title: string, url: string, description?: string, lang?: string},
 *           posts: Array<{title: string, url: string, date: string, description?: string}>,
 *           feedUrl: string }} data feedUrl = the feed's own address
 * @returns {string}
 */
export function renderRss({ site, posts, feedUrl }) {
  const items = posts.flatMap((p) => [
    "  <item>",
    `    <title>${e(p.title)}</title>`,
    `    <link>${e(p.url)}</link>`,
    `    <guid>${e(p.url)}</guid>`,
    `    <pubDate>${rssDate(p.date)}</pubDate>`,
    `    <description>${e(p.description ?? "")}</description>`,
    "  </item>",
  ]);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    `  <title>${e(site.title)}</title>`,
    `  <link>${e(site.url)}</link>`,
    `  <description>${e(site.description ?? "")}</description>`,
    `  <language>${e(site.lang ?? "en")}</language>`,
    `  <atom:link href="${e(feedUrl)}" rel="self" type="application/rss+xml"/>`,
    ...items,
    "</channel>",
    "</rss>",
    "",
  ].join("\n");
}

function rssDate(iso) {
  const { year, month, day } = parseDate(iso);
  return new Date(Date.UTC(year, month - 1, day)).toUTCString();
}
