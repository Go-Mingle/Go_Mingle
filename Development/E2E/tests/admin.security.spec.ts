import crypto from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_API, ok, adminToken, unwrap } from './support/api'
import { settle } from './support/page-checks'

/**
 * Two-step sign-in and sessions (GM-346), as a new admin would use them: turn
 * it on from Security, sign out, sign back in with an app code, then with a
 * backup code, and sign a device out. The admin is created for the test and
 * deleted after.
 */
const SHOTS = process.env.GM_SHOTS
const stamp = Date.now().toString(36)

function base32Decode(s: string) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of s.replace(/\s/g, '').toUpperCase()) {
    value = (value << 5) | A.indexOf(ch)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** RFC 6238 code for `secret`, `offset` 30-second steps from now. */
function totp(secret: string, offset = 0) {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offset))
  const mac = crypto.createHmac('sha1', base32Decode(secret)).update(msg).digest()
  const o = mac[mac.length - 1] & 15
  return String((mac.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[type=email], input[name=email]').first().fill(email)
  await page.locator('input[type=password]').first().fill(password)
  await page.locator('button[type=submit]').first().click()
}

test.use({ storageState: { cookies: [], origins: [] } })

test('turns on two-step sign-in, then signs in with an app code and a backup code', async ({
  page,
}) => {
  const A = await adminToken()
  const role = unwrap(
    await ok('POST', `${ADMIN_API}/roles`, A, {
      name: `Security check ${stamp}`,
      fullAccess: false,
      permissions: ['MANAGE_RESTAURANTS', 'RESTAURANTS'],
    }),
  ) as { id: string }
  const email = `security.${stamp}@gomingle.pk`
  const password = 'Security!2026'
  const user = unwrap(
    await ok('POST', `${ADMIN_API}/users`, A, {
      fullName: `Hira Security ${stamp}`,
      email,
      roleId: role.id,
      password,
      confirmPassword: password,
    }),
  ) as { id: string }

  try {
    // 1. Sign in with a password only, and turn two-step sign-in on.
    await signIn(page, email, password)
    await expect(page).not.toHaveURL(/\/login/)
    await page.goto('/security')
    await settle(page)
    await expect(page.getByTestId('two-step-status')).toHaveText('Off')
    await page.getByTestId('two-step-start').click()
    await expect(page.getByTestId('two-step-qr')).toBeVisible()
    const secret = (await page.getByTestId('two-step-secret').textContent())!.replace(/\s/g, '')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/security-setup.png` })
    await page.getByTestId('two-step-code').fill(totp(secret))
    await page.getByRole('dialog').getByRole('button', { name: 'Turn on' }).click()
    const codes = page.getByTestId('two-step-backup-codes')
    await expect(codes).toBeVisible()
    const backup = (await codes.locator('li').first().textContent())!.trim()
    const finish = page.getByTestId('two-step-finish')
    await expect(finish).toBeDisabled()
    await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('two-step-download').click(),
    ])
    await finish.click()
    await expect(page.getByTestId('two-step-status')).toHaveText('On')

    // 2. Sign in again: the password alone isn't enough.
    await page.context().clearCookies()
    await page.evaluate(() => window.localStorage.clear())
    await signIn(page, email, password)
    await expect(page.getByTestId('two-step-step')).toBeVisible()
    // The code from set-up can't be used twice; the next one works (one step of drift is allowed).
    const boxes = page.getByTestId('two-step-step').getByRole('textbox')
    await boxes.first().click()
    await page.keyboard.type(totp(secret, 1))
    await expect(page).not.toHaveURL(/\/login/)

    // 3. A backup code works once.
    await page.evaluate(() => window.localStorage.clear())
    await signIn(page, email, password)
    await page.getByRole('button', { name: /backup code/i }).click()
    await page.getByTestId('two-step-backup').fill(backup)
    await page.getByTestId('two-step-verify').click()
    await expect(page).not.toHaveURL(/\/login/)

    // 4. Two sign-ins are listed; sign the other one out.
    await page.goto('/security')
    await settle(page)
    await expect(page.getByText('This device')).toBeVisible()
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/security-page.png`, fullPage: true })
    await page.getByTestId('sign-out-others').click()
    await expect(page.getByText(/Signed out \d+ other device/)).toBeVisible()
    await expect(page.getByTestId('sign-out-others')).toHaveCount(0)

    // 5. The super admin sees it on in Users.
    const list = unwrap(await ok('GET', `${ADMIN_API}/users?pageSize=50`, A)).items as {
      id: string
      twoStepEnabled: boolean
    }[]
    expect(list.find((u) => u.id === user.id)?.twoStepEnabled).toBe(true)
  } finally {
    await ok('DELETE', `${ADMIN_API}/users/${user.id}`, A).catch(() => undefined)
    await ok('DELETE', `${ADMIN_API}/roles/${role.id}`, A).catch(() => undefined)
  }
})
