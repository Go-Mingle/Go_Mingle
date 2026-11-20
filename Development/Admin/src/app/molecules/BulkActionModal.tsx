import { useState, type ReactNode } from 'react'
import { Alert, Input, Modal, Progress } from 'antd'
import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { ModalActions, PrimaryActionButton } from '../atoms/ModalActions'
import { MODAL_WIDTH } from '../atoms/modalWidth'
import { runBulk } from '../../shared/utils/bulk'
import { getApiErrorMessage } from '../../shared/utils/apiError'

export interface BulkItem {
  id: string
  name: string
}

interface Props {
  open: boolean
  /** e.g. "Suspend 3 restaurants?" */
  title: string
  /** What happens, in one sentence. */
  description: ReactNode
  /** Button label, e.g. "Suspend 3". */
  confirmLabel: string
  items: BulkItem[]
  danger?: boolean
  /** Ask for a reason that every item gets (e.g. suspension). */
  reason?: { label: string; placeholder?: string; min: number; max?: number }
  /** Extra inputs (e.g. a category picker); `ready` false keeps confirm disabled. */
  extra?: ReactNode
  ready?: boolean
  task: (item: BulkItem, reason: string) => Promise<unknown>
  onClose: () => void
  /** After the run; `doneIds` changed, the rest did not. */
  onFinished: (doneIds: string[]) => void
}

const PREVIEW = 5

/**
 * Confirms a bulk action naming the count and the first few rows, runs it one
 * record at a time (so the API audits each one), shows progress, then says
 * exactly which rows did not change and why.
 */
export function BulkActionModal({
  open,
  title,
  description,
  confirmLabel,
  items,
  danger,
  reason,
  extra,
  ready = true,
  task,
  onClose,
  onFinished,
}: Props) {
  const { t } = useTranslation('common')
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<'confirm' | 'running' | 'done'>('confirm')
  const [finished, setFinished] = useState(0)
  const [failed, setFailed] = useState<{ name: string; message: string }[]>([])
  const [doneCount, setDoneCount] = useState(0)

  const reasonOk = !reason || text.trim().length >= reason.min
  const close = () => {
    if (phase === 'running') return
    onClose()
  }

  const start = async () => {
    setPhase('running')
    setFinished(0)
    const res = await runBulk(items, (item) => task(item, text.trim()), { onProgress: setFinished })
    setDoneCount(res.done.length)
    setFailed(
      res.failed.map((f) => ({
        name: f.item.name,
        message: getApiErrorMessage(f.error, t('errors.genericError')),
      })),
    )
    setPhase('done')
    onFinished(res.done.map((d) => d.id))
  }

  const percent = items.length ? Math.round((finished / items.length) * 100) : 0

  return (
    <Modal
      open={open}
      onCancel={close}
      closable={phase !== 'running'}
      maskClosable={phase !== 'running'}
      keyboard={phase !== 'running'}
      width={MODAL_WIDTH.large}
      destroyOnHidden
      title={<span className="text-[18px] font-semibold">{title}</span>}
      footer={
        phase === 'confirm' ? (
          <ModalActions
            onCancel={close}
            onConfirm={() => void start()}
            confirmLabel={confirmLabel}
            confirmDisabled={!reasonOk || !ready || items.length === 0}
            danger={danger}
          />
        ) : phase === 'done' ? (
          // One button: there is nothing left to cancel.
          <div className="flex justify-end">
            <PrimaryActionButton onClick={close}>
              {t('buttons.done', { defaultValue: 'Done' })}
            </PrimaryActionButton>
          </div>
        ) : null
      }
    >
      {phase === 'confirm' && (
        <div className="flex flex-col gap-3" data-testid="bulk-confirm">
          <p className="m-0 text-[14px] text-[var(--color-text-secondary)]">{description}</p>
          <ul className="m-0 flex list-none flex-col gap-1 rounded-[var(--radius-sm)] bg-[var(--color-hover-neutral)] px-3 py-2 text-[13px] text-[var(--color-text)]">
            {items.slice(0, PREVIEW).map((i) => (
              <li key={i.id} className="truncate">
                {i.name}
              </li>
            ))}
            {items.length > PREVIEW && (
              <li className="text-[var(--color-text-muted)]">
                {t('bulk.andMore', { count: items.length - PREVIEW })}
              </li>
            )}
          </ul>
          {extra}
          {reason && (
            <label className="flex flex-col gap-1 text-[13px] font-medium text-[var(--color-text)]">
              {reason.label}
              <Input.TextArea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={reason.max ?? 500}
                showCount
                placeholder={reason.placeholder}
              />
              {!reasonOk && text.length > 0 && (
                <span className="text-[12px] font-normal text-[var(--color-text-muted)]">
                  {t('bulk.reasonMin', { count: reason.min })}
                </span>
              )}
            </label>
          )}
        </div>
      )}

      {phase === 'running' && (
        <div className="flex flex-col items-center gap-3 py-4" role="status" aria-live="polite">
          <Progress type="circle" percent={percent} size={88} />
          <p className="m-0 text-[14px] text-[var(--color-text-secondary)]">
            {t('bulk.progress', { done: finished, total: items.length })}
          </p>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex flex-col gap-3" role="status" data-testid="bulk-result">
          {doneCount > 0 && (
            <p className="m-0 flex items-center gap-2 text-[14px] font-semibold text-[var(--color-success)]">
              <CheckCircle size={20} weight="fill" aria-hidden />
              {t('bulk.doneCount', { count: doneCount })}
            </p>
          )}
          {failed.length > 0 && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningCircle size={18} aria-hidden />}
              message={t('bulk.failedCount', { count: failed.length })}
              description={
                <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0 text-[13px]">
                  {failed.map((f) => (
                    <li key={f.name}>
                      <span className="font-semibold">{f.name}</span>: {f.message}
                    </li>
                  ))}
                </ul>
              }
            />
          )}
        </div>
      )}
    </Modal>
  )
}
