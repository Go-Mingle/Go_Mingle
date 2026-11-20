import { describe, it, expect } from 'vitest'
import i18n from 'i18next'
import { buildDashboardPdf, dashboardPdfName } from '../dashboardPdf'
import type { Insights } from '../insights'
import dashboard from '../../../locales/en/dashboard.json'

const day = (i: number) => new Date(Date.UTC(2026, 10, 1 + i)).toISOString()
const data: Insights = {
  days: 30,
  from: day(0),
  to: day(29),
  kpis: {
    bookings: { value: 42, previous: 30 },
    seats: { value: 180, previous: 150 },
    collectedPkr: { value: 252000, previous: 200000 },
    paidOutPkr: { value: 221760, previous: 176000 },
    feesPkr: { value: 30240, previous: 24000 },
    upcomingTables: 2,
    upcomingSeats: { booked: 9, capacity: 14 },
  },
  daily: Array.from({ length: 30 }, (_, i) => ({
    date: day(i),
    bookings: i % 4,
    seats: (i % 4) * 4,
    collectedPkr: (i % 4) * 6000,
    paidOutPkr: (i % 4) * 5280,
    feesPkr: (i % 4) * 720,
  })),
  outcome: { upcoming: 3, arrived: 30, partial: 4, noShow: 2, cancelled: 3 },
  escrow: { heldPkr: 14000, inEscrowPkr: 8400, paidOutPkr: 221760, refundedPkr: 4200, feePct: 12 },
  upcoming: [
    {
      id: 'it1',
      name: 'Startup Mixer',
      restaurantId: 'r1',
      restaurantName: 'Kolachi Seafront',
      startsAt: day(31),
      maxGuests: 8,
      bookedSeats: 5,
    },
  ],
}

async function t() {
  const inst = i18n.createInstance()
  await inst.init({
    lng: 'en',
    resources: { en: { dashboard } },
    defaultNS: 'dashboard',
    interpolation: { escapeValue: false },
  })
  return inst.t
}

describe('dashboard PDF', () => {
  it('names the file after the period and the day', () => {
    expect(dashboardPdfName(30, new Date('2026-11-20T10:00:00Z'))).toBe(
      'gomingle-dashboard-30-days-2026-11-20.pdf',
    )
  })

  it('builds a text PDF with the headline figures, outcomes, money and every day', async () => {
    const doc = await buildDashboardPdf({
      audience: 'partner',
      data,
      subject: 'Kolachi Seafront',
      t: await t(),
      now: new Date('2026-11-20T10:00:00Z'),
    })
    const raw = doc.output()
    expect(raw.startsWith('%PDF-')).toBe(true)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
    for (const s of [
      'Kolachi Seafront',
      'Headline figures',
      'PKR 252,000',
      '+40%',
      'How bookings turned out',
      'Where the money is',
      'Startup Mixer',
      'Day by day',
    ]) {
      expect(raw).toContain(s)
    }
    // Optional: GM_PDF_OUT=/path/file.pdf saves the report to look at.
    const out = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
      ?.env.GM_PDF_OUT
    if (out) {
      const fs = await import(/* @vite-ignore */ ['node', 'fs'].join(':'))
      fs.writeFileSync(out, new Uint8Array(doc.output('arraybuffer')))
    }
  })
})
