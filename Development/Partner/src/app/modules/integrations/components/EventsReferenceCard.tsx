import { useState } from 'react'
import { CaretRight } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { WebhookCard } from './WebhookCard'
import { CopyButton } from './CopyButton'
import { LabelTag } from '../../../atoms/LabelTag'
import { WEBHOOK_STREAMS } from '../webhookMeta'
import type { DeliveryMode } from '../webhookMeta'

function ModeTag({ mode }: { mode: DeliveryMode }) {
  const { t } = useTranslation('integrations')
  // Both Gating and Standard use the neutral LabelTag for consistency.
  return <LabelTag>{mode === 'gating' ? t('tags.gating') : t('tags.standard')}</LabelTag>
}

export function EventsReferenceCard() {
  const { t } = useTranslation('integrations')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <WebhookCard title={t('events.title')} titleInfo={t('events.titleTooltip')}>
      <div className="flex flex-col gap-5">
        {WEBHOOK_STREAMS.map((stream) => (
          <div key={stream.labelKey}>
            <div className="flex items-baseline gap-2.5 mb-1">
              <span className="text-[14px] font-semibold text-[var(--color-text)]">
                {t(stream.labelKey)}
              </span>
            </div>

            {stream.events.map((ev) => {
              const isOpen = open.has(ev.type)
              const json = JSON.stringify(ev.sample, null, 2)
              return (
                <div key={ev.type} className="border-t border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => toggle(ev.type)}
                    className="w-full flex items-center gap-3 py-3 text-left bg-transparent border-none cursor-pointer"
                  >
                    <CaretRight
                      size={14}
                      weight="bold"
                      className={`text-[var(--color-text-subtle)] transition-transform ${
                        isOpen ? 'rotate-90' : ''
                      }`}
                    />
                    <span className="flex-1 text-[14px] text-[var(--color-text)]">
                      {t(ev.nameKey)}
                    </span>
                    <ModeTag mode={ev.mode} />
                  </button>
                  {isOpen && (
                    <div className="relative mb-3">
                      <div className="absolute top-2.5 right-2.5 z-10">
                        <CopyButton
                          value={json}
                          label={t('events.copyPayload')}
                          copiedLabel={t('events.copied')}
                          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[6px] bg-[#1c2532] border border-[#2e3948] text-[11px] text-[#c9cfda] cursor-pointer md:hover:text-white transition-colors"
                        />
                      </div>
                      <pre
                        className="rounded-[12px] bg-[var(--color-text)] text-[#e6e9ef] px-4 py-4 m-0 overflow-x-auto text-[12px] leading-[1.65] font-[ui-monospace,SFMono-Regular,Menlo,monospace]"
                      >
                        {json}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </WebhookCard>
  )
}
