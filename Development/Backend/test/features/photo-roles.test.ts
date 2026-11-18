import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestServer, type TestServer } from '../helpers/server'

const P = '/partner/api/v1/partner/restaurant'
const PHOTO = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'E2E', 'tests', 'fixtures', 'dining.jpg'))
/** A small PNG standing in for the part the browser cut out. */
const CROPPED = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000004000000020802000000a2ba5d6e0000000f4944415478da63f8cfc0f01f0b0300f2f60ffe6d4b46a40000000049454e44ae426082',
  'hex',
)

/** Cover and profile picture are separate choices, each with its own crop (GM-320). */
describe('cover photo and profile picture', () => {
  let s: TestServer
  let token = ''

  async function call(method: string, url: string, body?: unknown) {
    const res = await fetch(s.base + url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    return { status: res.status, json: text ? JSON.parse(text) : null }
  }
  async function stage(kind: 'photos/upload-url' | 'photos/crop-upload-url', bytes: Buffer, contentType: string) {
    const target = await call('POST', `${P}/${kind}`, { name: contentType === 'image/png' ? 'crop.png' : 'dining.jpg', contentType })
    expect(target.status, JSON.stringify(target.json)).toBe(200)
    const put = await fetch(new URL(target.json.data.uploadUrl, s.base).toString(), { method: 'PUT', headers: { 'content-type': contentType }, body: bytes })
    expect(put.status).toBe(200)
    return target.json.data.uploadRef as string
  }
  const addPhoto = async () => (await call('POST', `${P}/photos`, { uploadRef: await stage('photos/upload-url', PHOTO, 'image/jpeg') })).json.data.mediaId as string
  const crop = async () => stage('photos/crop-upload-url', CROPPED, 'image/png')
  const gallery = async () => (await call('GET', `${P}/media`)).json.data.photos.items as Array<Record<string, unknown>>
  const profile = async () => (await call('GET', P)).json.data

  beforeAll(async () => {
    s = await startTestServer()
    const r = await fetch(`${s.base}/partner/api/v1/partner/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'partner@gomingle.com', password: 'Partner@123' }),
    })
    const j = (await r.json()) as { data?: { accessToken?: string }; accessToken?: string }
    token = j.data?.accessToken ?? j.accessToken ?? ''
  })
  afterAll(async () => {
    await s?.close()
  })

  let first = ''
  let second = ''

  it('makes the first photo the cover, whole, with no profile picture yet', async () => {
    first = await addPhoto()
    second = await addPhoto()
    const p = await profile()
    expect(p.coverPhotoUrl).toContain(`/${first}.jpg`)
    expect(p.profilePhotoUrl).toBeNull()
    expect((await gallery()).map((g) => [g.mediaId, g.isCover, g.isProfile])).toEqual([
      [first, true, false],
      [second, false, false],
    ])
    expect((await call('GET', `${P}/photo-roles`)).json.data).toEqual({ cover: { mediaId: first, crop: null }, profile: null })
  })

  it('crops the cover from one photo and the profile picture from another', async () => {
    const coverCrop = { x: 0, y: 0.25, width: 1, height: 0.5 }
    const c = await call('PUT', `${P}/photos/${second}/cover`, { crop: coverCrop, uploadRef: await crop() })
    expect(c.status, JSON.stringify(c.json)).toBe(200)
    expect(c.json.data).toMatchObject({ role: 'cover', cover: { mediaId: second, crop: coverCrop } })
    const coverUrl = c.json.data.coverPhotoUrl as string
    expect(coverUrl).toMatch(/\/crop-\d+\.jpg$/)

    const profileCrop = { x: 0.2, y: 0.1, width: 0.5, height: 0.75 }
    const pr = await call('PUT', `${P}/photos/${first}/profile`, { crop: profileCrop, uploadRef: await crop() })
    expect(pr.status, JSON.stringify(pr.json)).toBe(200)
    expect(pr.json.data.profile).toEqual({ mediaId: first, crop: profileCrop })

    const p = await profile()
    expect(p.coverPhotoUrl).toBe(coverUrl)
    expect(p.profilePhotoUrl).toMatch(/\/crop-\d+\.jpg$/)
    expect(p.profilePhotoUrl).not.toBe(coverUrl)
    // The cropped images are served as they were cut, and are not gallery photos.
    const served = await fetch(new URL(p.profilePhotoUrl, s.base).toString())
    expect(served.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await served.arrayBuffer())).toEqual(CROPPED)
    expect((await gallery()).map((g) => [g.mediaId, g.isCover, g.isProfile])).toEqual([
      [first, false, true],
      [second, true, false],
    ])
  })

  it('lets one photo be both, with different crops, and replaces the old cropped image', async () => {
    const before = (await profile()).coverPhotoUrl as string
    const r = await call('PUT', `${P}/photos/${first}/cover`, { crop: { x: 0, y: 0, width: 1, height: 0.375 }, uploadRef: await crop() })
    expect(r.status).toBe(200)
    const after = (await profile()).coverPhotoUrl as string
    expect(after).not.toBe(before)
    // The old cut is gone: its address falls back to the placeholder.
    const old = await fetch(new URL(before, s.base).toString())
    expect(old.headers.get('content-type')).toBe('image/svg+xml')
    expect((await gallery()).find((g) => g.mediaId === first)).toMatchObject({ isCover: true, isProfile: true })
  })

  it('refuses a crop outside the photo, a missing upload, extra fields and unknown roles', async () => {
    for (const bad of [
      { x: -0.1, y: 0, width: 0.5, height: 0.5 },
      { x: 0.6, y: 0, width: 0.5, height: 0.5 },
      { x: 0, y: 0, width: 0, height: 0.5 },
      { x: 0, y: 0, width: 0.5 },
      { x: 0, y: 0, width: 0.5, height: '0.5' },
      { x: 0, y: 0, width: 0.5, height: 0.5, rotate: 90 },
    ]) {
      const r = await call('PUT', `${P}/photos/${first}/profile`, { crop: bad, uploadRef: await crop() })
      expect(r.status, JSON.stringify(bad)).toBe(422)
    }
    expect((await call('PUT', `${P}/photos/${first}/profile`, { crop: { x: 0, y: 0, width: 1, height: 1 } })).status).toBe(422)
    expect((await call('PUT', `${P}/photos/${first}/profile`, { crop: { x: 0, y: 0, width: 1, height: 1 }, uploadRef: await crop(), isCover: true })).status).toBe(422)
    expect((await call('PUT', `${P}/photos/${first}/banner`, { crop: { x: 0, y: 0, width: 1, height: 1 }, uploadRef: await crop() })).status).toBe(404)
    expect((await call('PUT', `${P}/photos/photo-999/profile`, { crop: { x: 0, y: 0, width: 1, height: 1 }, uploadRef: await crop() })).status).toBe(404)
  })

  it('does not count cropped images against the 20-photo gallery limit', async () => {
    const count = (await gallery()).length
    expect(count).toBe(2)
    const ref = await crop()
    expect(ref).toBeTruthy()
    expect((await gallery()).length).toBe(2)
  })

  it('clears the profile picture when asked, or when its photo is deleted', async () => {
    expect((await call('DELETE', `${P}/profile-photo`)).status).toBe(200)
    expect((await profile()).profilePhotoUrl).toBeNull()
    await call('PUT', `${P}/photos/${second}/profile`, { crop: { x: 0, y: 0, width: 1, height: 1 }, uploadRef: await crop() })
    expect((await profile()).profilePhotoUrl).not.toBeNull()
    const removed = await call('DELETE', `${P}/photos/${second}`)
    expect(removed.json.data).toMatchObject({ removed: true, profileCleared: true })
    expect((await profile()).profilePhotoUrl).toBeNull()
  })

  it('keeps the old cover rules: no deleting the cover while others remain; the last photo takes the cover with it', async () => {
    const third = await addPhoto()
    const blocked = await call('DELETE', `${P}/photos/${first}`)
    expect(blocked.status).toBe(409)
    expect(blocked.json.error.code).toBe('ERR_COVER_PHOTO_REASSIGN')
    await call('DELETE', `${P}/photos/${third}`)
    expect((await call('DELETE', `${P}/photos/${first}`)).status).toBe(200)
    const p = await profile()
    expect(p.coverPhotoUrl).toBeNull()
    expect(p.visibleOnApp).toBe(false)
    expect((await call('GET', `${P}/photo-roles`)).json.data).toEqual({ cover: null, profile: null })
  })
})
