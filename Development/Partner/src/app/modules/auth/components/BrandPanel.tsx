import { useTranslation } from 'react-i18next'
import { GoMingleLogo } from '../../../atoms/GoMingleLogo'
import markUrl from '../../../../assets/gomingle-mark.png'

/** Landing hero in the GoMingle brand colours: logo navy with coral accents. */
export function BrandPanel() {
  const { t } = useTranslation('auth')
  const chips = [t('brandPanel.chip1'), t('brandPanel.chip2'), t('brandPanel.chip3')]

  return (
    <div className="relative w-full h-full flex flex-col justify-center px-16 py-16 overflow-hidden min-h-screen bg-[linear-gradient(150deg,#120F22_0%,#1C1730_55%,#2B2147_100%)]">
      {/* Coral glow — top right */}
      <div className="absolute pointer-events-none w-[420px] h-[420px] rounded-full -top-[140px] -right-[120px] bg-[radial-gradient(circle,rgba(255,90,68,0.28)_0%,rgba(255,90,68,0)_70%)]" />
      {/* Decorative ring — bottom left */}
      <div className="absolute pointer-events-none w-[260px] h-[260px] rounded-full border border-white/[0.07] -bottom-[70px] -left-[50px]" />
      {/* Brand star watermark */}
      <img
        src={markUrl}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute pointer-events-none w-[220px] h-[220px] right-[48px] bottom-[56px] opacity-[0.08]"
      />

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
      <p className="text-[15px] text-white/70 leading-[1.75] mb-9 max-w-[380px]">
        {t('brandPanel.body')}
      </p>

      {/* Pill chips */}
      <div className="flex gap-3 flex-wrap">
        {chips.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center h-[30px] px-[14px] rounded-[100px] border border-[#FF5A44]/50 text-white/85 text-[11px] font-semibold tracking-[0.08em] uppercase"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  )
}
