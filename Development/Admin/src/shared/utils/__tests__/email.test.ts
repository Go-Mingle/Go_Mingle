import { describe, it, expect } from 'vitest'
import { isValidEmail, emailValidatorRule } from '../email'

const INVALID_EMAILS = [
  'testexample.com',
  '@example.com',
  'test@',
  'test@example',
  'test@@example.com',
  'test @example.com',
  'test@ ',
  'te st@example.com',
  ' test@example.com',
  'test..user@example.com',
  'test@example..com',
  '.test@example.com',
  'test.@example.com',
  'test@.example.com',
  'test@example.com.',
  'test@-example.com',
  'test@example-.com',
  'test<>@example.com',
  'test,@example.com',
  'test@example/com',
  'test\\user@example.com',
  'test@example_com',
  'test@.com',
  'test@example.123',
  'test@domain..co.uk',
  '😀@example.com',
  '"test@example.com',
  'test@example..co.uk',
  'test@localhost',
  'test@127.0.0.1',
  'test@.com.com',
  'test@com.',
  'test@-domain-.com',
  'test@domain',
  'test@domain.c',
  'test@domain.toolongtlddddddddddddddddddddd',
  'test.@.example.com',
  '..test@example.com',
  'test..@example.com',
  'test@example,com',
  'test@example;com',
  'test@example:com',
  'test@exa mple.com',
  'test@exam!ple.com',
  'test#',
  'test@example#.com',
  'test()@example.com',
  'test[]@example.com',
  'test{}@example.com',
  'test|@example.com',
  'test@example?.com',
  'test@example!.com',
  '',
  "' OR 1=1 --",
  '<script>alert(1)</script>@example.com',
  '"><img src=x onerror=alert(1)>',
]

const VALID_EMAILS = [
  'test@example.com',
  'you@gomingle.com',
  'admin@gomingle.com',
  'a.b-c@sub.example.co.uk',
  'user+tag@example.com',
  'first.last@domain.io',
  'x1@abc.dev',
]

describe('isValidEmail', () => {
  it.each(INVALID_EMAILS)('rejects invalid email: %j', (email) => {
    expect(isValidEmail(email)).toBe(false)
  })

  it.each(VALID_EMAILS)('accepts valid email: %s', (email) => {
    expect(isValidEmail(email)).toBe(true)
  })

  it('handles undefined input without throwing', () => {
    expect(isValidEmail(undefined)).toBe(false)
  })

  it('rejects a local part longer than 64 characters', () => {
    expect(isValidEmail(`${'a'.repeat(65)}@example.com`)).toBe(false)
  })

  it('rejects a domain label longer than 63 characters', () => {
    expect(isValidEmail(`test@${'a'.repeat(64)}.com`)).toBe(false)
  })
})

describe('emailValidatorRule', () => {
  const rule = emailValidatorRule('Enter a valid email')

  it('resolves for empty values (required is handled separately)', async () => {
    await expect(rule.validator(undefined, '')).resolves.toBeUndefined()
  })

  it('resolves for a valid email', async () => {
    await expect(rule.validator(undefined, 'test@example.com')).resolves.toBeUndefined()
  })

  it('rejects an invalid email with the provided message', async () => {
    await expect(rule.validator(undefined, 'not-an-email')).rejects.toThrow('Enter a valid email')
  })
})
