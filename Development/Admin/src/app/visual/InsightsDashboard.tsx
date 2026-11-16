import type { ReactNode } from 'react'
import { Segmented } from 'antd'
import { CalendarCheck, HandCoins, Storefront, Users, Wallet } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CountUp } from './CountUp'
import { DeltaChip } from './DeltaChip'
import { EscrowFlow } from './EscrowFlow'
import { SeatMap } from './SeatMap'
import { DayBars, RankBars, ShareBar, TrendArea } from './charts'
import { pkr, RANGES, whenPk, type Insights, type Pair, type Range } from './insights'

interface Props {
  /** `partner`: one restaurant's own figures. `admin`: the whole platform. */
  audience: 'admin' | 'partner'
  data: Insights
  range: Range
  onRange: (r: Range) => void
  /** Where an upcoming table's row leads. */
  tableHref: (t: Insights['upcoming'][number]) => string
}

function Panel({
  title,
  hint,
  children,
  className,
}: Readonly<{ title: string; hint?: string; children: ReactNode; className?: string }>) {
  return (
    <section
      className={`bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-5 ${className ?? ''}`}
    >
      <h2 className="text-[15px] font-semibold text-[var(--color-text)] m-0">{title}</h2>
      {hint && <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 mb-0">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

interface TileProps {
  icon: ReactNode
  label: string
  pair?: Pair
  value?: number
  format?: (n: number) => string
  against: string
  note?: string
}

function Tile({ icon, label, pair, value, format, against, note }: Readonly<TileProps>) {
  return (
    <div className="gm-lift bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-5">
      <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-text-secondary)]">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-[var(--radius-md)] bg-[var(--color-accent-light)] text-[var(--color-accent-dark)]">
          {icon}
        </span>
        {label}
      </div>
      <div className="text-[26px] font-bold text-[var(--color-text)] leading-tight mt-3 whitespace-nowrap">
        <CountUp value={pair ? pair.value : (value ?? 0)} format={format} />
      </div>
      <div className="mt-1.5 min-h-[18px]">
        {pair ? (
          <DeltaChip value={pair.value} previous={pair.previous} against={against} />
        ) : (
          <span className="text-[12px] text-[var(--color-text-muted)]">{note}</span>
        )}
      </div>
    </div>
  )
}

/**
 * The dashboard both portals share: the period's headline figures, money and
 * bookings per day, how bookings turned out, where the money is, and how full
 * the tables still to come are.
 */
export function InsightsDashboard({ audience, data, range, onRange, tableHref }: Readonly<Props>) {
  const { t } = useTranslation('dashboard')
  const k = data.kpis
  const against = t('against', { count: data.days })
  const isAdmin = audience === 'admin'
  const money = isAdmin
    ? data.daily.map((d) => ({ date: d.date, value: d.collectedPkr }))
    : data.daily.map((d) => ({ date: d.date, value: d.paidOutPkr }))
  const moneyTotal = isAdmin ? k.collectedPkr.value : k.paidOutPkr.value
  const seats = k.upcomingSeats

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-[var(--font-display)] text-[26px] font-bold text-[var(--color-text)] m-0">
            {t('title')}
          </h1>
          <p className="text-[13px] text-[var(--color-text-muted)] mt-1 mb-0">
            {t(isAdmin ? 'subtitleAdmin' : 'subtitlePartner')}
          </p>
        </div>
        <Segmented<Range>
          aria-label={t('range.label')}
          value={range}
          onChange={onRange}
          options={RANGES.map((r) => ({ value: r, label: t('range.days', { count: r }) }))}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <Tile
          icon={<CalendarCheck size={16} />}
          label={t('kpi.bookings')}
          pair={k.bookings}
          against={against}
        />
        <Tile icon={<Users size={16} />} label={t('kpi.seats')} pair={k.seats} against={against} />
        {isAdmin ? (
          <>
            <Tile
              icon={<Wallet size={16} />}
              label={t('kpi.collected')}
              pair={k.collectedPkr}
              format={pkr}
              against={against}
            />
            <Tile
              icon={<HandCoins size={16} />}
              label={t('kpi.fees')}
              pair={k.feesPkr}
              format={pkr}
              against={against}
            />
          </>
        ) : (
          <>
            <Tile
              icon={<HandCoins size={16} />}
              label={t('kpi.paidToYou')}
              pair={k.paidOutPkr}
              format={pkr}
              against={against}
            />
            <Tile
              icon={<Wallet size={16} />}
              label={t('kpi.onTheWay')}
              value={data.escrow.inEscrowPkr}
              format={pkr}
              against={against}
              note={t('kpi.onTheWayNote')}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <Panel
          className="xl:col-span-2"
          title={t(isAdmin ? 'money.titleAdmin' : 'money.titlePartner')}
          hint={t(isAdmin ? 'money.hintAdmin' : 'money.hintPartner', { fee: data.escrow.feePct })}
        >
          <TrendArea
            data={money}
            series={t(isAdmin ? 'money.seriesAdmin' : 'money.seriesPartner')}
            format={pkr}
            summary={t('money.summary', { total: pkr(moneyTotal), count: data.days })}
          />
        </Panel>
        <Panel title={t('seats.title')} hint={t('seats.hint', { count: k.upcomingTables })}>
          <div className="flex items-center gap-4 mb-4">
            <SeatMap
              booked={seats.booked}
              total={seats.capacity}
              size={84}
              label={t('seats.aria', { booked: seats.booked, capacity: seats.capacity })}
            />
            <div>
              <div className="text-[22px] font-bold text-[var(--color-text)] leading-tight">
                {seats.capacity ? `${Math.round((seats.booked / seats.capacity) * 100)}%` : '–'}
              </div>
              <div className="text-[12px] text-[var(--color-text-muted)]">
                {t('seats.filled', { booked: seats.booked, capacity: seats.capacity })}
              </div>
            </div>
          </div>
          {data.upcoming.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-muted)] m-0">
              {t(isAdmin ? 'seats.emptyAdmin' : 'seats.emptyPartner')}
            </p>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col">
              {data.upcoming.slice(0, 4).map((u) => (
                <li key={u.id} className="border-t border-[var(--color-divider)] first:border-t-0">
                  <Link
                    to={tableHref(u)}
                    className="flex items-center gap-3 py-2.5 no-underline rounded-[var(--radius-md)] hover:bg-[var(--color-hover)] -mx-2 px-2"
                  >
                    <SeatMap booked={u.bookedSeats} total={u.maxGuests} size={40} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-[var(--color-text)] truncate">
                        {u.name}
                      </span>
                      <span className="block text-[12px] text-[var(--color-text-muted)] truncate">
                        {isAdmin
                          ? `${u.restaurantName}, ${whenPk(u.startsAt)}`
                          : whenPk(u.startsAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <Panel className="xl:col-span-2" title={t('bookings.title')} hint={t('bookings.hint')}>
          <DayBars
            data={data.daily.map((d) => ({ date: d.date, value: d.bookings }))}
            series={t('bookings.series')}
            format={(n) => String(n)}
            summary={t('bookings.summary', { total: k.bookings.value, count: data.days })}
          />
        </Panel>
        <Panel title={t('outcome.title')} hint={t('outcome.hint')}>
          <ShareBar
            summary={t('outcome.summary', data.outcome)}
            empty={t('outcome.empty')}
            parts={[
              {
                key: 'arrived',
                label: t('outcome.arrived'),
                value: data.outcome.arrived,
                colour: 'var(--color-success)',
              },
              {
                key: 'partial',
                label: t('outcome.partial'),
                value: data.outcome.partial,
                colour: 'var(--chart-4)',
              },
              {
                key: 'noShow',
                label: t('outcome.noShow'),
                value: data.outcome.noShow,
                colour: 'var(--color-error)',
              },
              {
                key: 'cancelled',
                label: t('outcome.cancelled'),
                value: data.outcome.cancelled,
                colour: 'var(--chart-neutral)',
              },
              {
                key: 'upcoming',
                label: t('outcome.upcoming'),
                value: data.outcome.upcoming,
                colour: 'var(--chart-3)',
              },
            ]}
          />
          {isAdmin && data.restaurants && (
            <div className="mt-5 pt-4 border-t border-[var(--color-divider)] flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-accent-light)] text-[var(--color-accent-dark)]">
                <Storefront size={18} />
              </span>
              <div className="text-[13px] text-[var(--color-text-secondary)]">
                <span className="font-semibold text-[var(--color-text)]">
                  {t('restaurants.active', { count: data.restaurants.active })}
                </span>
                <br />
                {data.restaurants.pendingApproval > 0 ? (
                  <Link
                    to="/approval-queue"
                    className="text-[var(--color-accent-dark)] font-medium"
                  >
                    {t('restaurants.pending', { count: data.restaurants.pendingApproval })}
                  </Link>
                ) : (
                  t('restaurants.nonePending')
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className={`grid grid-cols-1 ${isAdmin ? 'xl:grid-cols-3' : ''} gap-4`}>
        <Panel
          className={isAdmin ? 'xl:col-span-2' : ''}
          title={t('escrow.title')}
          hint={t('escrow.hint')}
        >
          <EscrowFlow
            steps={[
              {
                key: 'held',
                label: t('escrow.held'),
                amount: <CountUp value={data.escrow.heldPkr} format={pkr} />,
                hint: t('escrow.heldHint'),
              },
              {
                key: 'escrow',
                label: t('escrow.inEscrow'),
                amount: <CountUp value={data.escrow.inEscrowPkr} format={pkr} />,
                hint: t('escrow.inEscrowHint'),
              },
              {
                key: 'paid',
                label: t(isAdmin ? 'escrow.paidAdmin' : 'escrow.paidPartner'),
                amount: <CountUp value={data.escrow.paidOutPkr} format={pkr} />,
                hint: t('escrow.paidHint', { fee: data.escrow.feePct }),
                final: true,
              },
            ]}
          />
        </Panel>
        {isAdmin && (
          <Panel title={t('top.title')} hint={t('top.hint', { count: data.days })}>
            <RankBars
              format={pkr}
              empty={t('top.empty')}
              rows={(data.topRestaurants ?? []).map((r) => ({
                id: r.id,
                name: r.name,
                value: r.collectedPkr,
                note: t('top.bookings', { count: r.bookings }),
              }))}
            />
          </Panel>
        )}
      </div>
    </div>
  )
}
