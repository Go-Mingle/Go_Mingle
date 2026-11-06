import { Input, Tooltip } from 'antd'
import { Info, ArrowsClockwise, Eye, EyeSlash } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'
import { BEARER_TOKEN_MAX_LENGTH, ENDPOINT_URL_MAX_LENGTH } from '../constants'

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'
const MONO = 'font-[ui-monospace,SFMono-Regular,Menlo,monospace]'
// Read-only method/scheme word shown before the field value; matches the field
// font (13.5px mono, weight 500) in the muted colour so it reads as one control.
const PREFIX = `${MONO} text-[13.5px]! font-medium text-[var(--color-text-muted)]`
const FIELD = `${MONO} text-[13.5px]!`

function FieldPrefix({ children }: { children: string }) {
  return <span className={PREFIX}>{children}</span>
}

function FieldLabel({
  text,
  tooltip,
  required,
}: {
  text: string
  tooltip: string
  required?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className={LABEL}>
        {text}
        {required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
      </span>
      <Tooltip title={tooltip}>
        <Info size={13} className="text-[var(--color-text-subtle)] cursor-help" />
      </Tooltip>
    </div>
  )
}

const HINT = 'text-[12px] mt-2 mb-0'

/**
 * One control with two states, never unmounted (MET-1276): a token the partner
 * revealed to copy has to be concealable again without reloading the page.
 */
function TokenVisibilityButton({
  revealed,
  busy,
  onToggle,
}: {
  revealed: boolean
  busy: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation('integrations')
  const label = revealed ? t('auth.hide') : t('auth.reveal')

  return (
    <Tooltip title={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={revealed}
        onClick={onToggle}
        disabled={busy}
        className="border-none bg-transparent p-0 cursor-pointer text-[var(--color-text-subtle)] md:hover:text-[var(--color-text)] disabled:opacity-50"
      >
        {revealed ? <EyeSlash size={15} /> : <Eye size={15} />}
      </button>
    </Tooltip>
  )
}

interface SetupCardProps {
  endpointUrl: string
  onEndpointChange: (v: string) => void
  endpointError?: string
  /** The partner's edit, the revealed plaintext, or the server's mask. */
  bearerToken: string
  /** True once the field holds a real value rather than the mask. */
  tokenRevealed?: boolean
  revealing?: boolean
  /** Show ⇄ hide the stored token. Omitted when there is nothing to unmask. */
  onToggleToken?: () => void
  onTokenChange: (v: string) => void
  tokenError?: string
  secretMasked: string | null
  onRotate: () => void
  rotating?: boolean
  onSave: () => void
  saving?: boolean
}

/** Single Setup card: endpoint, authorization and signing secret stacked
 *  vertically on all breakpoints, with one Save below. */
export function SetupCard({
  endpointUrl,
  onEndpointChange,
  endpointError,
  bearerToken,
  tokenRevealed = false,
  revealing = false,
  onToggleToken,
  onTokenChange,
  tokenError,
  secretMasked,
  onRotate,
  rotating,
  onSave,
  saving,
}: SetupCardProps) {
  const { t } = useTranslation('integrations')

  return (
    <div className="bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-5 md:p-6">
      {/* Endpoint, Authorization and Signing secret — always stacked vertically. */}
      <div className="flex flex-col gap-4">
        <div>
          <FieldLabel text={t('endpoint.title')} tooltip={t('endpoint.sub')} />
          <Input
            size="large"
            value={endpointUrl}
            onChange={(e) => onEndpointChange(e.target.value)}
            placeholder={t('endpoint.placeholder')}
            status={endpointError ? 'error' : undefined}
            className={FIELD}
            prefix={<FieldPrefix>POST</FieldPrefix>}
            maxLength={ENDPOINT_URL_MAX_LENGTH}
          />
          <p
            className={`${HINT} ${endpointError ? 'text-[var(--color-error)]' : 'text-[var(--color-text-subtle)]'}`}
          >
            {endpointError ?? t('endpoint.hintShort')}
          </p>
        </div>

        <div>
          <FieldLabel text={t('auth.title')} tooltip={t('auth.sub')} required />
          {/*
            A plain Input with our own eye, not Input.Password: the stored token
            arrives masked, so toggling the browser's own visibility would only
            un-hide bullet characters. The eye fetches the real value instead,
            and toggling it back drops the plaintext for the mask again.
          */}
          <Input
            size="large"
            value={bearerToken}
            onChange={(e) => onTokenChange(e.target.value)}
            placeholder={t('auth.placeholder')}
            status={tokenError ? 'error' : undefined}
            className={FIELD}
            prefix={<FieldPrefix>Bearer</FieldPrefix>}
            maxLength={BEARER_TOKEN_MAX_LENGTH}
            suffix={
              onToggleToken ? (
                <TokenVisibilityButton
                  revealed={tokenRevealed}
                  busy={revealing}
                  onToggle={onToggleToken}
                />
              ) : null
            }
          />
          <p
            className={`${HINT} ${tokenError ? 'text-[var(--color-error)]' : 'text-[var(--color-text-subtle)]'}`}
          >
            {tokenError ?? t('auth.hintShort')}
          </p>
        </div>

        {/* Signing secret — controls match the input height (40px). */}
        <div>
          <FieldLabel text={t('secret.title')} tooltip={t('secret.sub')} />
          <div className="flex items-center gap-2.5">
            <div
              className={`flex-1 min-w-0 h-10 flex items-center px-3.5 rounded-[8px] bg-[var(--color-input-bg)] border border-[var(--color-input-border)] overflow-hidden ${MONO}`}
            >
              <span
                className={`text-[13.5px] truncate ${secretMasked ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-subtle)]'}`}
              >
                {secretMasked ?? t('secret.placeholder')}
              </span>
            </div>
            {/*
              No Copy control here by design. Only the mask is ever readable
              after generation (BR-04 / AC-02.3), so a Copy would put
              "whsec_••••3a9f" on the clipboard. Copy lives in the show-once
              reveal modal, which is the only place the real secret exists.
            */}
            {secretMasked && (
              <button
                type="button"
                onClick={onRotate}
                disabled={rotating}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-card)] text-[13px] font-medium text-[var(--color-text-secondary)] cursor-pointer md:hover:border-[var(--color-text-muted)] md:hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
              >
                <ArrowsClockwise size={15} />
                {t('secret.rotate')}
              </button>
            )}
          </div>
          <p className={`${HINT} text-[var(--color-text-subtle)]`}>{t('secret.hint')}</p>
        </div>
      </div>

      {/* Save */}
      <div className="mt-6 pt-5 border-t border-[var(--color-border)] flex justify-end">
        <AppButton
          variant="primary"
          onClick={onSave}
          disabled={saving}
          className="w-full sm:w-auto justify-center"
        >
          {saving ? t('save.saving') : t('save.button')}
        </AppButton>
      </div>
    </div>
  )
}
