/*
 * A blog's configuration: the weblog.config.js file of the site that uses
 * weblog-runner.
 *
 *   export default {
 *     site: {
 *       title: "My blog",
 *       url: "https://example.com/",   // with "/" at the end
 *       description: "…",              // optional (goes to the feed)
 *       lang: "en",                    // optional: the <html lang>, the feed and the dates
 *     },
 *     input: "posts",          // folder with the .md files, relative to this file
 *     output: "public/blog",   // where to write the pages, relative to this file
 *     basePath: "blog/",       // where the blog lives on the published site ("" = at the root)
 *     perPage: 10,             // optional
 *     rss: true,               // optional: writes feed.xml
 *     sitemap: true,           // optional: writes sitemap.xml (blog only)
 *     markdown: { html: true },  // optional: false escapes HTML written in posts
 *     root: ".",               // optional: the site root folder, for the dev
 *                              //   server (default: output minus basePath)
 *     templates: { post, list, tag },
 *   };
 */

import { resolve, dirname, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { access } from "node:fs/promises";
import { langError } from "./dates.js";

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Reads and checks the config file.
 * @param {string} file path to weblog.config.js
 */
export async function loadConfig(file) {
  const path = resolve(file);
  try {
    await access(path);
  } catch {
    throw new ConfigError(`config file not found: ${path}`);
  }
  const module = await import(pathToFileURL(path).href);
  if (!module.default) {
    throw new ConfigError(`${path} needs an "export default { … }"`);
  }
  return validateConfig(module.default, dirname(path));
}

/**
 * Checks the fields, fills in the optional ones and resolves the folders.
 * @param {object} config
 * @param {string} dir the folder of the config file
 */
export function validateConfig(config, dir) {
  const problems = [];
  const site = config.site ?? {};
  const templates = config.templates ?? {};

  if (typeof site.title !== "string" || !site.title) problems.push("site.title: the blog's title is missing");
  if (typeof site.url !== "string" || !/^https?:\/\/.+\/$/.test(site.url)) {
    problems.push('site.url: must be the full address, ending in "/" (e.g. "https://example.com/")');
  }
  if (site.lang !== undefined) {
    const problem = langError(site.lang);
    if (problem) problems.push(`site.lang: ${problem}`);
  }
  if (typeof config.input !== "string" || !config.input) problems.push("input: the posts folder is missing");
  if (typeof config.output !== "string" || !config.output) problems.push("output: the folder to write the blog to is missing");
  const basePath = config.basePath ?? "";
  if (typeof basePath !== "string" || basePath.startsWith("/") || (basePath && !basePath.endsWith("/"))) {
    problems.push('basePath: no "/" at the start and a "/" at the end (e.g. "blog/"), or "" for the root');
  }
  const perPage = config.perPage ?? 10;
  if (!Number.isInteger(perPage) || perPage < 1) problems.push("perPage: must be an integer from 1 up");
  for (const name of ["post", "list"]) {
    if (typeof templates[name] !== "function") problems.push(`templates.${name}: must be a function that returns the HTML`);
  }
  if (templates.tag !== undefined && typeof templates.tag !== "function") problems.push("templates.tag: must be a function (or be left out)");
  const markdown = { html: true, ...(config.markdown ?? {}) };
  if (typeof markdown.html !== "boolean") problems.push("markdown.html: true or false");
  if (config.root !== undefined && typeof config.root !== "string") problems.push("root: the site root folder (a string), or leave it out");

  if (problems.length) {
    throw new ConfigError("config has problems:\n  - " + problems.join("\n  - "));
  }

  const outputDir = resolve(dir, config.output);
  return {
    ...config,
    site: { lang: "en", description: "", ...site },
    basePath,
    perPage,
    rss: config.rss ?? true,
    sitemap: config.sitemap ?? true,
    markdown,
    dir,
    inputDir: resolve(dir, config.input),
    outputDir,
    siteDir: config.root !== undefined ? resolve(dir, config.root) : siteRoot(outputDir, basePath),
  };
}

/**
 * The published site's root, inferred: if the output ends with the blog's
 * basePath ("public/blog" with basePath "blog/"), the root is what comes
 * before it ("public"). Otherwise, the output itself.
 */
function siteRoot(outputDir, basePath) {
  const parts = basePath.split("/").filter(Boolean);
  let dir = outputDir;
  for (const part of parts.reverse()) {
    if (basename(dir) !== part) return outputDir;
    dir = dirname(dir);
  }
  return dir;
}
