import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Parity } from '../helpers/parity'

/** Admin sign-in, Roles & Access, Users and the Change Log behave exactly as before. */
describe('parity: admin access', () => {
  let p: Parity
  beforeAll(async () => {
    p = await Parity.start()
  })
  afterAll(async () => {
    await p?.stop()
  })

  it('matches the old API', async () => {
    // Sign-in
    await p.req('login wrong password', 'POST', '/admin/api/v1/auth/login', { body: { email: 'admin@gomingle.com', password: 'nope' } })
    await p.req('login unknown', 'POST', '/admin/api/v1/auth/login', { body: { email: 'x@y.z', password: 'nope' } })
    await p.req('login no body', 'POST', '/admin/api/v1/auth/login')
    await p.loginAdmin()
    expect(p.tokens.admin.old).toBeTruthy()
    expect(p.tokens.admin.neu).toBeTruthy()
    await p.req('me', 'GET', '/admin/api/v1/auth/me', { as: 'admin' })
    await p.req('me no token', 'GET', '/admin/api/v1/auth/me')
    await p.req('me bad token', 'GET', '/admin/api/v1/auth/me', { as: 'nobody' })
    await p.req('rename blank', 'PATCH', '/admin/api/v1/auth/me', { as: 'admin', body: { fullName: '  ' } })
    await p.req('rename', 'PATCH', '/admin/api/v1/auth/me', { as: 'admin', body: { fullName: 'Hira M' } })
    await p.req('record failure unknown', 'POST', '/admin/api/v1/auth/record-login-result', { body: { email: 'x@y.z', succeeded: false } })
    await p.req('record success', 'POST', '/admin/api/v1/auth/record-login-result', { body: { email: 'admin@gomingle.com', succeeded: true } })
    await p.req('refresh bad', 'POST', '/admin/api/v1/auth/refresh', { body: { refreshToken: 'nope' } })
    await p.req('forgot request', 'POST', '/admin/api/v1/auth/forgot-password/request-code', { body: { email: 'admin@gomingle.com' } })
    await p.req('forgot verify wrong', 'POST', '/admin/api/v1/auth/forgot-password/verify-code', { body: { email: 'admin@gomingle.com', code: '999999' } })
    await p.req('forgot reset bad session', 'POST', '/admin/api/v1/auth/forgot-password/reset', { body: { resetSessionToken: 'x', newPassword: 'Abc@12345' } })
    await p.req('change password wrong current', 'POST', '/admin/api/v1/auth/change-password', { as: 'admin', body: { currentPassword: 'x', newPassword: 'Abc@12345' } })
    await p.req('change password weak', 'POST', '/admin/api/v1/auth/change-password', { as: 'admin', body: { currentPassword: 'Admin@123', newPassword: 'weak' } })
    await p.req('change password mismatch', 'POST', '/admin/api/v1/auth/change-password', {
      as: 'admin',
      body: { currentPassword: 'Admin@123', newPassword: 'Abc@12345', confirmPassword: 'Abc@12346' },
    })

    // Roles
    await p.req('permission keys', 'GET', '/admin/api/v1/roles/permission-keys', { as: 'admin' })
    await p.req('roles list', 'GET', '/admin/api/v1/roles', { as: 'admin' })
    await p.req('roles active', 'GET', '/admin/api/v1/roles/active', { as: 'admin' })
    await p.req('role r1', 'GET', '/admin/api/v1/roles/r1', { as: 'admin' })
    await p.req('role missing', 'GET', '/admin/api/v1/roles/nope', { as: 'admin' })
    const ops = await p.req('create role', 'POST', '/admin/api/v1/roles', { as: 'admin', body: { name: 'Ops', fullAccess: false, permissions: ['FINANCES'] } })
    const opsId = ops.get('id')
    await p.req('create role 2', 'POST', '/admin/api/v1/roles', { as: 'admin', body: { name: 'Auditor', fullAccess: false, permissions: ['CHANGE_LOG'] } })
    await p.req('roles search', 'GET', '/admin/api/v1/roles?search=op&sortBy=usersAssigned&sortDir=desc', { as: 'admin' })
    await p.req('roles paged', 'GET', '/admin/api/v1/roles?page=2&pageSize=1', { as: 'admin' })
    await p.req('patch role', 'PATCH', (s) => `/admin/api/v1/roles/${opsId[s]}`, { as: 'admin', body: { name: 'Ops Lead', usersAssigned: 99 } })
    await p.req('patch missing role', 'PATCH', '/admin/api/v1/roles/nope', { as: 'admin', body: { name: 'x' } })

    // Users
    await p.req('users list', 'GET', '/admin/api/v1/users?page=1&pageSize=25', { as: 'admin' })
    await p.req('user taken email', 'POST', '/admin/api/v1/users', {
      as: 'admin',
      body: { fullName: 'X', email: 'admin@gomingle.com', roleId: 'r1', password: 'Ops@12345', confirmPassword: 'Ops@12345' },
    })
    await p.req('user weak password', 'POST', '/admin/api/v1/users', {
      as: 'admin',
      body: { fullName: 'X', email: 'x@gomingle.com', roleId: 'r1', password: 'weak', confirmPassword: 'weak' },
    })
    await p.req('user mismatch', 'POST', '/admin/api/v1/users', {
      as: 'admin',
      body: { fullName: 'X', email: 'x@gomingle.com', roleId: 'r1', password: 'Ops@12345', confirmPassword: 'Ops@12346' },
    })
    await p.req('user bad role', 'POST', '/admin/api/v1/users', {
      as: 'admin',
      body: { fullName: 'X', email: 'x@gomingle.com', roleId: 'nope', password: 'Ops@12345', confirmPassword: 'Ops@12345' },
    })
    const ayesha = await p.req('create user', 'POST', '/admin/api/v1/users', {
      as: 'admin',
      body: (s) => ({ fullName: 'Ayesha Khan', email: 'ayesha@gomingle.com', roleId: opsId[s], password: 'Ops@12345', confirmPassword: 'Ops@12345' }),
    })
    const ayeshaId = ayesha.get('data.id')
    await p.req('create user 2', 'POST', '/admin/api/v1/users', {
      as: 'admin',
      body: { fullName: 'Bilal Ahmed', email: 'bilal@gomingle.com', roleId: 'r1', status: 'SUSPENDED', password: 'Ops@12345', confirmPassword: 'Ops@12345' },
    })
    await p.req('role counts', 'GET', '/admin/api/v1/roles', { as: 'admin' })
    await p.req('delete held role', 'DELETE', (s) => `/admin/api/v1/roles/${opsId[s]}`, { as: 'admin' })
    await p.req('users search', 'GET', '/admin/api/v1/users?q=bil&statuses=SUSPENDED&sortOrder=desc', { as: 'admin' })
    await p.req('get user', 'GET', (s) => `/admin/api/v1/users/${ayeshaId[s]}`, { as: 'admin' })
    await p.req('get missing user', 'GET', '/admin/api/v1/users/u999', { as: 'admin' })
    await p.req('rename user', 'PATCH', (s) => `/admin/api/v1/users/${ayeshaId[s]}`, { as: 'admin', body: { fullName: 'Ayesha K' } })
    await p.req('user bad role patch', 'PATCH', (s) => `/admin/api/v1/users/${ayeshaId[s]}`, { as: 'admin', body: { roleId: 'nope' } })
    await p.req('new user signs in', 'POST', '/admin/api/v1/auth/login', { body: { email: 'ayesha@gomingle.com', password: 'Ops@12345' } })
    await p.loginAdmin('ayesha', 'ayesha@gomingle.com', 'Ops@12345')
    await p.req('ayesha me', 'GET', '/admin/api/v1/auth/me', { as: 'ayesha' })
    await p.req('suspended cannot sign in', 'POST', '/admin/api/v1/auth/login', { body: { email: 'bilal@gomingle.com', password: 'Ops@12345' } })
    await p.req('set user password weak', 'POST', (s) => `/admin/api/v1/users/${ayeshaId[s]}/change-password`, { as: 'admin', body: { newPassword: 'x' } })
    await p.req('set user password', 'POST', (s) => `/admin/api/v1/users/${ayeshaId[s]}/change-password`, {
      as: 'admin',
      body: { newPassword: 'New@12345', confirmNewPassword: 'New@12345' },
    })
    await p.req('old password rejected', 'POST', '/admin/api/v1/auth/login', { body: { email: 'ayesha@gomingle.com', password: 'Ops@12345' } })
    await p.req('new password works', 'POST', '/admin/api/v1/auth/login', { body: { email: 'ayesha@gomingle.com', password: 'New@12345' } })
    await p.req('suspend user', 'PATCH', (s) => `/admin/api/v1/users/${ayeshaId[s]}`, { as: 'admin', body: { status: 'SUSPENDED' } })
    await p.req('suspended token rejected', 'GET', '/admin/api/v1/auth/me', { as: 'ayesha' })
    await p.req('delete user', 'DELETE', (s) => `/admin/api/v1/users/${ayeshaId[s]}`, { as: 'admin' })
    await p.req('deleted cannot sign in', 'POST', '/admin/api/v1/auth/login', { body: { email: 'ayesha@gomingle.com', password: 'New@12345' } })
    await p.req('email reusable', 'POST', '/admin/api/v1/users', {
      as: 'admin',
      body: { fullName: 'Ayesha Two', email: 'ayesha@gomingle.com', roleId: 'r1', password: 'Ops@12345', confirmPassword: 'Ops@12345' },
    })
    await p.req('delete freed role', 'DELETE', (s) => `/admin/api/v1/roles/${opsId[s]}`, { as: 'admin' })
    await p.req('deleted role gone', 'GET', (s) => `/admin/api/v1/roles/${opsId[s]}`, { as: 'admin' })
    await p.req('roles after delete', 'GET', '/admin/api/v1/roles/active', { as: 'admin' })

    // Change log
    await p.req('change log', 'GET', '/admin/api/v1/change-log', { as: 'admin' })

    expect(p.differences, p.report()).toEqual([])

    // The harness itself must notice a real difference.
    const log = await p.req('self-check', 'GET', (s) => (s === 'old' ? '/admin/api/v1/roles/active' : '/admin/api/v1/change-log'), { as: 'admin' })
    expect(log.old.status).toBe(200)
    expect(log.neu.json.length).toBeGreaterThan(5)
    expect(p.differences.length).toBeGreaterThan(0)
  })
})
