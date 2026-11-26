/*
 * Reading time: "3 min read".
 *
 * Words (pieces separated by spaces, line breaks or tabs) divided by words
 * read per minute, rounded up. Never less than 1.
 */

/**
 * @param {string} text the post body.
 * @param {number} [wordsPerMinute=200]
 * @returns {number} whole minutes, at least 1.
 */
export function readingTime(text, wordsPerMinute = 200) {
  const words = String(text).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}
