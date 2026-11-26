import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRss } from "../src/rss.js";

const site = { title: "Example Blog", url: "https://example.com/", description: "A demonstration blog", lang: "en" };

test("the whole feed", () => {
  const rss = renderRss({
    site,
    feedUrl: "https://example.com/blog/feed.xml",
    posts: [
      { title: "Lorem ipsum", url: "https://example.com/blog/lorem-ipsum/", date: "2026-11-18", description: "Dolor sit amet." },
      { title: "R & D", url: "https://example.com/blog/r-d/", date: "2026-01-05", description: "Use <b>." },
    ],
  });
  assert.equal(
    rss,
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      "<channel>",
      "  <title>Example Blog</title>",
      "  <link>https://example.com/</link>",
      "  <description>A demonstration blog</description>",
      "  <language>en</language>",
      '  <atom:link href="https://example.com/blog/feed.xml" rel="self" type="application/rss+xml"/>',
      "  <item>",
      "    <title>Lorem ipsum</title>",
      "    <link>https://example.com/blog/lorem-ipsum/</link>",
      "    <guid>https://example.com/blog/lorem-ipsum/</guid>",
      "    <pubDate>Wed, 18 Nov 2026 00:00:00 GMT</pubDate>",
      "    <description>Dolor sit amet.</description>",
      "  </item>",
      "  <item>",
      "    <title>R &amp; D</title>",
      "    <link>https://example.com/blog/r-d/</link>",
      "    <guid>https://example.com/blog/r-d/</guid>",
      "    <pubDate>Mon, 05 Jan 2026 00:00:00 GMT</pubDate>",
      "    <description>Use &lt;b&gt;.</description>",
      "  </item>",
      "</channel>",
      "</rss>",
      "",
    ].join("\n"),
  );
});

test("no posts, no descriptions and no language", () => {
  const rss = renderRss({ site: { title: "B", url: "https://b.com/" }, feedUrl: "https://b.com/feed.xml", posts: [] });
  assert.equal(
    rss,
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      "<channel>",
      "  <title>B</title>",
      "  <link>https://b.com/</link>",
      "  <description></description>",
      "  <language>en</language>",
      '  <atom:link href="https://b.com/feed.xml" rel="self" type="application/rss+xml"/>',
      "</channel>",
      "</rss>",
      "",
    ].join("\n"),
  );
});

test("the date doesn't depend on the computer's time zone", () => {
  const before = process.env.TZ;
  try {
    for (const zone of ["America/Sao_Paulo", "Pacific/Kiritimati"]) {
      process.env.TZ = zone;
      const rss = renderRss({ site, feedUrl: "x", posts: [{ title: "t", url: "u", date: "2026-01-01" }] });
      assert.match(rss, /<pubDate>Thu, 01 Jan 2026 00:00:00 GMT<\/pubDate>/, `in zone ${zone}`);
      assert.match(rss, /<description><\/description>\n {2}<\/item>/);
    }
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});
