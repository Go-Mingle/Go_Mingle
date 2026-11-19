import { describe, it, expect } from 'vitest'
import { IMPORT_MAX_ROWS, SpreadsheetError, mapRows, parseCsv, readSheet, toCsv } from '../spreadsheet'

const file = (name: string, text: string) => new File([text], name, { type: 'text/csv' })

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, commas, CRLF and a BOM', () => {
    expect(parseCsv('﻿Name,Note\r\n"Khan, Ali","He said ""hi"""\r\nSara,\n')).toEqual([
      ['Name', 'Note'],
      ['Khan, Ali', 'He said "hi"'],
      ['Sara', ''],
    ])
  })

  it('keeps newlines inside quotes and drops blank lines', () => {
    expect(parseCsv('a,b\n\n"x\ny",z')).toEqual([['a', 'b'], ['x\ny', 'z']])
  })

  it('round-trips through toCsv', () => {
    const rows = [['a,b', 'c"d'], ['e', '']]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
})

describe('mapRows', () => {
  const cols = [
    { key: 'name' as const, headers: ['name', 'full name'], required: true },
    { key: 'email' as const, headers: ['email address', 'email'], required: true },
    { key: 'title' as const, headers: ['title'] },
  ]

  it('matches headers regardless of case, spaces and punctuation', () => {
    const { records, missing } = mapRows([['Full Name', 'E-mail Address'], ['Ali', 'a@b.pk']], cols)
    expect(missing).toEqual([])
    expect(records).toEqual([{ name: 'Ali', email: 'a@b.pk', title: '' }])
  })

  it('reports required columns that are missing', () => {
    expect(mapRows([['Name'], ['Ali']], cols).missing).toEqual(['email'])
  })
})

describe('readSheet', () => {
  it('reads a CSV', async () => {
    expect(await readSheet(file('team.csv', 'Name,Email\nAli,a@b.pk'))).toEqual([['Name', 'Email'], ['Ali', 'a@b.pk']])
  })

  it.each([
    ['notes.txt', 'Name\nAli', 'type'],
    ['empty.csv', 'Name,Email\n', 'empty'],
    ['big.csv', 'Name\n' + 'x\n'.repeat(IMPORT_MAX_ROWS + 1), 'tooMany'],
  ])('refuses %s', async (name, text, reason) => {
    await expect(readSheet(file(name, text))).rejects.toEqual(new SpreadsheetError(reason as never))
  })
})

describe('readSheet with Excel', () => {
  it('reads the first sheet of an .xlsx', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const bytes = readFileSync(resolve(process.cwd(), 'src/test-utils/fixtures/team.xlsx'))
    const rows = await readSheet(new File([bytes], 'team.xlsx'))
    expect(rows).toEqual([
      ['Full Name', 'Email', 'Designation', 'Status'],
      ['Ayesha Siddiqui', 'ayesha@restaurant.pk', 'Floor manager', 'Active'],
      ['Bilal Ahmed', 'bilal@restaurant.pk', '', 'Suspended'],
    ])
  })
})
