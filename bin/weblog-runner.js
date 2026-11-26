#!/usr/bin/env node
/*
 * weblog-runner — the command line.
 *
 *   weblog-runner build [--config file] [--drafts] [--strict]
 *   weblog-runner dev [--config file] [--port 4000]
 *   weblog-runner new "Post title" [--config file]
 *   weblog-runner help
 */

import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig, ConfigError } from "../src/config.js";
import { build, PostError } from "../src/build.js";
import { startDevServer } from "../src/dev.js";
import { slugify } from "../src/slug.js";

const HELP = `weblog-runner — Markdown posts in, HTML blog out

  weblog-runner build [--config file] [--drafts] [--strict]
      Builds the blog. Without --config, uses ./weblog.config.js.
      --drafts includes posts with "draft: true" (for review).
      --strict fails if there are warnings (broken image or link).
      Whatever a previous build generated and this one doesn't is deleted.

  weblog-runner dev [--config file] [--port 4000]
      Dev mode: builds with drafts, serves the site at
      http://localhost:4000 and, on every saved file, builds again and
      reloads the browser. Ctrl+C to stop.

  weblog-runner new "Post title" [--config file]
      Creates posts/<slug>/index.md with the frontmatter filled in (as a
      draft). Put the post's images in the same folder.

  weblog-runner help        this message
  weblog-runner --version   the version
`;

const exists = (path) => access(path).then(() => true, () => false);

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

async function main(args) {
  const [command, ...rest] = args;
  const options = parseOptions(rest);

  switch (command) {
    case "build": {
      const config = await loadConfig(options.config);
      const start = performance.now();
      const r = await build(config, { includeDrafts: options.drafts });
      const ms = Math.round(performance.now() - start);
      const removed = r.removed.length ? `, ${r.removed.length} old removed` : "";
      console.log(`✓ ${plural(r.posts, "post")}, ${plural(r.pages, "list page")}, ${plural(r.tags, "tag")} → ${config.output} (${plural(r.files.length, "file")}${removed}, ${ms} ms)`);
      for (const warning of r.warnings) console.log(`⚠ ${warning.file}: ${warning.message}`);
      if (r.warnings.length && options.strict) {
        console.error(`✗ ${plural(r.warnings.length, "warning")} (--strict)`);
        return 1;
      }
      return 0;
    }
    case "dev": {
      const port = options.port ?? 4000;
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        console.error("✗ --port must be a number from 0 to 65535");
        return 1;
      }
      const dev = await startDevServer({ config: options.config, port });
      console.log(`\n✎ Dev mode at ${dev.url}\n  Drafts included. Save a file and the browser reloads. Ctrl+C to stop.\n`);
      await new Promise((ok) => {
        process.once("SIGINT", ok);
        process.once("SIGTERM", ok);
      });
      await dev.close();
      // File watchers may take a moment to let go; no need to wait.
      process.exit(0);
    }
    case "new": {
      const title = options.loose.join(" ").trim();
      if (!title) {
        console.error('✗ Missing the title: weblog-runner new "Post title"');
        return 1;
      }
      const config = await loadConfig(options.config);
      // Every new post is a folder: the text in index.md, its images next to it.
      const slug = slugify(title);
      const folder = join(config.inputDir, slug);
      const file = join(folder, "index.md");
      const flat = join(config.inputDir, `${slug}.md`);
      if (await exists(flat)) {
        console.error(`✗ Already exists: ${flat}`);
        return 1;
      }
      await mkdir(folder, { recursive: true });
      // Quoted: that way a title like "42" or "true" stays text.
      const text = `---\ntitle: "${title}"\ndate: ${today()}\ntags: []\ndraft: true\n---\n\nWrite here.\n`;
      try {
        await writeFile(file, text, { encoding: "utf8", flag: "wx" });
      } catch (error) {
        if (error.code === "EEXIST") {
          console.error(`✗ Already exists: ${file}`);
          return 1;
        }
        throw error;
      }
      console.log(`✓ ${file}\n  When it's ready, remove the "draft: true".`);
      return 0;
    }
    case "--version":
    case "-v": {
      const pkg = JSON.parse(await readFile(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"));
      console.log(pkg.version);
      return 0;
    }
    case undefined:
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      return 0;
    default:
      console.error(`✗ Unknown command: ${command}\n\n${HELP}`);
      return 1;
  }
}

function parseOptions(list) {
  const options = { config: "weblog.config.js", drafts: false, strict: false, port: undefined, loose: [] };
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a === "--config") options.config = list[++i] ?? options.config;
    else if (a.startsWith("--config=")) options.config = a.slice("--config=".length);
    else if (a === "--drafts") options.drafts = true;
    else if (a === "--strict") options.strict = true;
    else if (a === "--port") options.port = Number(list[++i]);
    else if (a.startsWith("--port=")) options.port = Number(a.slice("--port=".length));
    else options.loose.push(a);
  }
  return options;
}

/** Today's date in the local time zone, as YYYY-MM-DD. */
function today() {
  const d = new Date();
  const two = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if (error instanceof ConfigError || error instanceof PostError) {
    console.error(`✗ ${error.message}`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
}
