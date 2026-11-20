import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Input, Modal, Skeleton, Switch, Tag, message } from 'antd'
import {
  Desktop,
  DeviceMobile,
  Key,
  ShieldCheck,
  ShieldWarning,
  SignOut,
} from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { AppButton } from '../../atoms/AppButton'
import { ModalActions } from '../../atoms/ModalActions'
import { MODAL_WIDTH } from '../../atoms/modalWidth'
import { useAppSelector } from '../../../shared/store/hooks'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { downloadBlob } from '../../../shared/utils/csvExport'
import { describeDevice, securityService, type AdminSignIn } from './services'
import { TwoStepSetupModal } from './TwoStepSetupModal'

dayjs.extend(relativeTime)

const OVERVIEW_KEY = ['security', 'overview'] as const
const SESSIONS_KEY = ['security', 'sessions'] as const

const card =
  'rounded-[var(--radius-md,16px)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 md:p-6'

/**
 * Security (GM-346): two-step sign-in, where this admin is signed in, and, for
 * super admins, whether every admin must use two-step sign-in.
 */
export function SecurityPage() {
  const { t } = useTranslation('security')
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const forced = params.get('setup') === '1'
  const email = useAppSelector((s) => s.auth.user?.email ?? '')
  const [messageApi, holder] = message.useMessage()
  const [setupOpen, setSetupOpen] = useState(false)
  const [passwordFor, setPasswordFor] = useState<'disable' | 'codes' | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [newCodes, setNewCodes] = useState<string[] | null>(null)

  const overview = useQuery({ queryKey: OVERVIEW_KEY, queryFn: securityService.overview })
  const sessions = useQuery({ queryKey: SESSIONS_KEY, queryFn: securityService.sessions })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['security'] })
  }

  const signOut = useMutation({
    mutationFn: (s: AdminSignIn) => securityService.signOut(s.id),
    onSuccess: () => {
      void messageApi.success(t('sessions.signedOut'))
      refresh()
    },
    onError: (e) => void messageApi.error(getApiErrorMessage(e, t('errors.generic'))),
  })
  const signOutOthers = useMutation({
    mutationFn: securityService.signOutOthers,
    onSuccess: (r) => {
      void messageApi.success(t('sessions.signedOutOthers', { count: r.signedOut }))
      refresh()
    },
    onError: (e) => void messageApi.error(getApiErrorMessage(e, t('errors.generic'))),
  })
  const policy = useMutation({
    mutationFn: (v: boolean) => securityService.setPolicy(v),
    onSuccess: (r) => {
      void messageApi.success(r.requireTwoStep ? t('policy.nowRequired') : t('policy.nowOptional'))
      refresh()
    },
    onError: (e) => void messageApi.error(getApiErrorMessage(e, t('errors.generic'))),
  })

  const confirmPassword = async () => {
    setPasswordError('')
    try {
      if (passwordFor === 'disable') {
        await securityService.disable(password)
        void messageApi.success(t('twoStep.turnedOff'))
      } else {
        const r = await securityService.newBackupCodes(password)
        setNewCodes(r.backupCodes)
      }
      setPasswordFor(null)
      setPassword('')
      refresh()
    } catch (e) {
      setPasswordError(getApiErrorMessage(e, t('errors.generic')))
    }
  }

  const twoStep = overview.data?.twoStep
  const others = (sessions.data?.items ?? []).filter((s) => !s.current).length

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-5">
      {holder}
      <div>
        <h1 className="m-0 text-[20px] font-bold text-[var(--color-text)] md:text-[26px]">
          {t('title')}
        </h1>
        <p className="m-0 mt-1 text-[14px] text-[var(--color-text-muted)]">{t('subtitle')}</p>
      </div>

      {forced && twoStep && !twoStep.enabled && (
        <Alert
          type="warning"
          showIcon
          icon={<ShieldWarning size={20} />}
          message={t('forced.title')}
          description={t('forced.body')}
          data-testid="two-step-required-banner"
        />
      )}

      {/* ── Two-step sign-in ─────────────────────────────────────────── */}
      <section className={card} aria-labelledby="sec-two-step">
        {overview.isPending ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : overview.isError ? (
          <Alert
            type="error"
            showIcon
            message={getApiErrorMessage(overview.error, t('errors.load'))}
          />
        ) : (
          twoStep && (
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex gap-4">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                    twoStep.enabled
                      ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                      : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                  }`}
                >
                  {twoStep.enabled ? (
                    <ShieldCheck size={22} weight="fill" />
                  ) : (
                    <ShieldWarning size={22} weight="fill" />
                  )}
                </span>
                <div>
                  <h2
                    id="sec-two-step"
                    className="m-0 flex flex-wrap items-center gap-2 text-[16px] font-semibold"
                  >
                    {t('twoStep.title')}
                    <Tag
                      color={twoStep.enabled ? 'success' : 'warning'}
                      data-testid="two-step-status"
                    >
                      {twoStep.enabled ? t('twoStep.on') : t('twoStep.off')}
                    </Tag>
                  </h2>
                  <p className="m-0 mt-1 text-[14px] text-[var(--color-text-secondary)]">
                    {twoStep.enabled
                      ? t('twoStep.onBody', {
                          date: dayjs(twoStep.enabledAt).format('D MMM YYYY'),
                          count: twoStep.backupCodesLeft,
                        })
                      : t('twoStep.offBody')}
                  </p>
                  {twoStep.enabled && twoStep.backupCodesLeft <= 3 && (
                    <p className="m-0 mt-2 text-[13px] font-semibold text-[var(--color-warning)]">
                      {t('twoStep.fewCodes', { count: twoStep.backupCodesLeft })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {twoStep.enabled ? (
                  <>
                    <AppButton variant="neutral" onClick={() => setPasswordFor('codes')}>
                      <Key size={14} aria-hidden /> {t('twoStep.newCodes')}
                    </AppButton>
                    {!twoStep.required && (
                      <AppButton variant="danger" onClick={() => setPasswordFor('disable')}>
                        {t('twoStep.turnOff')}
                      </AppButton>
                    )}
                  </>
                ) : (
                  <AppButton
                    variant="primary"
                    onClick={() => setSetupOpen(true)}
                    data-testid="two-step-start"
                  >
                    <ShieldCheck size={14} aria-hidden /> {t('twoStep.turnOn')}
                  </AppButton>
                )}
              </div>
            </div>
          )
        )}
      </section>

      {/* ── Where you're signed in ───────────────────────────────────── */}
      <section className={card} aria-labelledby="sec-sessions">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="sec-sessions" className="m-0 text-[16px] font-semibold">
              {t('sessions.title')}
            </h2>
            <p className="m-0 mt-1 text-[14px] text-[var(--color-text-secondary)]">
              {t('sessions.body')}
            </p>
          </div>
          {others > 0 && (
            <AppButton
              variant="danger"
              onClick={() => signOutOthers.mutate()}
              loading={signOutOthers.isPending}
              data-testid="sign-out-others"
            >
              <SignOut size={14} aria-hidden /> {t('sessions.signOutOthers', { count: others })}
            </AppButton>
          )}
        </div>
        {sessions.isPending ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-[var(--color-divider)] p-0">
            {(sessions.data?.items ?? []).map((s) => {
              const d = describeDevice(s.userAgent)
              const Icon = d.mobile ? DeviceMobile : Desktop
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 py-3"
                  data-testid={`session-${s.id}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-hover-neutral)] text-[var(--color-text-secondary)]">
                    <Icon size={18} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-[var(--color-text)]">
                      {t('sessions.device', { browser: d.browser, os: d.os })}
                      {s.current && <Tag color="green">{t('sessions.thisDevice')}</Tag>}
                    </div>
                    <div className="truncate text-[12px] text-[var(--color-text-muted)]">
                      {[
                        s.ip,
                        t('sessions.signedIn', {
                          when: dayjs(s.createdAt).format('D MMM, h:mm A'),
                        }),
                        t('sessions.lastSeen', { when: dayjs(s.lastSeenAt).fromNow() }),
                        s.method === 'backup' ? t('sessions.viaBackup') : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  {!s.current && (
                    <AppButton
                      variant="neutral"
                      onClick={() => signOut.mutate(s)}
                      aria-label={t('sessions.signOutOne', { browser: d.browser, os: d.os })}
                    >
                      {t('sessions.signOut')}
                    </AppButton>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── Rule for every admin (super admins) ──────────────────────── */}
      {overview.data?.canChangePolicy && (
        <section className={card} aria-labelledby="sec-policy">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="sec-policy" className="m-0 text-[16px] font-semibold">
                {t('policy.title')}
              </h2>
              <p className="m-0 mt-1 text-[14px] text-[var(--color-text-secondary)]">
                {twoStep?.enabled ? t('policy.body') : t('policy.needOwn')}
              </p>
            </div>
            <Switch
              checked={overview.data.policy.requireTwoStep}
              disabled={!twoStep?.enabled || policy.isPending}
              loading={policy.isPending}
              onChange={(v) => policy.mutate(v)}
              aria-label={t('policy.title')}
              data-testid="policy-switch"
            />
          </div>
        </section>
      )}

      <TwoStepSetupModal
        open={setupOpen}
        email={email}
        onClose={() => setSetupOpen(false)}
        onDone={() => {
          refresh()
          void messageApi.success(t('twoStep.turnedOn'))
          if (forced) window.location.assign('/')
        }}
      />

      <Modal
        open={!!passwordFor}
        onCancel={() => {
          setPasswordFor(null)
          setPassword('')
          setPasswordError('')
        }}
        width={MODAL_WIDTH.confirm}
        destroyOnHidden
        title={passwordFor === 'disable' ? t('twoStep.turnOffTitle') : t('twoStep.newCodesTitle')}
        footer={
          <ModalActions
            onCancel={() => setPasswordFor(null)}
            onConfirm={() => void confirmPassword()}
            confirmLabel={passwordFor === 'disable' ? t('twoStep.turnOff') : t('twoStep.newCodes')}
            confirmDisabled={!password}
            danger={passwordFor === 'disable'}
          />
        }
      >
        <p className="text-[14px] text-[var(--color-text-secondary)]">
          {passwordFor === 'disable' ? t('twoStep.turnOffBody') : t('twoStep.newCodesBody')}
        </p>
        <Input.Password
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onPressEnter={() => password && void confirmPassword()}
          placeholder={t('passwordPlaceholder')}
          aria-label={t('passwordPlaceholder')}
          autoFocus
        />
        {passwordError && (
          <p className="m-0 mt-2 text-[12px] text-[var(--color-error)]">{passwordError}</p>
        )}
      </Modal>

      <Modal
        open={!!newCodes}
        onCancel={() => setNewCodes(null)}
        footer={null}
        width={MODAL_WIDTH.large}
        title={t('twoStep.newCodesTitle')}
      >
        <p className="text-[14px] text-[var(--color-text-secondary)]">{t('setup.backupIntro')}</p>
        <ul className="m-0 mb-4 grid list-none grid-cols-2 gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-4 font-mono text-[15px] font-semibold tracking-[0.08em]">
          {(newCodes ?? []).map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <AppButton
          variant="secondary"
          onClick={() =>
            downloadBlob(
              'gomingle-admin-backup-codes.txt',
              new Blob([[t('setup.fileTitle'), email, '', ...(newCodes ?? [])].join('\r\n')], {
                type: 'text/plain',
              }),
            )
          }
        >
          {t('setup.download')}
        </AppButton>
      </Modal>
    </div>
  )
}
