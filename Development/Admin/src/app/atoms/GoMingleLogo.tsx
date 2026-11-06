import logoFull from '../../assets/gomingle-logo.png'
import logoFullLight from '../../assets/gomingle-logo-light.png'
import logoMark from '../../assets/gomingle-mark.png'

interface GoMingleLogoProps {
  collapsed?: boolean
  /** Height of the full logo image (default 36px) */
  height?: number
  /** Use the light (white wordmark) lockup for dark backgrounds. */
  light?: boolean
}

export function GoMingleLogo({ collapsed = false, height = 36, light = false }: GoMingleLogoProps) {
  if (collapsed) {
    return (
      <img
        src={logoMark}
        alt="GoMingle"
        style={{ height: height + 4, width: 'auto', display: 'block', objectFit: 'contain' }}
        draggable={false}
      />
    )
  }

  return (
    <img
      src={light ? logoFullLight : logoFull}
      alt="GoMingle"
      style={{ height, width: 'auto', display: 'block', objectFit: 'contain' }}
      draggable={false}
    />
  )
}
