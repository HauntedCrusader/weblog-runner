/*
 * Building the blog: reads the .md files, runs each one through the
 * functions in src/ and writes the pages.
 *
 * Only file reading/writing and the order of the steps live here; the logic
 * is in the other functions (src/*.js), which never touch files and are
 * therefore tested one by one.
 *
 * A post is a file (posts/my-post.md) or a folder with index.md
 * (posts/my-post/index.md). In a folder, the other files (images, PDFs…) are
 * copied next to the post's page, so ![](photo.jpg) works.
 *
 * What goes into the output folder (with basePath "blog/"):
 *   index.html                 list page 1            → /blog/
 *   page/2/index.html …        the other list pages   → /blog/page/2/
 *   <slug>/index.html          each post (+ the files of its folder)
 *   tag/<slug>/index.html      each tag (if there's templates.tag)
 *   feed.xml · sitemap.xml
 *   .weblog-runner.json        the list of generated files (see below)
 *
 * CLEANUP: on every build, whatever the PREVIOUS build generated and this
 * one didn't (a renamed post, a draft, a removed image) is deleted. Only
 * what's listed in .weblog-runner.json goes — never a file something else
 * put in the folder.
 *
 * WARNINGS: at the end, each post's images, links and anchors (and its
 * cover) are checked: anything pointing to something that doesn't exist on
 * the site becomes a warning. The build doesn't fail because of it (except
 * with --strict).
 */

import { readdir, readFile, mkdir, writeFile, copyFile, unlink, rmdir, stat } from "node:fs/promises";
import { join, dirname, resolve, relative, sep } from "node:path";

import { slugify } from "./slug.js";
import { parseFrontmatter } from "./frontmatter.js";
import { markdownToHtml } from "./markdown/blocks.js";
import { readingTime } from "./reading-time.js";
import { formatDate } from "./dates.js";
import { excerpt } from "./excerpt.js";
import { preparePosts } from "./posts.js";
import { paginate, pagePath } from "./pagination.js";
import { groupByTag } from "./tags.js";
import { renderSitemap } from "./sitemap.js";
import { renderRss } from "./rss.js";
import { htmlReferences, htmlIds, resolveReference } from "./check.js";

export class PostError extends Error {
  constructor(file, message) {
    super(`${file}: ${message}`);
    this.name = "PostError";
  }
}

const MANIFEST = ".weblog-runner.json";

/**
 * Builds the whole blog.
 * @param {ReturnType<import("./config.js").validateConfig>} config
 * @param {{ includeDrafts?: boolean }} [options]
 * @returns {Promise<{ posts: number, pages: number, tags: number, files: string[], removed: string[],
 *   warnings: Array<{ file: string, message: string }> }>}
 */
export async function build(config, options = {}) {
  const { site, basePath, templates } = config;

  // 1. Read the posts.
  const read = [];
  for (const source of await listPosts(config.inputDir)) {
    const text = await readFile(source.file, "utf8");
    try {
      read.push(readPost(source, text, config));
    } catch (error) {
      throw error instanceof PostError ? error : new PostError(source.name, error.message);
    }
  }

  // 2. Sort them out.
  let posts;
  try {
    posts = preparePosts(read, { includeDrafts: options.includeDrafts === true });
  } catch (error) {
    // "duplicate slug: x" — say which files.
    const duplicate = /^duplicate slug: (.+)$/.exec(error.message)?.[1];
    if (!duplicate) throw error;
    const files = read.filter((p) => p.slug === duplicate).map((p) => p.file).join(" and ");
    throw new PostError(files, `both get the same address (${duplicate}); rename one or use "slug:" in the frontmatter`);
  }
  const files = [];
  const write = async (sitePath, html, who) => {
    if (typeof html !== "string") {
      throw new Error(`templates.${who} returned ${typeof html}; it must return the HTML (a string)`);
    }
    const rel = sitePath.slice(basePath.length);
    const file = rel.endsWith(".xml") ? rel : join(rel, "index.html");
    const target = join(config.outputDir, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, html, "utf8");
    files.push(file.split("\\").join("/"));
  };
  const context = (sitePath) => ({ site, path: sitePath, root: rootFrom(sitePath) });
  const map = [];

  // 3. Each post, with the files of its folder.
  for (const post of posts) {
    await write(post.path, templates.post(publicPost(post), context(post.path)), "post");
    map.push({ loc: site.url + post.path, lastmod: post.updated ?? post.date });
    if (post.folder) {
      for (const asset of await listAssets(post.folder)) {
        const file = `${post.path.slice(basePath.length)}${asset}`;
        const target = join(config.outputDir, file);
        await mkdir(dirname(target), { recursive: true });
        await copyFile(join(post.folder, asset), target);
        files.push(file);
      }
    }
  }
  posts = posts.map(publicPost);

  // 4. The list pages.
  const pages = paginate(posts, config.perPage);
  for (const page of pages) {
    const here = pagePath(page.number, basePath);
    const withPaths = {
      ...page,
      path: here,
      previousPath: page.previous ? pagePath(page.previous, basePath) : null,
      nextPath: page.next ? pagePath(page.next, basePath) : null,
    };
    await write(here, templates.list(withPaths, context(here)), "list");
    map.push({ loc: site.url + here, lastmod: newest(page.items) });
  }

  // 5. Tags (only if the blog has the template).
  const groups = templates.tag ? groupByTag(posts) : [];
  for (const group of groups) {
    const here = `${basePath}tag/${group.slug}/`;
    await write(here, templates.tag({ ...group, path: here }, context(here)), "tag");
    map.push({ loc: site.url + here, lastmod: newest(group.posts) });
  }

  // 6. Feed and sitemap.
  if (config.rss) {
    const feedUrl = `${site.url}${basePath}feed.xml`;
    await write(`${basePath}feed.xml`, renderRss({ site, posts, feedUrl }), "rss");
  }
  if (config.sitemap) {
    await write(`${basePath}sitemap.xml`, renderSitemap(map), "sitemap");
  }

  // 7. Clean up what the previous build generated and this one didn't.
  const removed = await cleanUp(config.outputDir, files);

  // 8. Images, links and anchors that lead nowhere.
  const warnings = await checkPosts(posts, files, config);

  return { posts: posts.length, pages: pages.length, tags: groups.length, files, removed, warnings };
}

/**
 * Checks what each post points to: what this build just generated, the
 * site's files on disk and the post's own ids (for "#anchors").
 */
async function checkPosts(posts, files, config) {
  const root = resolve(config.siteDir);
  const onSite = (file) => relative(root, join(config.outputDir, file)).split(sep).join("/");
  const generated = new Set();
  for (const file of files) {
    const path = onSite(file);
    generated.add(path);
    if (path === "index.html") generated.add("");
    else if (path.endsWith("/index.html")) generated.add(path.slice(0, -"index.html".length));
  }

  const seen = new Map();
  const exists = async (path) => {
    if (generated.has(path)) return true;
    if (!seen.has(path)) seen.set(path, existsOnDisk(root, path));
    return seen.get(path);
  };

  const warnings = [];
  for (const post of posts) {
    const ids = htmlIds(post.html);
    for (const { attribute, value } of htmlReferences(post.html)) {
      const target = resolveReference(value, post.path);
      const what = attribute === "src" ? "image not found" : "broken link";
      if (target.type === "anchor") {
        if (target.id && !ids.has(target.id)) warnings.push({ file: post.file, message: `anchor not found in the post: ${value}` });
      } else if (target.type === "outside") {
        warnings.push({ file: post.file, message: `${what} (goes above the site root): ${value}` });
      } else if (target.type === "local" && !(await exists(target.path))) {
        warnings.push({ file: post.file, message: `${what}: ${value}` });
      }
    }
    if (post.cover && !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(post.cover) && !(await exists(post.cover))) {
      warnings.push({ file: post.file, message: `cover not found: ${post.frontmatter.cover}` });
    }
  }
  return warnings;
}

/** Does a site path exist on disk? A folder counts if it has index.html. */
async function existsOnDisk(root, path) {
  const target = resolve(root, path);
  if (target !== root && !target.startsWith(root + sep)) return false;
  try {
    const info = await stat(target);
    if (!info.isDirectory()) return !path.endsWith("/");
    await stat(join(target, "index.html"));
    return true;
  } catch {
    return false;
  }
}

/**
 * The posts in the input folder: each "something.md" and each folder with
 * an "index.md".
 * @returns {Promise<Array<{ name: string, base: string, file: string, folder: string|null }>>}
 */
async function listPosts(inputDir) {
  const entries = await readdir(inputDir, { withFileTypes: true });
  const sources = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isFile() && entry.name.endsWith(".md")) {
      sources.push({ name: entry.name, base: entry.name.slice(0, -3), file: join(inputDir, entry.name), folder: null });
    } else if (entry.isDirectory()) {
      const index = join(inputDir, entry.name, "index.md");
      if (await exists(index)) {
        sources.push({ name: `${entry.name}/index.md`, base: entry.name, file: index, folder: join(inputDir, entry.name) });
      }
    }
  }
  return sources.sort((a, b) => a.name.localeCompare(b.name));
}

/** The files that come with a folder post (everything but .md and hidden files), with subfolders. */
async function listAssets(folder, prefix = "") {
  const assets = [];
  for (const entry of await readdir(join(folder, prefix), { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) assets.push(...(await listAssets(folder, rel)));
    else if (entry.isFile() && !entry.name.endsWith(".md")) assets.push(rel);
  }
  return assets.sort();
}

/** A .md → the post object the templates receive. */
function readPost(source, text, config) {
  const { name } = source;
  const { data, body } = parseFrontmatter(text);
  if (typeof data.title !== "string" || !data.title) throw new PostError(name, 'missing "title:" in the frontmatter');
  if (typeof data.date !== "string" || !data.date) throw new PostError(name, 'missing "date:" in the frontmatter (YYYY-MM-DD)');

  const slug = typeof data.slug === "string" && data.slug ? slugify(data.slug) : slugify(source.base);
  if (!slug) throw new PostError(name, "the file name doesn't give an address (empty slug)");
  const html = markdownToHtml(body, { html: config.markdown.html });
  const path = `${config.basePath}${slug}/`;
  const url = config.site.url + path;
  const cover = resolveCover(data.cover, path, config.site.url);
  const lang = config.site.lang;

  return {
    file: name,
    folder: source.folder,
    slug,
    title: data.title,
    date: data.date,
    longDate: formatDate(data.date, "long", lang),
    shortDate: formatDate(data.date, "short", lang),
    updated: typeof data.updated === "string" ? data.updated : null,
    description: typeof data.description === "string" && data.description ? data.description : excerpt(html),
    tags: Array.isArray(data.tags) ? data.tags : [],
    cover: cover.path,
    coverUrl: cover.url,
    draft: data.draft === true,
    readingTime: readingTime(body),
    html,
    path,
    url,
    frontmatter: data,
  };
}

/**
 * The frontmatter cover → { path, url }:
 *   "cover.jpg" (relative: next to the post) → "blog/my-post/cover.jpg"
 *   "/img/x.png" (from the site root)        → "img/x.png"
 *   "https://…" (external)                   → unchanged
 * path is for href(ctx, …); url is the full address (og:image).
 */
function resolveCover(cover, postPath, siteUrl) {
  if (typeof cover !== "string" || !cover) return { path: null, url: null };
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(cover)) return { path: cover, url: cover };
  const fromRoot = cover.startsWith("/") ? cover.slice(1) : postPath + cover.replace(/^\.\//, "");
  return { path: fromRoot, url: siteUrl + fromRoot };
}

/** The post as the templates see it (without the folder on disk). */
function publicPost(post) {
  const { folder, ...rest } = post;
  return rest;
}

/**
 * Deletes what's in the previous build's list and not in this one, and
 * writes the new list. Never touches anything outside the output folder.
 */
async function cleanUp(outputDir, generated) {
  const manifestFile = join(outputDir, MANIFEST);
  let previous = [];
  try {
    const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
    previous = manifest.files ?? [];
  } catch {
    // First build (or a broken list): nothing to clean.
  }

  const now = new Set(generated);
  const root = resolve(outputDir);
  const removed = [];
  for (const file of previous) {
    if (typeof file !== "string" || now.has(file) || file === MANIFEST) continue;
    const path = resolve(root, file);
    if (!path.startsWith(root + sep)) continue; // never outside the output folder
    try {
      await unlink(path);
      removed.push(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      continue;
    }
    // Folders left empty go too (rmdir fails if they aren't empty).
    for (let dir = dirname(path); dir.startsWith(root + sep); dir = dirname(dir)) {
      try {
        await rmdir(dir);
      } catch {
        break;
      }
    }
  }

  await writeFile(manifestFile, JSON.stringify({ generator: "weblog-runner", files: [...now].sort() }, null, 2) + "\n", "utf8");
  return removed;
}

/** "blog/my-post/" → "../../" (the way back up to the site root). */
function rootFrom(sitePath) {
  const depth = sitePath.split("/").filter(Boolean).length;
  return "../".repeat(depth);
}

function newest(posts) {
  return posts.reduce((latest, p) => {
    const d = p.updated ?? p.date;
    return !latest || d > latest ? d : latest;
  }, undefined);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
