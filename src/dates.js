/*
 * Post dates, in the blog's language (site.lang in the config):
 *
 *   formatDate("2026-11-18")                    → "November 18, 2026"
 *   formatDate("2026-11-18", "short")           → "Nov 18, 2026"
 *   formatDate("2026-11-18", "long", "en-GB")   → "18 November 2026"
 *   formatDate("2026-11-18", "long", "es")      → "18 de noviembre de 2026"
 *   formatDate("2026-11-18", "short", "pt-BR")  → "18 nov. 2026"
 *
 * Every language uses its own format (Intl, which ships with Node), except
 * Portuguese (pt, pt-BR, pt-PT…), which uses a hand-tuned one: Intl's
 * short form there is "18 de nov. de 2026".
 *
 * The day never shifts with the computer's time zone: new Date("2026-11-18")
 * would be midnight UTC, which in Brazil is still the 17th. Here the numbers
 * are read directly and Intl formats in UTC.
 */

const PT_MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const PT_SHORT_MONTHS = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

/**
 * Reads "YYYY-MM-DD" and checks that the date exists.
 * @param {string} iso
 * @returns {{ year: number, month: number, day: number }}
 */
export function parseDate(iso) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!parts) throw new Error(`invalid date: "${iso}" (use YYYY-MM-DD)`);
  const [year, month, day] = parts.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`invalid date: "${iso}" does not exist`);
  }
  return { year, month, day };
}

/**
 * @param {string} iso "YYYY-MM-DD"
 * @param {"long"|"short"} [format="long"]
 * @param {string} [lang="en"] a language tag: "en", "en-GB", "pt-BR", "es"…
 * @returns {string}
 */
export function formatDate(iso, format = "long", lang = "en") {
  const { year, month, day } = parseDate(iso);
  if (/^pt(-|$)/i.test(lang)) {
    return format === "short"
      ? `${day} ${PT_SHORT_MONTHS[month - 1]} ${year}`
      : `${day} de ${PT_MONTHS[month - 1]} de ${year}`;
  }
  const options = { day: "numeric", month: format === "short" ? "short" : "long", year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat(lang, options).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * Checks a language tag: null if it works, otherwise the reason.
 * @param {string} lang
 * @returns {string|null}
 */
export function langError(lang) {
  if (typeof lang !== "string" || !lang) return "missing language";
  let supported;
  try {
    supported = Intl.DateTimeFormat.supportedLocalesOf(lang);
  } catch {
    return `"${lang}" is not a valid language tag (use the "en", "pt-BR", "es"… format)`;
  }
  return supported.length ? null : `Node does not know the language "${lang}"`;
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
