import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { GoMingleLogo, GoMingleMark } from '../../../atoms/GoMingleLogo'

/** Sample tables for the hero: GoMingle tables come in every size. */
const FLOOR = [
  { key: 'chess', size: 2, taken: 2 },
  { key: 'founders', size: 6, taken: 4 },
  { key: 'poetry', size: 10, taken: 3 },
] as const

/** One row of seats: guests filled in, open seats as outlines. */
function SeatDots({ size, taken }: { size: number; taken: number }) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-hidden="true">
      {Array.from({ length: size }, (_, i) => (
        <span
          key={i}
          className={`w-3 h-3 rounded-full ${
            i < taken
              ? i % 2
                ? 'bg-[#3FD6B4]'
                : 'bg-[#FFB547]'
              : 'border-[1.5px] border-[#FFB547]'
          }`}
        />
      ))}
    </div>
  )
}

/**
 * Landing hero for restaurant owners (GM-336): the table mark draws itself and
 * a sample evening shows tables of different sizes filling up.
 */
export function BrandPanel() {
  const { t } = useTranslation('auth')

  return (
    <div className="gm-auth-hero relative w-full h-full min-h-screen flex flex-col gap-10 px-16 py-12 overflow-hidden">
      <GoMingleLogo light height={30} />

      <div className="flex items-center gap-10 flex-grow">
        <GoMingleMark size={190} light animated />
        <div className="flex flex-col gap-4 max-w-[440px]">
          <h1 className="m-0 text-[38px] leading-[1.1] font-bold text-[#F4F1FF] font-(--font-display) tracking-[-0.01em]">
            {t('brandPanel.tagline')}
          </h1>
          <p className="m-0 text-[16px] leading-[1.65] text-[#B9B3D6]">{t('brandPanel.body')}</p>
        </div>
      </div>

      <section aria-labelledby="gm-floor-title" className="flex flex-col gap-3">
        <h2 id="gm-floor-title" className="m-0 text-[14px] font-bold text-[#D6D1EE]">
          {t('brandPanel.floorTitle')}
        </h2>
        <ul className="list-none m-0 p-0 grid grid-cols-3 gap-3">
          {FLOOR.map(({ key, size, taken }, i) => {
            const open = size - taken
            return (
              <li
                key={key}
                className="gm-rise flex flex-col gap-2.5 p-4 rounded-[18px] bg-[#1E1838] border border-[#2E2752]"
                style={{ '--rise-delay': `${1500 + i * 150}ms` } as CSSProperties}
              >
                <span className="text-[13px] text-[#B9B3D6]">
                  {t(`brandPanel.floor.${key}.time`)} · {t('brandPanel.tableFor', { count: size })}
                </span>
                <span className="text-[15px] font-bold text-[#F4F1FF]">
                  {t(`brandPanel.floor.${key}.name`)}
                </span>
                <SeatDots size={size} taken={taken} />
                <span
                  className={`text-[13px] font-semibold ${open ? 'text-[#FFB547]' : 'text-[#3FD6B4]'}`}
                >
                  {open ? t('brandPanel.seatsOpen', { count: open }) : t('brandPanel.full')}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
