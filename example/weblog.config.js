/*
 * An example blog, to see weblog-runner working end to end:
 *
 *   npm run example      → builds example/output/blog/
 *
 * In a real blog this file sits at the site root, is called
 * weblog.config.js and imports from the package: import { … } from "weblog-runner".
 */

import { post, list, tag } from "./templates.js";

/** @type {import("../types/index.js").Config} */
export default {
  site: {
    title: "Example Blog",
    url: "https://example.com/",
    description: "A demonstration blog for weblog-runner.",
    lang: "en",
  },
  input: "posts",
  output: "output/blog",
  basePath: "blog/",
  perPage: 2,
  templates: { post, list, tag },
};
