// Dev mode: server, reload on save, error box and warnings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request } from "node:http";

import { startDevServer } from "../src/dev.js";

/** Listens to the server's events; waitFor(name) returns the next one of that type. */
function listen(port) {
  const queue = [];
  const waiting = [];
  const req = request({ host: "127.0.0.1", port, path: "/__weblog-runner/events" }, (res) => {
    let buffer = "";
    res.setEncoding("utf8");
    res.on("data", (chunk) => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const event = /^event: (.+)$/m.exec(block)?.[1];
        const data = /^data: (.+)$/m.exec(block)?.[1];
        if (!event) continue;
        const item = { event, data: JSON.parse(data) };
        const i = waiting.findIndex((w) => w.name === item.event);
        if (i !== -1) waiting.splice(i, 1)[0].ok(item);
        else queue.push(item);
      }
    });
  });
  req.end();
  return {
    waitFor: (name, ms = 8000) => {
      const i = queue.findIndex((e) => e.event === name);
      if (i !== -1) return Promise.resolve(queue.splice(i, 1)[0]);
      return new Promise((ok, fail) => {
        waiting.push({ name, ok });
        setTimeout(() => fail(new Error(`no "${name}" event in ${ms} ms`)), ms).unref();
      });
    },
    close: () => req.destroy(),
  };
}

/**
 * Saves and waits for the event; saves again if it doesn't come. On Linux,
 * Node sets up recursive folder watching gradually in the background, so a
 * save right after startup (on a slow disk) may happen before the posts
 * folder is being watched.
 */
async function saveUntil(events, name, save, total = 12000) {
  const deadline = Date.now() + total;
  for (;;) {
    await save();
    try {
      return await events.waitFor(name, 1500);
    } catch (error) {
      if (Date.now() > deadline) throw error;
    }
  }
}

const get = (port, path) =>
  new Promise((ok, fail) => {
    request({ host: "127.0.0.1", port, path }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (body += d));
      res.on("end", () => ok({ status: res.statusCode, body, headers: res.headers }));
    }).on("error", fail).end();
  });

test("dev mode: serves, reloads on save and shows the error", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "weblog-runner-dev-"));
  // Close dev mode BEFORE deleting the folder: on Windows, deleting a
  // folder that is still being watched makes the watcher fail.
  let dev;
  t.after(async () => {
    await dev?.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5 });
  });
  await mkdir(join(dir, "posts"));
  await writeFile(
    join(dir, "weblog.config.js"),
    `export default {
  site: { title: "T", url: "https://t.com/" },
  input: "posts", output: "blog", basePath: "blog/",
  templates: { post: (p) => "<html><body>" + p.html + "</body></html>", list: () => "<html><body>list</body></html>" },
};`,
  );
  await writeFile(join(dir, "style.css"), "body{}");
  const post = (text, date = "2026-11-20") => writeFile(join(dir, "posts", "a.md"), `---\ntitle: A\ndate: ${date}\ndraft: true\n---\n${text}`);
  await post("First version.");

  const log = [];
  dev = await startDevServer({ config: join(dir, "weblog.config.js"), port: 0, log: (l) => log.push(l) });
  const events = listen(dev.port);
  t.after(() => events.close());

  assert.match(dev.url, /^http:\/\/localhost:\d+\/blog\/$/);

  // The draft shows up, with the reload script before </body>.
  let r = await get(dev.port, "/blog/a/");
  assert.equal(r.status, 200);
  assert.match(r.body, /<p>First version\.<\/p><script>[\s\S]*EventSource[\s\S]*<\/script>\n<\/body>/);

  // The site's other files are served too (without the script).
  r = await get(dev.port, "/style.css");
  assert.equal(r.body, "body{}");
  assert.match(r.headers["content-type"], /text\/css/);

  // Saved → builds again → "reload" event → new page.
  await saveUntil(events, "reload", () => post("Second version."));
  r = await get(dev.port, "/blog/a/");
  assert.match(r.body, /<p>Second version\.<\/p>/);

  // An error in the post → "build-error" event with the message.
  const error = await saveUntil(events, "build-error", () => post("x", "2026-02-30"));
  assert.match(error.data, /a\.md: invalid date/);
  assert.ok(log.some((l) => /invalid date/.test(l)));

  // Fixed → reloads again.
  await saveUntil(events, "reload", () => post("Third version."));
  assert.match((await get(dev.port, "/blog/a/")).body, /Third version/);
});

test("dev mode: folder without a slash, 404 and nothing outside the site", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "weblog-runner-dev-"));
  // Close dev mode BEFORE deleting the folder: on Windows, deleting a
  // folder that is still being watched makes the watcher fail.
  let dev;
  t.after(async () => {
    await dev?.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5 });
  });
  await mkdir(join(dir, "site", "blog"), { recursive: true });
  await mkdir(join(dir, "posts"));
  await writeFile(join(dir, "secret.txt"), "must not leak");
  await writeFile(join(dir, "site", "404.html"), "<html><body>lost</body></html>");
  await writeFile(
    join(dir, "weblog.config.js"),
    `export default {
  site: { title: "T", url: "https://t.com/" },
  input: "posts", output: "site/blog", basePath: "blog/",
  templates: { post: () => "", list: () => "<html><body>list</body></html>" },
};`,
  );
  dev = await startDevServer({ config: join(dir, "weblog.config.js"), port: 0, log: () => {} });

  let r = await get(dev.port, "/blog");
  assert.equal(r.status, 301);
  assert.equal(r.headers.location, "/blog/");

  r = await get(dev.port, "/does-not-exist/");
  assert.equal(r.status, 404);
  assert.match(r.body, /lost/);

  r = await get(dev.port, "/../secret.txt");
  assert.notEqual(r.body, "must not leak");
  r = await get(dev.port, "/%2e%2e/secret.txt");
  assert.notEqual(r.body, "must not leak");
});

test("dev mode: warnings reach the page that (re)opens", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "weblog-runner-dev-"));
  // Close dev mode BEFORE deleting the folder: on Windows, deleting a
  // folder that is still being watched makes the watcher fail.
  let dev;
  t.after(async () => {
    await dev?.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5 });
  });
  await mkdir(join(dir, "posts"));
  await writeFile(
    join(dir, "weblog.config.js"),
    `export default {
  site: { title: "T", url: "https://t.com/" },
  input: "posts", output: "blog", basePath: "blog/",
  templates: { post: (p) => "<html><body>" + p.html + "</body></html>", list: () => "<html><body></body></html>" },
};`,
  );
  await writeFile(join(dir, "posts", "a.md"), "---\ntitle: A\ndate: 2026-11-20\n---\n![gone](photo.png)");

  dev = await startDevServer({ config: join(dir, "weblog.config.js"), port: 0, log: () => {} });
  const events = listen(dev.port);
  t.after(() => events.close());

  const warning = await events.waitFor("warnings");
  assert.match(warning.data, /a\.md: image not found: photo\.png/);

  // Fixed: the next page that opens gets no warning.
  await saveUntil(events, "reload", () => writeFile(join(dir, "posts", "a.md"), "---\ntitle: A\ndate: 2026-11-20\n---\nNo image."));
  const after = listen(dev.port);
  t.after(() => after.close());
  await assert.rejects(after.waitFor("warnings", 600), /no "warnings" event/);
});
