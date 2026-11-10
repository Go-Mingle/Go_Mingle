import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Parity } from '../helpers/parity'

const P = '/partner/api/v1/partner'

/** Partner sign-in, sign-up, session, restaurant profile and contacts. */
describe('parity: partner access and profile', () => {
  let p: Parity
  beforeAll(async () => {
    p = await Parity.start()
  })
  afterAll(async () => {
    await p?.stop()
  })

  it('matches the old API', async () => {
    // Sign-in
    await p.req('login wrong', 'POST', `${P}/auth/login`, { body: { email: 'partner@gomingle.com', password: 'nope' } })
    await p.req('login unknown', 'POST', `${P}/auth/login`, { body: { email: 'x@y.z', password: 'nope' } })
    const login = await p.req('login', 'POST', `${P}/auth/login`, { body: { email: 'partner@gomingle.com', password: 'Partner@123' } })
    p.tokens.partner = login.get('accessToken')
    expect(p.tokens.partner.neu).toBeTruthy()
    const A = { as: 'partner' }
    await p.req('admin token on partner route', 'GET', `${P}/session`, { as: 'nobody' })
    await p.loginAdmin()
    await p.req('admin token rejected', 'GET', `${P}/session`, { as: 'admin' })
    await p.req('partner token rejected by admin', 'GET', '/admin/api/v1/roles', A)
    await p.req('refresh bad', 'POST', `${P}/auth/refresh`, { body: { refreshToken: 'x' } })
    const refreshed = await p.req('refresh', 'POST', `${P}/auth/refresh`, { body: (s) => ({ refreshToken: login.get('refreshToken')[s] }) })
    expect(refreshed.neu.status).toBe(200)
    await p.req('refresh reuse', 'POST', `${P}/auth/refresh`, { body: (s) => ({ refreshToken: login.get('refreshToken')[s] }) })
    await p.req('forgot', 'POST', `${P}/auth/forgot-password`, { body: { email: 'partner@gomingle.com' } })
    await p.req('confirm forgot wrong', 'POST', `${P}/auth/confirm-forgot-password`, { body: { email: 'partner@gomingle.com', code: '999999', newPassword: 'New@12345' } })
    await p.req('confirm forgot weak', 'POST', `${P}/auth/confirm-forgot-password`, { body: { email: 'partner@gomingle.com', code: '123456', newPassword: 'weak' } })
    await p.req('change password wrong', 'POST', `${P}/auth/change-password`, { ...A, body: { currentPassword: 'x', newPassword: 'New@12345' } })
    await p.req('change password same', 'POST', `${P}/auth/change-password`, { ...A, body: { currentPassword: 'Partner@123', newPassword: 'Partner@123' } })
    await p.req('change password weak', 'POST', `${P}/auth/change-password`, { ...A, body: { currentPassword: 'Partner@123', newPassword: 'weak' } })

    // Session of a brand-new (Draft) restaurant. The old API showed a placeholder name here.
    await p.req('session draft', 'GET', `${P}/session`, { ...A, ignore: ['data.restaurant.name'] })
    await p.req('login recorded', 'POST', `${P}/session/login-recorded`, A)
    await p.req('profile draft', 'GET', `${P}/restaurant`, A)
    await p.req('no token', 'GET', `${P}/restaurant`)

    // Profile edits
    await p.req('patch unknown key', 'PATCH', `${P}/restaurant`, { ...A, body: { mainPhotoKey: 'x', status: 'ACTIVE' } })
    await p.req('patch invalid', 'PATCH', `${P}/restaurant`, {
      ...A,
      body: { name: 'x'.repeat(101), owner: { phone: '+92 300 1234567' }, restaurant: { website: 'http://bad.pk' }, rules: { dressCode: 'y'.repeat(201) } },
    })
    await p.req('patch visibility in draft', 'PATCH', `${P}/restaurant`, { ...A, body: { visibleOnApp: true } })
    await p.req('patch', 'PATCH', `${P}/restaurant`, {
      ...A,
      body: {
        name: 'Kolachi',
        cuisine: 'Pakistani',
        description: 'Seafront barbecue.',
        location: { areaDistrict: 'DHA', city: 'Karachi', fullAddress: 'Do Darya, Karachi', latitude: 24.78, longitude: 67.06 },
        owner: { name: 'Raees', email: 'o@kolachi.pk', phone: '+923001112233' },
      },
    })
    await p.req('save draft', 'POST', `${P}/restaurant/save-draft`, {
      ...A,
      body: { restaurant: { phone: '+922135250000', email: 'hi@kolachi.pk', website: 'kolachi.pk' }, rules: { houseRules: 'Be kind', dressCode: 'Smart casual', servesAlcohol: false } },
    })
    await p.req('save draft invalid', 'POST', `${P}/restaurant/save-draft`, { ...A, body: { nope: 1 } })
    await p.req('profile filled', 'GET', `${P}/restaurant`, A)
    await p.req('session named', 'GET', `${P}/session`, A)
    await p.req('submit not ready', 'POST', `${P}/restaurant/submit`, A)
    await p.req('onboarding link', 'POST', `${P}/restaurant/payments/onboarding-link`, A)

    // Contacts
    await p.req('contacts empty', 'GET', `${P}/restaurant/contacts`, A)
    await p.req('contact no name', 'POST', `${P}/restaurant/contacts`, { ...A, body: { title: 'x' } })
    await p.req('contact 1', 'POST', `${P}/restaurant/contacts`, { ...A, body: { name: ' Sara Aziz ', title: 'Events Lead' } })
    await p.req('contact 2', 'POST', `${P}/restaurant/contacts`, { ...A, body: { name: 'Osama Khalil', title: 'GM', email: 'o@k.pk', phone: '+923001234567' } })
    await p.req('contact 3', 'POST', `${P}/restaurant/contacts`, { ...A, body: { name: 'Bilal' } })
    await p.req('contacts', 'GET', `${P}/restaurant/contacts`, A)
    await p.req('contacts desc', 'GET', `${P}/restaurant/contacts?sortBy=title&sortOrder=desc`, A)
    await p.req('contacts search', 'GET', `${P}/restaurant/contacts?searchField=name&search=sa`, A)
    await p.req('contacts bad sort', 'GET', `${P}/restaurant/contacts?sortBy=nope`, A)
    await p.req('contacts bad order', 'GET', `${P}/restaurant/contacts?sortOrder=up`, A)
    await p.req('contact patch', 'PATCH', `${P}/restaurant/contacts/ct-1`, { ...A, body: { name: 'Sara A.', email: 's@k.pk' } })
    await p.req('contact patch blank', 'PATCH', `${P}/restaurant/contacts/ct-1`, { ...A, body: { name: '  ' } })
    await p.req('contact patch missing', 'PATCH', `${P}/restaurant/contacts/ct-9`, { ...A, body: { name: 'x' } })
    await p.req('contact delete', 'DELETE', `${P}/restaurant/contacts/ct-2`, A)
    await p.req('contact delete again', 'DELETE', `${P}/restaurant/contacts/ct-2`, A)
    await p.req('contact delete 3', 'DELETE', `${P}/restaurant/contacts/ct-3`, A)
    await p.req('contact delete last', 'DELETE', `${P}/restaurant/contacts/ct-1`, A)
    await p.req('contact 4', 'POST', `${P}/restaurant/contacts`, { ...A, body: { name: 'Hina' } })
    await p.req('contacts end', 'GET', `${P}/restaurant/contacts`, A)

    // Sign-up
    await p.req('signup registered', 'POST', `${P}/signup/start`, { body: { email: 'Partner@GoMingle.com' } })
    await p.req('signup throttled', 'POST', `${P}/signup/start`, { body: { email: 'throttled@gomingle.com' } })
    await p.req('signup start', 'POST', `${P}/signup/start`, { body: { email: 'new@bbq.pk' } })
    await p.req('signup resend', 'POST', `${P}/signup/resend`, { body: { email: 'new@bbq.pk' } })
    await p.req('signup wrong code', 'POST', `${P}/signup/verify`, { body: { email: 'new@bbq.pk', code: '000000' } })
    const verified = await p.req('signup verify', 'POST', `${P}/signup/verify`, { body: { email: 'new@bbq.pk', code: '123456' } })
    p.tokens.newbie = verified.get('data.session.accessToken')
    expect(verified.neu.json.data.session.idToken).toBe(verified.neu.json.data.session.accessToken)
    await p.req('signup complete no token', 'POST', `${P}/signup/complete`, { body: { password: 'Bbq@12345' } })
    await p.req('signup complete weak', 'POST', `${P}/signup/complete`, { as: 'newbie', body: { password: 'weak' } })
    await p.req('signup complete', 'POST', `${P}/signup/complete`, { as: 'newbie', body: { password: 'Bbq@12345', fullName: 'Nadia BBQ' } })
    await p.req('newbie session', 'GET', `${P}/session`, { as: 'newbie', ignore: ['data.restaurant.name'] })
    await p.req('newbie profile', 'GET', `${P}/restaurant`, { as: 'newbie' })
    await p.req('newbie contacts are their own', 'GET', `${P}/restaurant/contacts`, { as: 'newbie' })
    await p.req('newbie signs in', 'POST', `${P}/auth/login`, { body: { email: 'new@bbq.pk', password: 'Bbq@12345' } })
    await p.req('signup again', 'POST', `${P}/signup/start`, { body: { email: 'new@bbq.pk' } })

    // Lockout: five wrong passwords lock the account
    for (let i = 1; i <= 6; i++) {
      await p.req(`lockout ${i}`, 'POST', `${P}/auth/login`, { body: { email: 'new@bbq.pk', password: 'wrong' } })
    }
    await p.req('locked even with right password', 'POST', `${P}/auth/login`, { body: { email: 'new@bbq.pk', password: 'Bbq@12345' } })

    // Password reset and logout
    await p.req('confirm forgot', 'POST', `${P}/auth/confirm-forgot-password`, { body: { email: 'partner@gomingle.com', code: '123456', newPassword: 'New@12345' } })
    await p.req('old password', 'POST', `${P}/auth/login`, { body: { email: 'partner@gomingle.com', password: 'Partner@123' } })
    await p.req('new password', 'POST', `${P}/auth/login`, { body: { email: 'partner@gomingle.com', password: 'New@12345' } })
    await p.req('logout', 'POST', `${P}/auth/logout`, A)

    if (process.env.GM_SHOW) require('node:fs').writeFileSync(process.env.GM_SHOW, p.statuses.join('\n'))
    expect(p.differences, p.report()).toEqual([])
  })
})
