import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, langError } from "../src/dates.js";

test("long English format is the default", () => {
  assert.equal(formatDate("2026-11-18"), "November 18, 2026");
});

test("short format", () => {
  assert.equal(formatDate("2026-11-18", "short"), "Nov 18, 2026");
});

test("other languages use their own format", () => {
  assert.equal(formatDate("2026-11-18", "long", "en-GB"), "18 November 2026");
  assert.equal(formatDate("2026-11-18", "long", "es"), "18 de noviembre de 2026");
  assert.equal(formatDate("2026-11-18", "long", "fr"), "18 novembre 2026");
});

test("Portuguese uses its own hand-tuned format", () => {
  assert.equal(formatDate("2026-11-18", "long", "pt-BR"), "18 de novembro de 2026");
  assert.equal(formatDate("2026-11-18", "short", "pt-BR"), "18 nov. 2026");
  assert.equal(formatDate("2026-05-01", "short", "pt"), "1 mai. 2026");
  assert.equal(formatDate("2026-11-18", "short", "pt-PT"), "18 nov. 2026");
});

test("every Portuguese month", () => {
  const long = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const short = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
  long.forEach((month, i) => {
    const iso = `2026-${String(i + 1).padStart(2, "0")}-10`;
    assert.equal(formatDate(iso, "long", "pt-BR"), `10 de ${month} de 2026`);
    assert.equal(formatDate(iso, "short", "pt-BR"), `10 ${short[i]} 2026`);
  });
});

test("the day doesn't shift with the computer's time zone", () => {
  const before = process.env.TZ;
  try {
    for (const zone of ["America/Sao_Paulo", "America/Adak", "Pacific/Kiritimati", "UTC"]) {
      process.env.TZ = zone;
      assert.equal(formatDate("2026-01-01"), "January 1, 2026", `in zone ${zone}`);
      assert.equal(formatDate("2026-12-31", "short", "pt-BR"), "31 dez. 2026", `in zone ${zone}`);
    }
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});

test("February 29 only in leap years", () => {
  assert.equal(formatDate("2028-02-29"), "February 29, 2028");
  assert.throws(() => formatDate("2026-02-29"), /^Error: invalid date/);
});

test("dates that don't exist throw", () => {
  for (const bad of ["2026-02-30", "2026-13-01", "2026-00-10", "2026-04-31", "11/18/2026", "yesterday", ""]) {
    assert.throws(() => formatDate(bad), /^Error: invalid date/, `"${bad}" should throw`);
  }
});

test("langError accepts valid tags and explains the others", () => {
  for (const ok of ["en", "en-US", "pt-BR", "es", "fr"]) assert.equal(langError(ok), null, ok);
  assert.match(langError("pt_BR"), /is not a valid language tag/);
  assert.match(langError("klingon"), /does not know the language "klingon"/);
});
