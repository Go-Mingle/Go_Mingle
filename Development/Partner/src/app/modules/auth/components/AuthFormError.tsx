import { WarningCircle } from '@phosphor-icons/react'

interface AuthFormErrorProps {
  /** Rendered only when non-empty, so call sites pass their error state straight through. */
  message?: string
  /** Matches the OTP step, whose field and error are centred under the code boxes. */
  centered?: boolean
}

/**
 * The single inline error line for the auth flows.
 *
 * `role="alert"` is the whole point of this component. Every reset and signup
 * step used to render a bare 12px `<p>`, so a rate-limited "Send code" produced
 * no announcement and no landmark — nothing a screen reader, or an
 * accessibility check, could observe. That is how a `LIMIT_EXCEEDED` message
 * that *was* mapped and *was* rendered still got reported as a dead button
 * (MET-1242). Only `LoginStep` had the alert role, which is why sign-in never
 * showed the same symptom.
 *
 * Deliberately kept as a compact field-level line rather than `LoginStep`'s
 * banner: the same slot also carries routine validation copy ("Enter a valid
 * email address"), and a full banner for that would be heavy-handed.
 */
export function AuthFormError({ message, centered }: Readonly<AuthFormErrorProps>) {
  if (!message) return null

  return (
    <div
      role="alert"
      className={`flex items-start gap-1.5 ${centered ? 'justify-center' : ''}`.trim()}
    >
      <WarningCircle
        size={15}
        weight="fill"
        className="text-[var(--color-error)] shrink-0 mt-px"
      />
      <p className="text-[13px] text-[var(--color-error)] m-0">{message}</p>
    </div>
  )
}
