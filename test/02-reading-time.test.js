import { test } from "node:test";
import assert from "node:assert/strict";
import { readingTime } from "../src/reading-time.js";

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

test("short text counts as 1 minute", () => {
  assert.equal(readingTime("Just a few words."), 1);
});

test("empty text or only whitespace is also 1", () => {
  assert.equal(readingTime(""), 1);
  assert.equal(readingTime("   \n\t "), 1);
});

test("400 words at 200 per minute = 2", () => {
  assert.equal(readingTime(words(400)), 2);
});

test("rounds up: 401 words = 3", () => {
  assert.equal(readingTime(words(401)), 3);
});

test("line breaks, tabs and repeated spaces separate words", () => {
  const text = Array.from({ length: 201 }, (_, i) => `w${i}`).join("\n\t  ");
  assert.equal(readingTime(text), 2);
});

test("another reading pace", () => {
  assert.equal(readingTime(words(300), 100), 3);
});
