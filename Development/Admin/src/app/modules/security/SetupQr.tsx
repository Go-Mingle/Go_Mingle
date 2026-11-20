import { useEffect, useState } from 'react'
import { Skeleton } from 'antd'
import { useTranslation } from 'react-i18next'

/**
 * The otpauth link as a QR code for the authenticator app to scan. The QR
 * library loads only here, so the rest of the panel doesn't carry it.
 * Always dark on white, in both themes, so every phone camera reads it.
 */
export function SetupQr({ url }: { url: string }) {
  const { t } = useTranslation('security')
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void import('qrcode')
      .then((QR) =>
        QR.toString(url, {
          type: 'svg',
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#14121f', light: '#ffffff' },
        }),
      )
      .then((s) => live && setSvg(s))
      .catch(() => live && setSvg(''))
    return () => {
      live = false
    }
  }, [url])

  if (svg === null) return <Skeleton.Image active className="!h-[176px] !w-[176px]" />
  if (!svg) return null
  return (
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      alt={t('setup.qrAlt')}
      width={176}
      height={176}
      data-testid="two-step-qr"
      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-2"
    />
  )
}
