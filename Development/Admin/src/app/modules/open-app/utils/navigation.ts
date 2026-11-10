/**
 * Thin wrappers around full-page navigation. Kept in their own module so the
 * redirect flow can be unit tested — jsdom refuses real navigation, and mocking
 * `window.location` wholesale is brittle.
 */

/** Attempts a custom-scheme deep link; a no-op to the user if no app handles it. */
export function openUrl(url: string): void {
  window.location.href = url
}

/** Leaves for `url` without adding a history entry, so Back skips this page. */
export function replaceUrl(url: string): void {
  window.location.replace(url)
}
