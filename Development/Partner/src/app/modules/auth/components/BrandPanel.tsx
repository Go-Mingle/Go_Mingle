import { useTranslation } from 'react-i18next'
import { ChartLineUp, ShieldCheck, UsersThree } from '@phosphor-icons/react'
import { GoMingleLogo } from '../../../atoms/GoMingleLogo'

/** Landing hero in the GoMingle brand colours: logo navy with coral accents. */
export function BrandPanel() {
  const { t } = useTranslation('auth')
  const points = [
    { Icon: UsersThree, text: t('brandPanel.point1') },
    { Icon: ShieldCheck, text: t('brandPanel.point2') },
    { Icon: ChartLineUp, text: t('brandPanel.point3') },
  ]
  // A table seen from above: eight seats, five of them taken.
  const seats = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2
    return { x: 100 + Math.cos(angle) * 74, y: 100 + Math.sin(angle) * 74, taken: i < 5 }
  })

  return (
    <div className="relative w-full h-full flex flex-col justify-center px-16 py-16 overflow-hidden min-h-screen bg-[linear-gradient(150deg,#120F22_0%,#1C1730_55%,#2B2147_100%)]">
      {/* Coral glow — top right */}
      <div className="absolute pointer-events-none w-[420px] h-[420px] rounded-full -top-[140px] -right-[120px] bg-[radial-gradient(circle,rgba(255,90,68,0.28)_0%,rgba(255,90,68,0)_70%)]" />
      {/* A table filling up — bottom right */}
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        className="absolute pointer-events-none w-[300px] h-[300px] -right-[40px] -bottom-[50px]"
      >
        <circle
          cx={100}
          cy={100}
          r={46}
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={1.5}
        />
        {seats.map((seat, i) => (
          <circle
            key={i}
            cx={seat.x}
            cy={seat.y}
            r={13}
            fill={seat.taken ? '#FF5A44' : 'transparent'}
            fillOpacity={seat.taken ? 0.85 : 1}
            stroke={seat.taken ? '#FF5A44' : 'rgba(255,255,255,0.22)'}
            strokeWidth={2}
            strokeDasharray={seat.taken ? undefined : '4 5'}
          />
        ))}
      </svg>

      {/* Logo */}
      <div className="mb-14">
        <GoMingleLogo light height={48} />
      </div>

      {/* Tagline */}
      <h1 className="text-[40px] font-extrabold text-white leading-[1.12] font-[var(--font-display)] mb-5 tracking-[-0.02em] whitespace-pre-line">
        {t('brandPanel.tagline')}
      </h1>
      <div className="w-[56px] h-[4px] rounded-full bg-[#FF5A44] mb-6" />

      {/* Body copy */}
      <p className="text-[15px] text-white/70 leading-[1.75] mb-8 max-w-[380px]">
        {t('brandPanel.body')}
      </p>

      {/* What the portal does for a restaurant */}
      <ul className="relative list-none m-0 p-0 flex flex-col gap-3.5 max-w-[380px]">
        {points.map(({ Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-[14px] text-white/85">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[#FF8A78]">
              <Icon size={16} weight="fill" />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </div>
  )
}
