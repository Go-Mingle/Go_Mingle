import { describe, it, expect } from 'vitest'
import { messageFromErrorBody } from '../errorEnvelope'

describe('messageFromErrorBody', () => {
  it('reads the canonical error.message', () => {
    expect(messageFromErrorBody({ error: { code: 'ERR_X', message: 'Nope.' } })).toBe('Nope.')
  })

  it('prefers error.details.message over the generic error.message', () => {
    expect(
      messageFromErrorBody({
        error: { message: 'Generic catalogue copy.', details: { message: 'Specific copy.' } },
      }),
    ).toBe('Specific copy.')
  })

  it('falls through to error.message when details carries no message', () => {
    expect(
      messageFromErrorBody({ error: { message: 'In use.', details: { upcomingTables: 2 } } }),
    ).toBe('In use.')
  })

  it('reads data.message, then a bare top-level message', () => {
    expect(messageFromErrorBody({ data: { message: 'under data' } })).toBe('under data')
    expect(messageFromErrorBody({ message: 'top level' })).toBe('top level')
  })

  it('prefers error.message over data.message', () => {
    expect(
      messageFromErrorBody({ error: { message: 'canonical' }, data: { message: 'secondary' } }),
    ).toBe('canonical')
  })

  it('skips blank and whitespace-only messages so the next shape wins', () => {
    expect(messageFromErrorBody({ error: { message: '' }, data: { message: 'real' } })).toBe('real')
    expect(messageFromErrorBody({ error: { message: '   ' } })).toBeUndefined()
  })

  it('returns undefined when no shape carries a message', () => {
    expect(messageFromErrorBody({ error: { code: 'ERR_X' } })).toBeUndefined()
    expect(messageFromErrorBody({ data: {}, error: {} })).toBeUndefined()
  })

  it('returns undefined for bodies that are not objects', () => {
    expect(messageFromErrorBody(null)).toBeUndefined()
    expect(messageFromErrorBody(undefined)).toBeUndefined()
    expect(messageFromErrorBody('<html>502</html>')).toBeUndefined()
    expect(messageFromErrorBody(42)).toBeUndefined()
  })

  it('ignores a non-string message rather than returning it', () => {
    expect(messageFromErrorBody({ message: 123 })).toBeUndefined()
  })
})
