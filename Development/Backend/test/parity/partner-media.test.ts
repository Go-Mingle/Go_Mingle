import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Parity, type PerSide, type StepResult } from '../helpers/parity'

const P = '/partner/api/v1/partner'
const R = `${P}/restaurant`
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 9, 9])
const PDF = Buffer.from('%PDF-1.4 licence')

/** Documents, photos, videos and the three-step upload. */
describe('parity: partner media', () => {
  let p: Parity
  beforeAll(async () => {
    p = await Parity.start()
  })
  afterAll(async () => {
    await p?.stop()
  })

  it('matches the old API', async () => {
    const login = await p.req('login', 'POST', `${P}/auth/login`, { body: { email: 'partner@gomingle.com', password: 'Partner@123' } })
    p.tokens.partner = login.get('accessToken')
    const A = { as: 'partner' }
    const both = (b: Buffer) => ({ old: b, neu: b })

    /** Steps 1 and 2: get a target and send the bytes. Returns the uploadRef per side. */
    const stage = async (label: string, plural: string, name: string, type: string, bytes: Buffer | null): Promise<PerSide<string>> => {
      const target = await p.req(`${label} target`, 'POST', `${R}/${plural}/upload-url`, { ...A, body: { name, contentType: type } })
      const urls = target.get('data.uploadUrl')
      if (bytes) {
        const put = await p.req(`${label} put`, plural === 'videos' ? 'POST' : 'PUT', (s) => urls[s], { raw: both(bytes), contentType: type, compare: false })
        expect(put.neu.status, label).toBe(put.old.status)
      }
      return target.get('data.uploadRef')
    }
    const commit = (label: string, plural: string, ref: PerSide<string>, extra: object = {}): Promise<StepResult> =>
      p.req(`${label} commit`, 'POST', `${R}/${plural}`, { ...A, body: (s) => ({ uploadRef: ref[s], ...extra }) })

    await p.req('documents empty', 'GET', `${R}/documents`, A)
    await p.req('gallery empty', 'GET', `${R}/media`, A)
    await p.req('target no name', 'POST', `${R}/documents/upload-url`, { ...A, body: { contentType: 'application/pdf' } })
    await p.req('commit no ref', 'POST', `${R}/documents`, { ...A, body: {} })
    await p.req('commit unknown ref', 'POST', `${R}/documents`, { ...A, body: { uploadRef: 'u-99' } })

    // Documents
    const d1 = await stage('doc', 'documents', 'Trade Licence.pdf', 'application/pdf', PDF)
    await commit('doc extra field', 'documents', d1, { name: 'x' })
    const doc = await commit('doc', 'documents', d1)
    const docId = doc.get('data.mediaId')
    expect(docId.neu).toBe(docId.old)
    await commit('doc again', 'documents', d1)
    const d2 = await stage('doc never uploaded', 'documents', 'b.pdf', 'application/pdf', null)
    await commit('doc never uploaded', 'documents', d2)
    const d3 = await stage('doc wrong bytes', 'documents', 'c.pdf', 'application/pdf', PNG)
    await commit('doc wrong bytes', 'documents', d3)
    const d4 = await stage('doc empty', 'documents', 'e.pdf', 'application/pdf', Buffer.alloc(0))
    await commit('doc empty', 'documents', d4)
    const d5 = await stage('doc png', 'documents', 'Floor plan.png', 'image/png', PNG)
    await commit('doc png', 'documents', d5)
    const d6 = await stage('doc wrong kind', 'documents', 'k.pdf', 'application/pdf', PDF)
    await commit('doc as photo', 'photos', d6)
    await p.req('documents', 'GET', `${R}/documents`, A)
    await p.req('documents sorted', 'GET', `${R}/documents?sortBy=size&sortOrder=desc`, A)
    await p.req('documents by type', 'GET', `${R}/documents?sortBy=type&search=floor`, A)
    await p.req('documents bad sort', 'GET', `${R}/documents?sortBy=nope`, A)
    await p.req('documents bad order', 'GET', `${R}/documents?sortOrder=up`, A)
    const dl = await p.req('download url', 'GET', (s) => `${R}/documents/${docId[s]}/download-url`, A)
    const dlUrl = dl.get('data.downloadUrl')
    const got = await p.req('download', 'GET', (s) => dlUrl[s], { compare: false })
    expect(got.neu.status).toBe(got.old.status)
    // The new server returns the stored file; the old one returned an empty page.
    expect(got.neu.text).toBe(PDF.toString())
    await p.req('download url missing', 'GET', `${R}/documents/doc-99/download-url`, A)
    const bad = await p.req('put unknown ref', 'PUT', (s) => dlUrl[s].replace(/signed-get\/.*/, 'u-404'), { raw: both(PDF), contentType: 'application/pdf', compare: false })
    expect(bad.neu.status).toBe(bad.old.status)

    // Photos: the first becomes the cover
    const p1 = await stage('photo', 'photos', 'dining.jpg', 'image/jpeg', JPEG)
    const photo1 = await commit('photo', 'photos', p1)
    const photo1Id = photo1.get('data.mediaId')
    expect(photo1.neu.json.data.becameCover).toBe(true)
    const img = await p.req('cdn photo', 'GET', (s) => photo1.get('data.url')[s], { compare: false })
    expect(img.neu.status).toBe(200)
    expect(Buffer.from(img.neu.text, 'latin1').length).toBe(Buffer.from(img.old.text, 'latin1').length)
    expect(img.neu.headers.get('content-type')).toBe(img.old.headers.get('content-type'))
    expect(img.neu.headers.get('cache-control')).toBe(img.old.headers.get('cache-control'))
    const placeholder = await p.req('cdn placeholder', 'GET', (s) => photo1.get('data.url')[s].replace(/[^/]+$/, 'nothing-here.jpg'), { compare: false })
    expect(placeholder.neu.text).toBe(placeholder.old.text)
    expect(placeholder.neu.headers.get('content-type')).toBe(placeholder.old.headers.get('content-type'))
    await p.req('profile has cover', 'GET', R, A)
    const p2 = await stage('photo 2', 'photos', 'bar.png', 'image/png', PNG)
    const photo2 = await commit('photo 2', 'photos', p2)
    const photo2Id = photo2.get('data.mediaId')
    await p.req('gallery', 'GET', `${R}/media`, A)
    await p.req('delete cover refused', 'DELETE', (s) => `${R}/photos/${photo1Id[s]}`, A)
    await p.req('set cover', 'PATCH', (s) => `${R}/photos/${photo2Id[s]}/cover`, A)
    await p.req('set cover missing', 'PATCH', `${R}/photos/photo-99/cover`, A)
    await p.req('gallery new cover', 'GET', `${R}/media`, A)
    await p.req('delete photo', 'DELETE', (s) => `${R}/photos/${photo1Id[s]}`, A)
    await p.req('delete photo again', 'DELETE', (s) => `${R}/photos/${photo1Id[s]}`, A)
    await p.req('delete last photo', 'DELETE', (s) => `${R}/photos/${photo2Id[s]}`, A)
    await p.req('profile lost cover', 'GET', R, A)
    const p3 = await stage('photo 3', 'photos', 'terrace.jpg', 'image/jpeg', JPEG)
    await commit('photo 3', 'photos', p3)
    const p4 = await stage('photo bad', 'photos', 'bad.jpg', 'image/jpeg', PDF)
    await commit('photo bad', 'photos', p4)

    // Videos: processing, then ready on the next gallery read
    const v1 = await stage('video', 'videos', 'tour.mp4', 'video/mp4', Buffer.from('mp4-bytes'))
    const video = await commit('video', 'videos', v1)
    const videoId = video.get('data.mediaId')
    await p.req('gallery video ready', 'GET', `${R}/media`, A)
    await p.req('gallery again', 'GET', `${R}/media`, A)
    const v2 = await stage('video 2', 'videos', 'kitchen.mp4', 'video/mp4', Buffer.from('more'))
    await commit('video 2', 'videos', v2)
    await p.req('delete video', 'DELETE', (s) => `${R}/videos/${videoId[s]}`, A)
    await p.req('delete video again', 'DELETE', (s) => `${R}/videos/${videoId[s]}`, A)
    await p.req('delete document', 'DELETE', (s) => `${R}/documents/${docId[s]}`, A)
    await p.req('delete document again', 'DELETE', (s) => `${R}/documents/${docId[s]}`, A)
    await p.req('gallery end', 'GET', `${R}/media`, A)
    await p.req('documents end', 'GET', `${R}/documents`, A)
    await p.req('no token', 'GET', `${R}/media`)

    expect(p.differences, p.report()).toEqual([])
  })
})
