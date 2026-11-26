/**
 * weblog-runner — the types, so the editor can complete and check templates
 * and the config. Nothing here changes how it runs; it's documentation that
 * VS Code understands.
 *
 * In weblog.config.js:
 *   /** @type {import("weblog-runner").Config} *\/
 *   export default { … };
 *
 * In the templates:
 *   /** @type {import("weblog-runner").PostTemplate} *\/
 *   export const post = (post, ctx) => `…`;
 */

/* ---------------------------------------------------------------- config */

/** The blog: goes to the <html lang>, the feed and the full URLs. */
export interface Site {
  /** The blog's name. */
  title: string;
  /** The published site's address, full and ending in "/": "https://example.com/". */
  url: string;
  /** One sentence about the blog (goes to the feed). */
  description?: string;
  /** Language tag ("en", "en-GB", "pt-BR", "es"…). Sets the date format. Default: "en". */
  lang?: string;
}

export interface Templates {
  /** A post's page. */
  post: PostTemplate;
  /** Each list page: /blog/, /blog/page/2/… */
  list: ListTemplate;
  /** A tag's page (optional; without it, there are no tag pages). */
  tag?: TagTemplate;
}

/** What goes in the `export default` of weblog.config.js. */
export interface Config {
  site: Site;
  /** The posts folder, relative to weblog.config.js. */
  input: string;
  /** Where to write the blog, relative to weblog.config.js. */
  output: string;
  /** Where the blog lives on the published site: "blog/", or "" if the blog is the site. */
  basePath?: string;
  /** Posts per list page. Default: 10. */
  perPage?: number;
  /** Write feed.xml. Default: true. */
  rss?: boolean;
  /** Write sitemap.xml (blog only). Default: true. */
  sitemap?: boolean;
  markdown?: {
    /** false escapes HTML written in the posts. Default: true. */
    html?: boolean;
  };
  /** The site root folder, for the dev server. Default: output minus basePath. */
  root?: string;
  templates: Templates;
}

/* ----------------------------------------------- what templates receive */

/** A neighbor in post order (for "← previous · next →"). */
export interface Neighbor {
  slug: string;
  title: string;
  /** Use with href(ctx, …). */
  path: string;
}

export interface Post {
  /** The URL piece: "hello-world". */
  slug: string;
  /** Plain text: escape it with escapeHtml. */
  title: string;
  /** "2026-11-18" */
  date: string;
  /** "November 18, 2026" (in the site's language). */
  longDate: string;
  /** "Nov 18, 2026" (in the site's language). */
  shortDate: string;
  /** "2026-12-01", from the "updated:" frontmatter, or null. */
  updated: string | null;
  /** Plain text: the "description:" frontmatter or the start of the 1st paragraph. Escape it. */
  description: string;
  tags: string[];
  /** The cover, from the site root (use with href) or an external URL; null without a cover. */
  cover: string | null;
  /** The cover's full URL (for og:image), or null. */
  coverUrl: string | null;
  draft: boolean;
  /** Minutes. */
  readingTime: number;
  /** The body already converted to HTML: use it as is. */
  html: string;
  /** "blog/hello-world/" — from the site root; use with href. */
  path: string;
  /** The post's full URL. */
  url: string;
  /** The older one right below in the list. */
  previous: Neighbor | null;
  /** The newer one right above in the list. */
  next: Neighbor | null;
  /** Where it came from: "my-post.md" or "my-post/index.md". */
  file: string;
  /** The whole frontmatter, for your own fields. */
  frontmatter: Record<string, string | number | boolean | string[]>;
}

export interface ListPage {
  /** This page (from 1). */
  number: number;
  /** How many pages the list has. */
  total: number;
  /** The posts on this page. */
  items: Post[];
  /** The previous page's number, or null. */
  previous: number | null;
  /** The next page's number, or null. */
  next: number | null;
  /** This page's path ("blog/" or "blog/page/2/"). */
  path: string;
  previousPath: string | null;
  nextPath: string | null;
}

export interface TagGroup {
  /** The tag's name, as first written. */
  tag: string;
  slug: string;
  posts: Post[];
  /** "blog/tag/<slug>/" */
  path: string;
}

export interface Context {
  /** The config's site, with defaults filled in. */
  site: Required<Site>;
  /** This page's path, from the site root. */
  path: string;
  /** The way back up to the site root: "../../". */
  root: string;
}

export type PostTemplate = (post: Post, ctx: Context) => string;
export type ListTemplate = (page: ListPage, ctx: Context) => string;
export type TagTemplate = (group: TagGroup, ctx: Context) => string;

/* ------------------------------------------------------------ functions */

/** A link from a template page to anything on the site (external URLs stay the same). */
export function href(ctx: Pick<Context, "root">, path: string | null | undefined): string;
/** & < > " ' → entities. For all text that goes into HTML. */
export function escapeHtml(text: string): string;
export function unescapeHtml(text: string): string;
/** "Hello, World!" → "hello-world" */
export function slugify(text: string): string;
export function formatDate(iso: string, format?: "long" | "short", lang?: string): string;
export function parseDate(iso: string): { year: number; month: number; day: number };
export function langError(lang: string): string | null;
export function readingTime(text: string, wordsPerMinute?: number): number;
export function parseFrontmatter(text: string): { data: Post["frontmatter"]; body: string };
export function inline(text: string, options?: { html?: boolean }): string;
export function markdownToHtml(md: string, options?: { html?: boolean }): string;
export function excerpt(html: string, limit?: number): string;
export function preparePosts<T extends { slug: string; title: string; date: string; draft?: boolean; path?: string }>(
  posts: T[],
  options?: { includeDrafts?: boolean },
): Array<T & { previous: Neighbor | null; next: Neighbor | null }>;
export function paginate<T>(
  items: T[],
  perPage: number,
): Array<{ number: number; total: number; items: T[]; previous: number | null; next: number | null }>;
export function pagePath(number: number, base?: string): string;
export function groupByTag<T extends { tags?: string[] }>(posts: T[]): Array<{ tag: string; slug: string; posts: T[] }>;
export function htmlReferences(html: string): Array<{ attribute: "src" | "href"; value: string }>;
export function htmlIds(html: string): Set<string>;
export function resolveReference(
  value: string,
  pagePath: string,
): { type: "external" } | { type: "anchor"; id: string } | { type: "local"; path: string } | { type: "outside" };
export function renderSitemap(entries: Array<{ loc: string; lastmod?: string }>): string;
export function renderRss(data: {
  site: Site;
  posts: Array<{ title: string; url: string; date: string; description?: string }>;
  feedUrl: string;
}): string;

/** The config after checking, with defaults and folders resolved. */
export interface ResolvedConfig extends Config {
  site: Required<Site>;
  basePath: string;
  perPage: number;
  rss: boolean;
  sitemap: boolean;
  markdown: { html: boolean };
  dir: string;
  inputDir: string;
  outputDir: string;
  siteDir: string;
}

export interface BuildReport {
  posts: number;
  pages: number;
  tags: number;
  /** The files written, relative to the output folder. */
  files: string[];
  /** What the previous build generated and this one deleted. */
  removed: string[];
  /** Images, links, anchors and covers that lead nowhere. */
  warnings: Array<{ file: string; message: string }>;
}

export class ConfigError extends Error {}
export class PostError extends Error {}

export function loadConfig(file: string): Promise<ResolvedConfig>;
export function validateConfig(config: Config, dir: string): ResolvedConfig;
export function build(config: ResolvedConfig, options?: { includeDrafts?: boolean }): Promise<BuildReport>;
export function startDevServer(options: {
  config: string;
  port?: number;
  log?: (text: string) => void;
}): Promise<{ port: number; url: string; close: () => Promise<void> }>;
