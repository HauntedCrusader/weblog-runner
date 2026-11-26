/*
 * THE TEMPLATES: the blog's look. Each one is a function that receives the
 * data and returns the whole page's HTML (template strings, no new
 * language). This is the place for your design system, your site's CSS,
 * etc. This example uses a small neutral stylesheet with a dark mode.
 *
 *   post(post, ctx)   → a post's page
 *   list(page, ctx)   → each list page (/blog/, /blog/page/2/…)
 *   tag(group, ctx)   → a tag's page (optional)
 *
 * ctx = { site, path, root }
 *   root is the way back up to the site root ("../../"): every "path"
 *   weblog-runner gives you starts at the root, so a link is always
 *   href(ctx, post.path) — which is `${ctx.root}${post.path}`, but also
 *   accepts external URLs (https://…). That way the blog works in any
 *   folder, in dev mode and even opened straight from disk.
 *
 * RULE: titles, descriptions and tags are TEXT — run them through
 * escapeHtml. post.html is already HTML (it came out of the Markdown
 * converter): use it as is.
 */

// In a real blog: import { escapeHtml, slugify, href } from "weblog-runner";
// and the types in the comments come from import("weblog-runner") instead of "../types/index.js".
import { escapeHtml as e, slugify, href } from "../src/index.js";

const shell = (ctx, { title, description, image, body }) => `<!DOCTYPE html>
<html lang="${e(ctx.site.lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(description)}">
${image ? `<meta property="og:image" content="${e(image)}">\n` : ""}<link rel="alternate" type="application/rss+xml" title="${e(ctx.site.title)}" href="${href(ctx, "blog/feed.xml")}">
<style>
  :root { color-scheme: light dark; --text: #1f2328; --muted: #656d76; --line: #d0d7de; --bg: #ffffff; --soft: #f6f8fa; --link: #0969da; }
  @media (prefers-color-scheme: dark) {
    :root { --text: #e6edf3; --muted: #8d96a0; --line: #30363d; --bg: #0d1117; --soft: #161b22; --link: #4493f8; }
  }
  body { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; font: 1.0625rem/1.65 system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); }
  a { color: var(--link); }
  header { padding-bottom: 1rem; border-bottom: 1px solid var(--line); margin-bottom: 2rem; }
  header a { color: var(--text); font-weight: 600; text-decoration: none; }
  h1 { font-size: 2rem; line-height: 1.25; margin: 0 0 .5rem; }
  h2 { font-size: 1.35rem; margin-top: 2.25rem; }
  pre, code, kbd { font-family: ui-monospace, "SFMono-Regular", Consolas, monospace; font-size: .9em; }
  pre { background: var(--soft); border: 1px solid var(--line); border-radius: 6px; padding: 1rem; overflow-x: auto; }
  :not(pre) > code { background: var(--soft); border-radius: 4px; padding: .1em .35em; }
  kbd { border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 4px; padding: 0 .35em; }
  img { max-width: 100%; height: auto; border-radius: 6px; }
  hr { border: 0; border-top: 1px solid var(--line); margin: 2rem 0; }
  blockquote { margin: 1.5rem 0; padding: 0 1rem; border-left: 3px solid var(--line); color: var(--muted); }
  table { border-collapse: collapse; display: block; overflow-x: auto; }
  th, td { border: 1px solid var(--line); padding: .4rem .8rem; text-align: left; }
  th { background: var(--soft); }
  /* Columns aligned in the Markdown (|:--:| etc.) come with these classes. */
  .align-left { text-align: left; }
  .align-center { text-align: center; }
  .align-right { text-align: right; }
  .meta { color: var(--muted); font-size: .9rem; margin: 0 0 1.5rem; }
  .card { padding: 1.5rem 0; border-bottom: 1px solid var(--line); }
  .card h2 { margin: .25rem 0; font-size: 1.25rem; }
  .card p { margin: .25rem 0; }
  nav { display: flex; justify-content: space-between; gap: 1rem; margin-top: 3rem; color: var(--muted); font-size: .9rem; }
</style>
</head>
<body>
<header><a href="${href(ctx, "blog/")}">${e(ctx.site.title)}</a></header>
<main>
${body}
</main>
</body>
</html>
`;

const tagLinks = (post, ctx) =>
  post.tags.map((t) => `<a href="${href(ctx, `blog/tag/${slugify(t)}/`)}">${e(t)}</a>`).join(" · ");

/** @type {import("../types/index.js").PostTemplate} */
export function post(post, ctx) {
  return shell(ctx, {
    title: `${post.title} — ${ctx.site.title}`,
    description: post.description,
    image: post.coverUrl,
    body: `<article>
<h1>${e(post.title)}</h1>
<p class="meta"><time datetime="${post.date}">${post.longDate}</time> · ${post.readingTime} min read${post.tags.length ? ` · ${tagLinks(post, ctx)}` : ""}</p>
${post.html}
</article>
<nav>
  <span>${post.previous ? `← <a href="${href(ctx, post.previous.path)}">${e(post.previous.title)}</a>` : ""}</span>
  <span>${post.next ? `<a href="${href(ctx, post.next.path)}">${e(post.next.title)}</a> →` : ""}</span>
</nav>`,
  });
}

const card = (post, ctx) => `<article class="card">
${post.cover ? `<img src="${href(ctx, post.cover)}" alt="" width="1200" height="600">\n` : ""}<h2><a href="${href(ctx, post.path)}">${e(post.title)}</a></h2>
<p class="meta">${post.shortDate} · ${post.readingTime} min</p>
<p>${e(post.description)}</p>
</article>`;

/** @type {import("../types/index.js").ListTemplate} */
export function list(page, ctx) {
  return shell(ctx, {
    title: page.number === 1 ? ctx.site.title : `${ctx.site.title} — page ${page.number}`,
    description: ctx.site.description,
    body: `<h1>${e(ctx.site.title)}</h1>
${page.items.map((p) => card(p, ctx)).join("\n") || "<p>No posts yet.</p>"}
<nav>
  <span>${page.previousPath ? `<a href="${href(ctx, page.previousPath)}">← Newer</a>` : ""}</span>
  <span>Page ${page.number} of ${page.total}</span>
  <span>${page.nextPath ? `<a href="${href(ctx, page.nextPath)}">Older →</a>` : ""}</span>
</nav>`,
  });
}

/** @type {import("../types/index.js").TagTemplate} */
export function tag(group, ctx) {
  return shell(ctx, {
    title: `${group.tag} — ${ctx.site.title}`,
    description: `Posts about ${group.tag}.`,
    body: `<h1>${e(group.tag)}</h1>
${group.posts.map((p) => card(p, ctx)).join("\n")}`,
  });
}
