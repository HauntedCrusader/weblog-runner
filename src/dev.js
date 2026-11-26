/*
 * Dev mode: `weblog-runner dev`.
 *
 *   1. Builds the blog (with drafts).
 *   2. Serves the site root at http://localhost:4000/.
 *   3. Watches the site folder and the posts folder: save a file and it
 *      builds again, and the browser reloads by itself.
 *   4. If the build fails (a bad date, a template error), the message shows
 *      up in a red box on the page itself — and goes away on the next
 *      successful build. Warnings (broken image or link) show up in a yellow
 *      box, which closes with a click.
 *
 * Each build runs in a fresh process (`weblog-runner build`): that way a
 * change to templates.js or weblog.config.js also takes effect, without a
 * restart. The output folder is ignored (otherwise every build would
 * trigger another), and so are node_modules and .git.
 *
 * Reloading uses Server-Sent Events: pages served here get a small <script>
 * before </body> — only in the server's response; the file on disk doesn't
 * change.
 */

import { createServer } from "node:http";
import { watch } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "./config.js";

const BIN = fileURLToPath(new URL("../bin/weblog-runner.js", import.meta.url));
const EVENTS = "/__weblog-runner/events";
const IGNORED = ["node_modules", ".git"];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".gz": "application/gzip",
};

const SCRIPT = `<script>
(() => {
  const source = new EventSource("${EVENTS}");
  const box = (background, color, border) => {
    let el = document.getElementById("weblog-runner-box");
    if (!el) {
      el = document.createElement("pre");
      el.id = "weblog-runner-box";
      el.title = "Click to close";
      el.addEventListener("click", () => el.remove());
      document.body.append(el);
    }
    el.style.cssText = "position:fixed;left:1rem;right:1rem;bottom:1rem;z-index:2147483647;margin:0;padding:1rem 1.25rem;max-height:50vh;overflow:auto;cursor:pointer;font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap;border:1px solid " + border + ";background:" + background + ";color:" + color;
    return el;
  };
  source.addEventListener("reload", () => location.reload());
  source.addEventListener("build-error", (e) => { box("#2b0d0d", "#ffd9d9", "#ff6b6b").textContent = "weblog-runner: the build failed\\n\\n" + JSON.parse(e.data); });
  source.addEventListener("warnings", (e) => { box("#2b230d", "#ffefc2", "#e0b23a").textContent = "weblog-runner: warnings (click to close)\\n\\n" + JSON.parse(e.data); });
})();
</script>`;

/**
 * Starts dev mode.
 * @param {{ config: string, port?: number, log?: (text: string) => void }} options
 *   port 0 picks a free one (used in the tests).
 * @returns {Promise<{ port: number, url: string, close: () => Promise<void> }>}
 */
export async function startDevServer({ config: configFile, port = 4000, log = console.log }) {
  const config = await loadConfig(configFile);
  const root = resolve(config.siteDir);
  const output = resolve(config.outputDir);
  const clients = new Set();
  let lastError = null;
  let lastWarnings = null;

  const send = (event, data) => {
    for (const res of clients) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // --- builds (one at a time; changes in the middle ask for one more at the end) ---
  let running = null;
  let again = false;
  const rebuild = () => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        const r = await runBuild(resolve(configFile));
        const time = new Date().toLocaleTimeString("en-GB");
        if (r.ok) {
          lastError = null;
          const warnings = r.output.split(/\r?\n/).filter((l) => l.startsWith("⚠")).map((l) => l.slice(1).trim());
          lastWarnings = warnings.length ? warnings.join("\n") : null;
          log(`[${time}] ${r.output.trim()}`);
          send("reload", "ok");
        } else {
          lastError = r.output.trim() || "unknown error";
          log(`[${time}] ${lastError}`);
          send("build-error", lastError);
        }
      } while (again);
      running = null;
    })();
    return running;
  };

  await rebuild();

  // --- watch the files ---
  const watchers = [];
  let timer = null;
  const changed = (dir) => (_type, name) => {
    if (name) {
      const path = resolve(dir, String(name));
      if (path === output || path.startsWith(output + sep)) return;
      if (String(name).split(/[\\/]/).some((part) => IGNORED.includes(part))) return;
    }
    clearTimeout(timer);
    timer = setTimeout(rebuild, 120);
  };
  const watched = [config.dir];
  const input = resolve(config.inputDir);
  if (!input.startsWith(resolve(config.dir) + sep)) watched.push(input);
  for (const dir of watched) {
    const watcher = watch(dir, { recursive: true }, changed(dir));
    // On Windows, deleting or moving the watched folder itself makes the
    // watcher fail with EPERM. Without a listener that would crash dev mode.
    watcher.on("error", (error) => {
      watcher.close();
      console.error(`⚠ stopped watching ${dir}: ${error.message}`);
    });
    watchers.push(watcher);
  }

  // --- server ---
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === EVENTS) {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      res.write(": weblog-runner\n\n");
      // Whoever arrives (the reloaded page) gets the current state.
      if (lastError) res.write(`event: build-error\ndata: ${JSON.stringify(lastError)}\n\n`);
      else if (lastWarnings) res.write(`event: warnings\ndata: ${JSON.stringify(lastWarnings)}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    await serve(root, decodeURIComponent(url.pathname), res);
  });

  await new Promise((ok, fail) => {
    server.once("error", (error) => {
      fail(error.code === "EADDRINUSE" ? new Error(`port ${port} is already in use; try --port ${port + 1}`) : error);
    });
    server.listen(port, "127.0.0.1", ok);
  });
  const usedPort = server.address().port;

  return {
    port: usedPort,
    url: `http://localhost:${usedPort}/${config.basePath}`,
    close: async () => {
      clearTimeout(timer);
      for (const w of watchers) w.close();
      for (const res of clients) res.end();
      await running;
      server.closeAllConnections();
      await new Promise((ok) => server.close(ok));
    },
  };
}

/** Runs `weblog-runner build --drafts` in a fresh process. */
function runBuild(configFile) {
  return new Promise((ok) => {
    const child = spawn(process.execPath, [BIN, "build", "--drafts", "--config", configFile], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("close", (code) => ok({ ok: code === 0, output }));
  });
}

/** Serves a file from the site root (folder → index.html), with the script on pages. */
async function serve(root, path, res) {
  const target = resolve(join(root, path));
  if (target !== root && !target.startsWith(root + sep)) {
    res.writeHead(403).end("Outside the site.");
    return;
  }

  let file = target;
  try {
    if ((await stat(target)).isDirectory()) {
      if (!path.endsWith("/")) {
        res.writeHead(301, { Location: `${path}/` }).end();
        return;
      }
      file = join(target, "index.html");
    }
    const body = await readFile(file);
    deliver(res, 200, file, body);
  } catch {
    try {
      deliver(res, 404, "404.html", await readFile(join(root, "404.html")));
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end(`Not found: ${path}`);
    }
  }
}

function deliver(res, status, file, body) {
  const type = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
  let content = body;
  if (type.startsWith("text/html")) {
    const html = body.toString("utf8");
    const end = html.lastIndexOf("</body>");
    content = end === -1 ? html + SCRIPT : html.slice(0, end) + SCRIPT + "\n" + html.slice(end);
  }
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(content);
}
