import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestServer, type TestServer } from '../helpers/server'

const A = '/admin/api/v1'
const P = '/partner/api/v1/partner'

/** Admins can give an amenity an icon from the built-in library instead of uploading one (GM-333). */
describe('amenity icon library', () => {
  let s: TestServer
  let admin = ''
  let partner = ''

  const form = async (method: string, url: string, fields: Record<string, string>) => {
    const fd = new FormData()
    for (const [k, v] of Object.entries(fields)) fd.append(k, v)
    const res = await fetch(s.base + url, { method, headers: { Authorization: `Bearer ${admin}` }, body: fd })
    return { status: res.status, json: (await res.json()) as any }
  }

  beforeAll(async () => {
    s = await startTestServer()
    const post = (url: string, body: unknown) =>
      fetch(s.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json() as Promise<any>)
    admin = (await post(`${A}/auth/login`, { email: 'admin@gomingle.com', password: 'Admin@123' })).accessToken
    const login = await post(`${P}/auth/login`, { email: 'partner@gomingle.com', password: 'Partner@123' })
    partner = login.accessToken ?? login.data.accessToken
  })
  afterAll(async () => {
    await s?.close()
  })

  it('stores a library icon by name and serves it as an SVG', async () => {
    const created = await form('POST', `${A}/amenities`, { name: 'EV charging bays', iconName: 'ChargingStation' })
    expect(created.status).toBe(201)
    expect(created.json.data.iconUrl).toBe('ChargingStation')

    const icon = await fetch(`${s.base}/amenity-icons/${created.json.data.id}.svg`)
    expect(icon.headers.get('content-type')).toContain('image/svg+xml')
    const svg = await icon.text()
    expect(svg.startsWith('<svg')).toBe(true)

    // Partners see it in their catalogue with the icon endpoint.
    const list = await fetch(`${s.base}${P}/restaurant/amenities`, { headers: { Authorization: `Bearer ${partner}` } }).then((r) => r.json() as Promise<any>)
    const mine = list.data.items.find((a: { name: string }) => a.name === 'EV charging bays')
    expect(mine.iconUrl).toContain(`/amenity-icons/${created.json.data.id}.svg`)
  })

  it('switches between a library icon, an upload and back', async () => {
    const { json } = await form('POST', `${A}/amenities`, { name: 'Prayer room', iconName: 'HandsPraying' })
    const id = json.data.id

    const fd = new FormData()
    fd.append('icon', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' }), 'p.svg')
    const uploaded = await fetch(`${s.base}${A}/amenities/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${admin}` }, body: fd }).then(
      (r) => r.json() as Promise<any>,
    )
    expect(uploaded.data.iconUrl).toMatch(/^data:image\/svg\+xml;base64,/)

    const back = await form('PATCH', `${A}/amenities/${id}`, { iconName: 'Mosque' })
    expect(back.status).toBe(200)
    expect(back.json.data.iconUrl).toBe('Mosque')
  })

  it('rejects names that are not in the library', async () => {
    for (const iconName of ['NotARealIcon', '../../etc/passwd', 'wifi-high', '<svg>']) {
      const r = await form('POST', `${A}/amenities`, { name: `Bad ${iconName}`, iconName })
      expect(r.status, iconName).toBe(422)
      expect(r.json.code ?? r.json.error?.code).toBe('ERR_VALIDATION')
    }
    const { json } = await form('POST', `${A}/amenities`, { name: 'Valid for patch' })
    const bad = await form('PATCH', `${A}/amenities/${json.data.id}`, { iconName: 'Nope' })
    expect(bad.status).toBe(422)
  })
})
