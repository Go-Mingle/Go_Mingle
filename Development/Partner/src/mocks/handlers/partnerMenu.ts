import { http } from 'msw'
import { PARTNER_MENU_ENDPOINTS } from '../../app/modules/restaurants/partnerMenu/constants'
import {
  commitMockMenuPdf,
  createMockMenuOption,
  deleteMockMenuOption,
  deleteMockMenuPdf,
  getMockMenuPdf,
  listMockMenuOptions,
  mockMenuPdfUploadTarget,
  MOCK_MENU_UPLOAD_ORIGIN,
  receiveMockMenuPdf,
  setMockMenuOptionVisibility,
  updateMockMenuOption,
} from '../data/partnerMenu'

/**
 * J6D's nine client-callable endpoints, plus the direct upload target.
 *
 * The literal sub-paths (`/upload-url`, `/{comboId}/visibility`) are registered
 * before the parameterised routes so they are not swallowed as a `comboId` — the
 * same ordering J6A and J6B needed.
 */

/**
 * What the upload carried — its length for the commit-time size check, and its
 * first few bytes for the content check (MET-1148). Both stand in for the real
 * server inspecting the stored object.
 */
async function uploadedObject(request: Request): Promise<{ size: number; leading: number[] }> {
  const buffer = await request.arrayBuffer().catch(() => new ArrayBuffer(0))
  // Four is the longest signature we check; reading more would be dead weight.
  return { size: buffer.byteLength, leading: [...new Uint8Array(buffer.slice(0, 4))] }
}

export const partnerMenuHandlers = [
  // ── The menu PDF ─────────────────────────────────────────────
  http.post(PARTNER_MENU_ENDPOINTS.menuPdfUploadUrl, async ({ request }) =>
    mockMenuPdfUploadTarget((await request.json()) as Record<string, unknown>),
  ),

  http.get(PARTNER_MENU_ENDPOINTS.menuPdf, () => getMockMenuPdf()),

  http.put(PARTNER_MENU_ENDPOINTS.menuPdf, async ({ request }) =>
    commitMockMenuPdf((await request.json()) as Record<string, unknown>),
  ),

  http.delete(PARTNER_MENU_ENDPOINTS.menuPdf, () => deleteMockMenuPdf()),

  // ── Menu options ─────────────────────────────────────────────
  http.patch(PARTNER_MENU_ENDPOINTS.menuOptionVisibility(':comboId'), async ({ params, request }) =>
    setMockMenuOptionVisibility(
      String(params.comboId),
      (await request.json()) as Record<string, unknown>,
    ),
  ),

  http.get(PARTNER_MENU_ENDPOINTS.menuOptions, () => listMockMenuOptions()),

  http.post(PARTNER_MENU_ENDPOINTS.menuOptions, async ({ request }) =>
    createMockMenuOption((await request.json()) as Record<string, unknown>),
  ),

  http.patch(PARTNER_MENU_ENDPOINTS.menuOptionById(':comboId'), async ({ params, request }) =>
    updateMockMenuOption(String(params.comboId), (await request.json()) as Record<string, unknown>),
  ),

  http.delete(PARTNER_MENU_ENDPOINTS.menuOptionById(':comboId'), ({ params }) =>
    deleteMockMenuOption(String(params.comboId)),
  ),

  // ── The direct upload target (step 2) ────────────────────────
  /**
   * Stands in for the presigned S3 PUT. Recording the upload is what lets commit
   * refuse a reference whose bytes never landed.
   */
  http.put(`${MOCK_MENU_UPLOAD_ORIGIN}/:uploadRef`, async ({ params, request }) => {
    const { size, leading } = await uploadedObject(request)
    return receiveMockMenuPdf(String(params.uploadRef), size, leading)
  }),
]
