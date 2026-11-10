import { useEffect, useState } from 'react'

/**
 * Whether the tab is currently visible, via the Page Visibility API.
 *
 * Built for J7's bell poll, which re-reads the unread count on a short interval and must
 * stop while the tab is hidden (BR-06). That endpoint is hit by *every* open tab of
 * *every* user of the restaurant, so an unpaused poll multiplies across the team — a
 * four-person restaurant with three tabs each is twenty-four requests a minute for a
 * number nobody is looking at. This gate is also what makes the interval affordable at
 * all: shortening it costs nothing on tabs no one is watching.
 *
 * **Not redundant with React Query.** Its `refetchIntervalInBackground: false` default
 * suppresses interval refetches while the window is **blurred**, keyed off the focus
 * manager — which is not the same thing as `document.visibilityState`. A background tab
 * inside a focused browser window is exactly the case the focus manager does not
 * reliably cover, and it is also the most common one: people leave the portal open in a
 * tab and work elsewhere in the same window.
 *
 * Returns `true` on a platform with no Page Visibility support rather than `false`, so a
 * missing API degrades to "poll normally" instead of silently never polling.
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => !document.hidden)

  useEffect(() => {
    const onChange = () => setVisible(!document.hidden)

    document.addEventListener('visibilitychange', onChange)
    // Re-read on mount: the tab may have been hidden between the initial state and the
    // listener attaching.
    onChange()

    return () => {
      document.removeEventListener('visibilitychange', onChange)
    }
  }, [])

  return visible
}
