/**
 * Teal text-link styling shared across the auth flow — used for "Forgot
 * password?", the "Back to sign in" / "Back" links, and "Resend code".
 * Matches the forgot-password link in LoginStep.
 *
 * The hover underline is suppressed on mobile (touch) so the responsive
 * login / forgot-password flows carry no hover affordance.
 */
export const authLinkClass = (isMobile: boolean): string =>
  `text-[13px] text-[var(--color-accent)] transition-colors${isMobile ? '' : ' hover:underline'}`
