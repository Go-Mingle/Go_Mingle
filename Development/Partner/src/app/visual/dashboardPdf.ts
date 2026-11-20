import type { TFunction } from 'i18next'
import { pkr, whenPk, type Insights, type Pair } from './insights'

const CORAL: [number, number, number] = [214, 58, 37]
const INK: [number, number, number] = [26, 21, 48]
const MUTED: [number, number, number] = [92, 86, 119]
const ROW: [number, number, number] = [247, 245, 252]

const dayPk = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))

const change = (p: Pair) => {
  if (!p.previous) return p.value ? 'new' : '0%'
  const pct = Math.round(((p.value - p.previous) / p.previous) * 100)
  return `${pct > 0 ? '+' : ''}${pct}%`
}

export interface DashboardPdfOptions {
  audience: 'admin' | 'partner'
  data: Insights
  /** Shown under the title, e.g. the restaurant's name. */
  subject?: string
  t: TFunction
  now?: Date
}

/** File name like gomingle-dashboard-30-days-2026-11-20.pdf */
export const dashboardPdfName = (days: number, now = new Date()) =>
  `gomingle-dashboard-${days}-days-${now.toISOString().slice(0, 10)}.pdf`

/**
 * Builds the dashboard as a real, text-based PDF report (searchable and
 * printable): the headline figures against the period before, how bookings
 * turned out, where the money is, every day of the period and the upcoming
 * tables. jsPDF is loaded only when someone exports.
 */
export async function buildDashboardPdf({
  audience,
  data,
  subject,
  t,
  now = new Date(),
}: DashboardPdfOptions) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const isAdmin = audience === 'admin'
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  let y = M

  // Header band
  doc.setFillColor(...INK)
  doc.rect(0, 0, W, 76, 'F')
  doc.setFillColor(...CORAL)
  doc.rect(0, 76, W, 4, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('GoMingle', M, 44)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(t('pdf.reportName', { context: audience }), W - M, 36, { align: 'right' })
  doc.text(t('pdf.generated', { when: whenPk(now.toISOString()) }), W - M, 52, { align: 'right' })
  y = 112

  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(subject || t(isAdmin ? 'pdf.platform' : 'title'), M, y)
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...MUTED)
  doc.text(t('pdf.period', { count: data.days, from: dayPk(data.from), to: dayPk(data.to) }), M, y)
  y += 20

  const table = (
    title: string,
    head: string[],
    body: (string | number)[][],
    right: number[] = [],
  ) => {
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage()
      y = M
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...INK)
    doc.text(title, M, y + 12)
    autoTable(doc, {
      startY: y + 20,
      head: [head],
      body,
      margin: { left: M, right: M },
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9.5, textColor: INK, cellPadding: 5 },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ROW },
      columnStyles: Object.fromEntries(right.map((i) => [i, { halign: 'right' as const }])),
      // Numbers line up on the right, and so do their headings.
      didParseCell: (cell) => {
        if (cell.section === 'head' && right.includes(cell.column.index))
          cell.cell.styles.halign = 'right'
      },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22
  }

  const k = data.kpis
  const paid = isAdmin ? k.feesPkr : k.paidOutPkr
  table(
    t('pdf.headline'),
    [t('pdf.measure'), t('pdf.thisPeriod'), t('pdf.previousPeriod'), t('pdf.change')],
    [
      [t('kpi.bookings'), k.bookings.value, k.bookings.previous, change(k.bookings)],
      [t('kpi.seats'), k.seats.value, k.seats.previous, change(k.seats)],
      [
        t('kpi.collected'),
        pkr(k.collectedPkr.value),
        pkr(k.collectedPkr.previous),
        change(k.collectedPkr),
      ],
      [
        t(isAdmin ? 'kpi.fees' : 'kpi.paidToYou'),
        pkr(paid.value),
        pkr(paid.previous),
        change(paid),
      ],
    ],
    [1, 2, 3],
  )

  const o = data.outcome
  table(
    t('outcome.title'),
    [t('pdf.outcome'), t('pdf.bookings')],
    [
      [t('outcome.arrived'), o.arrived],
      [t('outcome.partial'), o.partial],
      [t('outcome.noShow'), o.noShow],
      [t('outcome.cancelled'), o.cancelled],
      [t('outcome.upcoming'), o.upcoming],
    ],
    [1],
  )

  const e = data.escrow
  table(
    `${t('escrow.title')} (${t('escrow.hint').replace(/\.$/, '').toLowerCase()})`,
    [t('pdf.where'), t('pdf.amount')],
    [
      [t('escrow.held'), pkr(e.heldPkr)],
      [t('escrow.inEscrow'), pkr(e.inEscrowPkr)],
      [t(isAdmin ? 'escrow.paidAdmin' : 'escrow.paidPartner'), pkr(e.paidOutPkr)],
      [t('pdf.refunded'), pkr(e.refundedPkr)],
      [t('pdf.feePct'), `${e.feePct}%`],
    ],
    [1],
  )

  if (isAdmin && data.restaurants) {
    table(
      t('pdf.restaurants'),
      [t('pdf.state'), t('pdf.count')],
      [
        [t('pdf.active'), data.restaurants.active],
        [t('pdf.suspended'), data.restaurants.suspended],
        [t('pdf.pending'), data.restaurants.pendingApproval],
      ],
      [1],
    )
  }

  if (isAdmin && data.topRestaurants?.length) {
    table(
      t('top.title'),
      [t('pdf.restaurant'), t('pdf.bookings'), t('pdf.collected')],
      data.topRestaurants.map((r) => [r.name, r.bookings, pkr(r.collectedPkr)]),
      [1, 2],
    )
  }

  table(
    t('pdf.upcoming'),
    [
      t('pdf.table'),
      ...(isAdmin ? [t('pdf.restaurant')] : []),
      t('pdf.when'),
      t('pdf.seatsBooked'),
    ],
    data.upcoming.length
      ? data.upcoming.map((u) => [
          u.name,
          ...(isAdmin ? [u.restaurantName] : []),
          whenPk(u.startsAt),
          `${u.bookedSeats} / ${u.maxGuests}`,
        ])
      : [[t('pdf.none'), ...(isAdmin ? [''] : []), '', '']],
    [isAdmin ? 3 : 2],
  )

  table(
    t('pdf.daily'),
    [
      t('pdf.date'),
      t('pdf.bookings'),
      t('pdf.seats'),
      t('pdf.collected'),
      t(isAdmin ? 'pdf.fees' : 'pdf.paidOut'),
    ],
    data.daily.map((d) => [
      dayPk(d.date),
      d.bookings,
      d.seats,
      pkr(d.collectedPkr),
      pkr(isAdmin ? d.feesPkr : d.paidOutPkr),
    ]),
    [1, 2, 3, 4],
  )

  // Footer on every page
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const h = doc.internal.pageSize.getHeight()
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTED)
    doc.text(t('pdf.footer'), M, h - 22)
    doc.text(t('pdf.page', { page: i, pages }), W - M, h - 22, { align: 'right' })
  }
  return doc
}

export async function downloadDashboardPdf(opts: DashboardPdfOptions) {
  const doc = await buildDashboardPdf(opts)
  doc.save(dashboardPdfName(opts.data.days, opts.now))
}
