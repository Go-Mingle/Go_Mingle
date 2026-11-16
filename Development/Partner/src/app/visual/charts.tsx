import { useId } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { compact, shortDay } from './chartFormat'
import { usePrefersReducedMotion } from './motion'

export interface DayPoint {
  /** YYYY-MM-DD */
  date: string
  value: number
}

const AXIS = { fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-ui)' }
/** Lets the chart draw in tests and before the container has been measured. */
const FIRST_SIZE = { width: 640, height: 240 }

interface TipProps {
  active?: boolean
  payload?: { value?: number | string }[]
  label?: string
  series: string
  format: (n: number) => string
}

function Tip({ active, payload, label, series, format }: Readonly<TipProps>) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-md)] px-3 py-2">
      <div className="text-[11px] text-[var(--color-text-muted)]">{shortDay(label)}</div>
      <div className="text-[13px] font-semibold text-[var(--color-text)]">
        {format(Number(payload[0].value ?? 0))}{' '}
        <span className="font-normal text-[var(--color-text-secondary)]">{series}</span>
      </div>
    </div>
  )
}

interface ChartProps {
  data: DayPoint[]
  /** What the value is, in lower case, e.g. "collected". Shown in the tooltip. */
  series: string
  /** One sentence for screen readers: what the chart shows and its total. */
  summary: string
  format?: (n: number) => string
  /** CSS colour of the series; a chart token. */
  colour?: string
  height?: number
}

/** A label every few days, so the axis never crowds. */
const tickGap = (days: number) => (days <= 7 ? 0 : days <= 30 ? 4 : 13)

/** Change over time for one measure: a line with a soft fill beneath it. */
export function TrendArea({
  data,
  series,
  summary,
  format = compact,
  colour = 'var(--chart-1)',
  height = 240,
}: Readonly<ChartProps>) {
  const still = usePrefersReducedMotion()
  const fill = useId().replace(/:/g, '')
  return (
    <figure className="m-0" aria-label={summary}>
      <ResponsiveContainer width="100%" height={height} initialDimension={FIRST_SIZE}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colour} stopOpacity={0.28} />
              <stop offset="100%" stopColor={colour} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-divider)" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDay}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
            interval={tickGap(data.length)}
          />
          <YAxis
            tickFormatter={compact}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={44}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: 'var(--color-border-strong)', strokeDasharray: '3 3' }}
            content={<Tip series={series} format={format} />}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={colour}
            strokeWidth={2}
            fill={`url(#${fill})`}
            activeDot={{ r: 5, stroke: 'var(--color-card)', strokeWidth: 2 }}
            isAnimationActive={!still}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  )
}

/** A count per day: thin bars rising from the baseline. */
export function DayBars({
  data,
  series,
  summary,
  format = compact,
  colour = 'var(--chart-3)',
  height = 240,
}: Readonly<ChartProps>) {
  const still = usePrefersReducedMotion()
  return (
    <figure className="m-0" aria-label={summary}>
      <ResponsiveContainer width="100%" height={height} initialDimension={FIRST_SIZE}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          barCategoryGap="28%"
        >
          <CartesianGrid vertical={false} stroke="var(--color-divider)" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDay}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
            interval={tickGap(data.length)}
          />
          <YAxis
            tickFormatter={compact}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={32}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-hover-neutral)' }}
            content={<Tip series={series} format={format} />}
          />
          <Bar
            dataKey="value"
            fill={colour}
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
            isAnimationActive={!still}
            animationDuration={600}
          />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  )
}

export interface Share {
  key: string
  label: string
  value: number
  /** CSS colour. Status colours for outcomes. */
  colour: string
}

/**
 * Parts of a whole on one line, with a legend that carries the numbers, so
 * nothing depends on colour alone.
 */
export function ShareBar({
  parts,
  summary,
  empty,
}: Readonly<{ parts: Share[]; summary: string; empty: string }>) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  if (total === 0) return <p className="text-[13px] text-[var(--color-text-muted)] m-0">{empty}</p>
  const shown = parts.filter((p) => p.value > 0)
  const gap = 0.6
  const room = 100 - gap * (shown.length - 1)
  // Each segment starts where the ones before it end.
  const segments = shown.map((p, i) => ({
    ...p,
    width: (p.value / total) * room,
    x: shown.slice(0, i).reduce((at, q) => at + (q.value / total) * room + gap, 0),
  }))
  return (
    <div>
      <svg
        viewBox="0 0 100 6"
        preserveAspectRatio="none"
        className="w-full h-3 block"
        role="img"
        aria-label={summary}
      >
        {segments.map((p) => (
          <rect key={p.key} x={p.x} y={0} width={p.width} height={6} rx={1.2} fill={p.colour} />
        ))}
      </svg>
      <ul className="list-none m-0 mt-3 p-0 flex flex-wrap gap-x-5 gap-y-1.5">
        {parts.map((p) => (
          <li
            key={p.key}
            className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)]"
          >
            <svg width={10} height={10} aria-hidden="true">
              <rect width={10} height={10} rx={2.5} fill={p.colour} />
            </svg>
            {p.label}
            <span className="font-semibold text-[var(--color-text)]">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface Ranked {
  id: string
  name: string
  value: number
  /** Second line, e.g. "3 bookings". */
  note: string
}

/** A short ranking: a name, its value, and a bar relative to the leader. */
export function RankBars({
  rows,
  format,
  empty,
}: Readonly<{ rows: Ranked[]; format: (n: number) => string; empty: string }>) {
  const top = Math.max(...rows.map((r) => r.value), 0)
  if (rows.length === 0)
    return <p className="text-[13px] text-[var(--color-text-muted)] m-0">{empty}</p>
  return (
    <ol className="list-none m-0 p-0 flex flex-col gap-3.5">
      {rows.map((r) => (
        <li key={r.id}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-medium text-[var(--color-text)] truncate">
              {r.name}
            </span>
            <span className="text-[13px] font-semibold text-[var(--color-text)] whitespace-nowrap">
              {format(r.value)}
            </span>
          </div>
          <svg
            viewBox="0 0 100 4"
            preserveAspectRatio="none"
            className="w-full h-1.5 block mt-1.5"
            aria-hidden="true"
          >
            <rect width={100} height={4} rx={2} fill="var(--color-divider)" />
            <rect
              width={top > 0 ? Math.max(2, (r.value / top) * 100) : 0}
              height={4}
              rx={2}
              fill="var(--chart-1)"
            />
          </svg>
          <div className="text-[12px] text-[var(--color-text-muted)] mt-1">{r.note}</div>
        </li>
      ))}
    </ol>
  )
}
