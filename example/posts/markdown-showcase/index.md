---
title: Markdown showcase
date: 2026-11-01
tags: [Markdown]
cover: placeholder.svg
---

This post shows everything the weblog-runner Markdown converter supports.
Each section below is one feature. Open `example/posts/markdown-showcase/index.md`
side by side with this page to compare the source with the result.

## Headings

Every heading gets an `id` from its text, so any section can be linked
directly: [jump to Tables](#tables).

### A third-level heading

#### A fourth-level heading

## Inline formatting

**Bold**, *italic* (or _italic_), `inline code` and a [link](https://example.com/).
A backslash escapes a character: \*this is not italic\*. HTML tags pass
through inside a sentence: press <kbd>Ctrl</kbd> + <kbd>S</kbd> to save.

## Images

When a post is a folder, its images live next to it and are copied along
with the page:

![A placeholder image](placeholder.svg)

## Lists

- An unordered item
- Another item
  - A nested item
  - Another nested item
    - A third level

1. An ordered item
2. A second item
   - A bullet nested inside an ordered list
3. A third item

## Tables

| Left aligned | Right aligned | Centered |
|:-------------|--------------:|:--------:|
| Plain text | 1,024 | Yes |
| **Bold** and `code` | 42 | No |

## Blockquotes

> A blockquote can hold any other block.
>
> - Including lists

## Code blocks

```js
export function greet(name) {
  return `Hello, ${name}!`;
}
```

## HTML blocks

<details>
<summary>Click to expand</summary>

After a blank line, the content inside the HTML block is **Markdown** again.

</details>

## Horizontal rules

Three dashes on their own line:

---

That's every feature.
