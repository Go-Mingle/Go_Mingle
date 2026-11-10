import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Parity, type PerSide } from '../helpers/parity'

const BOUNDARY = 'gm-parity-boundary'
function multipart(fields: Record<string, string | { name: string; type: string; text: string }>) {
  const parts = Object.entries(fields).map(([key, value]) =>
    typeof value === 'string'
      ? `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
      : `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${key}"; filename="${value.name}"\r\nContent-Type: ${value.type}\r\n\r\n${value.text}\r\n`,
  )
  const body = `${parts.join('')}--${BOUNDARY}--\r\n`
  return { raw: { old: body, neu: body }, contentType: `multipart/form-data; boundary=${BOUNDARY}` }
}

/** Categories, amenities, interests, topics, preference questions, loyalty and uploads. */
describe('parity: admin catalogues', () => {
  let p: Parity
  beforeAll(async () => {
    p = await Parity.start()
  })
  afterAll(async () => {
    await p?.stop()
  })

  it('matches the old API', async () => {
    await p.loginAdmin()
    const A = { as: 'admin' }
    const at = (ids: PerSide<string>, suffix = '') => (s: 'old' | 'neu') => `${suffix.split('|')[0]}${ids[s]}${suffix.split('|')[1] ?? ''}`

    // Starter data on a fresh install
    await p.req('amenities start', 'GET', '/admin/api/v1/amenities', A)
    await p.req('amenities active', 'GET', '/admin/api/v1/amenities/active', A)
    await p.req('interests start', 'GET', '/admin/api/v1/interests?pageSize=100', A)
    await p.req('interests page 2', 'GET', '/admin/api/v1/interests?page=2', A)
    await p.req('interests active', 'GET', '/admin/api/v1/interests/active', A)
    await p.req('topics start', 'GET', '/admin/api/v1/topics', A)
    await p.req('topics active', 'GET', '/admin/api/v1/topics/active', A)
    await p.req('questions start', 'GET', '/admin/api/v1/preference-questions', A)
    await p.req('questions active', 'GET', '/admin/api/v1/preference-questions/active', A)
    await p.req('categories start', 'GET', '/admin/api/v1/categories', A)
    await p.req('no token', 'GET', '/admin/api/v1/categories')

    // Categories
    const cat = await p.req('create category', 'POST', '/admin/api/v1/categories', { ...A, body: { name: 'Premium', commissionRate: 12 } })
    const catId = cat.get('id')
    await p.req('duplicate category', 'POST', '/admin/api/v1/categories', { ...A, body: { name: 'premium', commissionRate: 5 } })
    await p.req('create category 2', 'POST', '/admin/api/v1/categories', { ...A, body: { name: 'Standard', commissionRate: 8 } })
    await p.req('categories', 'GET', '/admin/api/v1/categories', A)
    await p.req('categories active', 'GET', '/admin/api/v1/categories/active', A)
    await p.req('category', 'GET', at(catId, '/admin/api/v1/categories/'), A)
    await p.req('category missing', 'GET', '/admin/api/v1/categories/nope', A)
    await p.req('patch category', 'PATCH', at(catId, '/admin/api/v1/categories/'), { ...A, body: { commissionRate: 15 } })
    await p.req('patch category dup', 'PATCH', at(catId, '/admin/api/v1/categories/'), { ...A, body: { name: 'STANDARD' } })
    await p.req('patch category missing', 'PATCH', '/admin/api/v1/categories/nope', { ...A, body: { name: 'x' } })
    await p.req('delete category missing', 'DELETE', '/admin/api/v1/categories/nope', A)
    await p.req('delete category', 'DELETE', at(catId, '/admin/api/v1/categories/'), A)

    // Amenities (multipart)
    await p.req('amenity no name', 'POST', '/admin/api/v1/amenities', { ...A, ...multipart({ name: '  ' }) })
    await p.req('amenity duplicate', 'POST', '/admin/api/v1/amenities', { ...A, ...multipart({ name: 'free wi-fi' }) })
    const am = await p.req('amenity create', 'POST', '/admin/api/v1/amenities', { ...A, ...multipart({ name: 'Shisha Lounge' }) })
    const amId = am.get('data.id')
    expect(amId.neu).toBe(amId.old)
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>'
    const am2 = await p.req('amenity with icon', 'POST', '/admin/api/v1/amenities', {
      ...A,
      ...multipart({ name: 'Rooftop Shisha', icon: { name: 's.svg', type: 'image/svg+xml', text: svg } }),
      ignore: [],
    })
    expect(am2.neu.json.data.iconUrl).toBe(am2.old.json.data.iconUrl)
    await p.req('amenity get', 'GET', at(amId, '/admin/api/v1/amenities/'), A)
    await p.req('amenity missing', 'GET', '/admin/api/v1/amenities/nope', A)
    await p.req('amenity rename', 'PATCH', at(amId, '/admin/api/v1/amenities/'), { ...A, ...multipart({ name: 'Shisha Terrace' }) })
    await p.req('amenity rename dup', 'PATCH', at(amId, '/admin/api/v1/amenities/'), { ...A, ...multipart({ name: 'Sea View' }) })
    await p.req('amenity new icon', 'PATCH', at(amId, '/admin/api/v1/amenities/'), {
      ...A,
      ...multipart({ icon: { name: 'n.svg', type: 'image/svg+xml', text: '<svg/>' } }),
    })
    await p.req('amenity reset icon', 'PATCH', at(amId, '/admin/api/v1/amenities/'), { ...A, ...multipart({ resetIcon: 'true' }) })
    await p.req('amenity patch missing', 'PATCH', '/admin/api/v1/amenities/nope', { ...A, ...multipart({ name: 'x' }) })
    await p.req('amenities search', 'GET', '/admin/api/v1/amenities?q=sea&sortOrder=desc', A)
    await p.req('amenities by count', 'GET', '/admin/api/v1/amenities?sortBy=count&pageSize=50&page=9', A)
    await p.req('amenity delete', 'DELETE', at(amId, '/admin/api/v1/amenities/'), A)
    await p.req('amenity delete again', 'DELETE', at(amId, '/admin/api/v1/amenities/'), A)
    const icons = await p.req('amenity icon', 'GET', '/amenity-icons/am-free-wi-fi.svg', { compare: false })
    expect(icons.neu.status).toBe(icons.old.status)
    expect(icons.neu.text).toBe(icons.old.text)
    expect(icons.neu.headers.get('content-type')).toBe(icons.old.headers.get('content-type'))
    const custom = await p.req('amenity custom icon', 'GET', at(am2.get('data.id'), '/amenity-icons/|.svg'), { compare: false })
    expect(custom.neu.text).toBe(svg)
    expect(custom.old.text).toBe(svg)
    const missingIcon = await p.req('amenity icon missing', 'GET', '/amenity-icons/nope.svg', { compare: false })
    expect(missingIcon.neu.status).toBe(missingIcon.old.status)

    // Interests
    const int = await p.req('interest create', 'POST', '/admin/api/v1/interests', { ...A, body: { name: 'Karaoke', groupName: 'Arts & Culture' } })
    const intId = int.get('data.id')
    await p.req('interest duplicate', 'POST', '/admin/api/v1/interests', { ...A, body: { name: 'karaoke', groupName: 'x' } })
    await p.req('interest get', 'GET', at(intId, '/admin/api/v1/interests/'), A)
    await p.req('interest missing', 'GET', '/admin/api/v1/interests/nope', A)
    await p.req('interest patch', 'PATCH', at(intId, '/admin/api/v1/interests/'), { ...A, body: { name: 'Karaoke Nights' } })
    await p.req('interest patch dup', 'PATCH', at(intId, '/admin/api/v1/interests/'), { ...A, body: { name: 'cricket' } })
    await p.req('interest patch missing', 'PATCH', '/admin/api/v1/interests/nope', { ...A, body: { name: 'x' } })

    // Uploads + topics
    const signed = await p.req('signed url', 'POST', '/admin/api/v1/uploads/signed-url', {
      ...A,
      body: { fileName: 'g.png', contentType: 'image/png', purpose: 'TOPIC_GRAPHIC' },
    })
    const keys = signed.get('data.key')
    expect(keys.neu).toMatch(/^topics\/[0-9a-f-]+\.png$/)
    const uploadUrl = signed.get('data.uploadUrl')
    const put = await p.req('bucket put', 'PUT', (s) => uploadUrl[s], { raw: { old: 'PNGDATA', neu: 'PNGDATA' }, contentType: 'image/png', compare: false })
    expect(put.neu.status).toBe(put.old.status)
    const topic = await p.req('topic create', 'POST', '/admin/api/v1/topics', {
      ...A,
      body: (s) => ({ name: 'Board Games', description: null, interestIds: [intId[s], 'in-chai', 'nope'], graphicKey: keys[s] }),
    })
    const topicId = topic.get('data.id')
    const graphic = topic.get('data.graphicUrl')
    const img = await p.req('bucket get', 'GET', (s) => graphic[s], { compare: false })
    expect(img.neu.status).toBe(200)
    expect(img.neu.text).toBe(img.old.text)
    expect(img.neu.headers.get('content-type')).toBe(img.old.headers.get('content-type'))
    expect(img.neu.headers.get('cache-control')).toBe(img.old.headers.get('cache-control'))
    const noImg = await p.req('bucket missing', 'GET', '/mock-bucket/topics/missing.png', { compare: false })
    expect(noImg.neu.status).toBe(noImg.old.status)
    await p.req('signed url cover', 'POST', '/admin/api/v1/uploads/signed-url', { ...A, body: { contentType: 'image/jpeg', purpose: 'INTEREST_TABLE_COVER' } })
    await p.req('topic get', 'GET', at(topicId, '/admin/api/v1/topics/'), A)
    await p.req('topic missing', 'GET', '/admin/api/v1/topics/nope', A)
    await p.req('interest renamed later', 'PATCH', at(intId, '/admin/api/v1/interests/'), { ...A, body: { groupName: 'Lifestyle' } })
    await p.req('topic keeps snapshot', 'GET', at(topicId, '/admin/api/v1/topics/'), A)
    await p.req('topic patch', 'PATCH', at(topicId, '/admin/api/v1/topics/'), { ...A, body: { name: 'Board Game Night', description: 'Dice and chai', interestIds: ['in-chai'] } })
    await p.req('topic patch missing', 'PATCH', '/admin/api/v1/topics/nope', { ...A, body: { name: 'x' } })
    await p.req('topics search', 'GET', '/admin/api/v1/topics?q=table&sortOrder=desc', A)
    await p.req('interest delete', 'DELETE', at(intId, '/admin/api/v1/interests/'), A)
    await p.req('topic delete', 'DELETE', at(topicId, '/admin/api/v1/topics/'), A)
    await p.req('topics after', 'GET', '/admin/api/v1/topics?pageSize=100', A)

    // Preference questions
    await p.req('question dup', 'POST', '/admin/api/v1/preference-questions', {
      ...A,
      body: (s) => ({ question: s ? 'x' : 'x', type: 'SINGLE', questionOrder: 1, options: [{ text: 'a' }] }),
    })
    const pq = await p.req('question create', 'POST', '/admin/api/v1/preference-questions', {
      ...A,
      body: { question: 'Tea or coffee?', type: 'SINGLE_SELECT', questionOrder: 2, options: [{ text: 'Tea' }, { text: 'Coffee' }] },
    })
    const pqId = pq.get('data.id')
    await p.req('questions after create', 'GET', '/admin/api/v1/preference-questions?pageSize=25', A)
    await p.req('question same text', 'POST', '/admin/api/v1/preference-questions', {
      ...A,
      body: { question: 'tea or coffee?', type: 'SINGLE_SELECT', questionOrder: 1, options: [{ text: 'a' }, { text: 'b' }] },
    })
    await p.req('question get', 'GET', at(pqId, '/admin/api/v1/preference-questions/'), { ...A, ignore: [] })
    await p.req('question missing', 'GET', '/admin/api/v1/preference-questions/nope', A)
    const optIds = (await p.req('question detail', 'GET', at(pqId, '/admin/api/v1/preference-questions/'), A)).get('data.options')
    await p.req('question patch', 'PATCH', at(pqId, '/admin/api/v1/preference-questions/'), {
      ...A,
      body: (s) => ({ question: 'Chai or coffee?', questionOrder: 5, options: [{ text: 'Both' }, { id: optIds[s][1].id, text: 'Coffee!' }, { id: optIds[s][0].id, text: 'Chai' }] }),
    })
    await p.req('question after patch', 'GET', at(pqId, '/admin/api/v1/preference-questions/'), A)
    await p.req('question few options', 'PATCH', at(pqId, '/admin/api/v1/preference-questions/'), { ...A, body: { options: [{ text: 'one' }] } })
    await p.req('question patch missing', 'PATCH', '/admin/api/v1/preference-questions/nope', { ...A, body: { question: 'x' } })
    await p.req('questions sorted', 'GET', '/admin/api/v1/preference-questions?sortBy=question&sortOrder=desc&q=o&pageSize=50', A)
    await p.req('question delete', 'DELETE', at(pqId, '/admin/api/v1/preference-questions/'), A)
    await p.req('question delete again', 'DELETE', at(pqId, '/admin/api/v1/preference-questions/'), A)
    await p.req('questions end', 'GET', '/admin/api/v1/preference-questions/active', A)

    // Loyalty (who changed it is the real admin now, not a placeholder)
    const who = ['data.earnUpdatedBy', 'data.redeemUpdatedBy']
    await p.req('loyalty', 'GET', '/admin/api/v1/loyalty-configuration', A)
    await p.req('loyalty earn', 'PATCH', '/admin/api/v1/loyalty-configuration/earn-rate', { ...A, body: { pkrSpentToEarn1Point: 20 }, ignore: who })
    await p.req('loyalty redeem', 'PATCH', '/admin/api/v1/loyalty-configuration/redeem-rate', { ...A, body: { pointsNeededForPkr1Off: 80 }, ignore: who })
    const loyalty = await p.req('loyalty after', 'GET', '/admin/api/v1/loyalty-configuration', { ...A, ignore: who })
    expect(loyalty.neu.json.data.earnUpdatedBy).toEqual({ id: 'u1', name: 'Hira Mansoor' })

    await p.req('change log', 'GET', '/admin/api/v1/change-log', A)
    expect(p.differences, p.report()).toEqual([])
  })
})
