import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, SlidersHorizontal, Storefront } from '@phosphor-icons/react'
import { GoMingleLogo, GoMingleMark } from '../../../atoms/GoMingleLogo'

/** Landing hero for GoMingle staff (GM-336): the table mark draws itself beside what the panel is for. */
export function BrandPanel() {
  const { t } = useTranslation('auth')
  const points = [
    { Icon: Storefront, text: t('brandPanel.point1') },
    { Icon: ShieldCheck, text: t('brandPanel.point2') },
    { Icon: SlidersHorizontal, text: t('brandPanel.point3') },
  ]

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

      <ul className="list-none m-0 p-0 grid grid-cols-3 gap-3">
        {points.map(({ Icon, text }, i) => (
          <li
            key={text}
            className="gm-rise flex flex-col gap-3 p-4 rounded-[18px] bg-[#1E1838] border border-[#2E2752] text-[14px] leading-[1.45] text-[#D6D1EE]"
            style={{ '--rise-delay': `${1500 + i * 150}ms` } as CSSProperties}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,90,68,0.16)] text-[#FF8A78]">
              <Icon size={18} weight="bold" aria-hidden />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </div>
  )
}
