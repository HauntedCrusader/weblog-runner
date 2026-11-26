# Changelog

## 1.0.0 — 2026-11-26

First release.

- **Build:** Markdown posts in, a folder of static HTML pages out, with a
  list (paginated), one page per tag, an RSS feed and a sitemap.
- **Templates are plain JavaScript functions** (`post`, `list`, optional
  `tag`) that return the page's HTML. There's no template language.
- **Posts are folders:** `posts/<slug>/index.md` with its images next to it,
  copied along with the page. Single `.md` files work too.
- **Frontmatter:** `title`, `date`, `tags`, `description`, `cover`,
  `updated`, `slug`, `draft`.
- **Dev mode** (`weblog-runner dev`): builds with drafts, serves the whole
  site, rebuilds on save and reloads the browser. Build errors and warnings
  show up on the page.
- **Warnings for broken images, links and anchors.** `build --strict` fails
  on them.
- **Automatic cleanup:** each build removes the pages it made before and no
  longer makes, and never touches files it didn't write.
- **Dates in the site's language** (`site.lang`, English by default).
- **Own Markdown converter:** headings with ids, nested lists, tables with
  alignment classes, code blocks, quotes, and raw HTML.
- **Types** for the config and templates, for editor autocomplete.
- **Zero dependencies.** Requires Node.js 20 or newer.
