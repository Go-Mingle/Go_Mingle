/**
 * MET-1282 — host validation for the webhook endpoint (TC-PARTNER-WEBHOOK-009).
 *
 * The scheme check on its own accepted `https://no-tld`: syntactically a URL,
 * https, well under the length cap — and a host that can never resolve. The
 * partner ends up with a green configuration while every delivery fails with
 * `ERR_WEBHOOK_ENDPOINT_UNRESOLVED`, so the host is checked too.
 *
 * Shared deliberately: the page validates with it so the message lands inline,
 * and the mock API rejects with it so the 422 path stays reachable in tests.
 */

/**
 * A dotted name whose last label is a plausible TLD — `example.com`,
 * `a.b.co.uk`. Bare hosts (`no-tld`, `localhost`) have no dot and are refused;
 * nothing on the public internet can route to them.
 */
const DOTTED_HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i

/** A literal IPv4 address is deliverable even though its last label is numeric. */
const IPV4_HOST = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

/** `new URL()` keeps IPv6 literals bracketed — `[2001:db8::1]`. */
const IPV6_HOST = /^\[[0-9a-f:.]+\]$/i

/**
 * Whether `hostname` (as `URL` reports it — already lowercased and punycoded)
 * names something a delivery could reach.
 */
export function isDeliverableWebhookHost(hostname: string): boolean {
  return DOTTED_HOST.test(hostname) || IPV4_HOST.test(hostname) || IPV6_HOST.test(hostname)
}
