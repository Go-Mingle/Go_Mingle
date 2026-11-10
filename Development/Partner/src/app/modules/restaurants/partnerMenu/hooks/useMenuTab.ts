import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import { useMenuOptionsTab } from './useMenuOptionsTab'
import { useMenuPdfSection } from './useMenuPdfSection'

/**
 * The Menu Options tab, both halves.
 *
 * The PDF and the combos share nothing but the screen — separate endpoints,
 * separate cache keys, separate empty states — so they stay separate
 * controllers. This composes them so the page gains one hook call and one prop,
 * as with the other four contract-backed tabs.
 */
export function useMenuTab(editable: boolean, feedback: ProfileFeedback) {
  const pdf = useMenuPdfSection(editable, feedback)
  const options = useMenuOptionsTab(editable, feedback)

  return { pdf, options }
}

export type MenuTab = ReturnType<typeof useMenuTab>
