import { useState, useEffect } from 'react'
import { Modal, Form, Input, Upload, Avatar, message } from 'antd'
import type { FormInstance } from 'antd'
import { Check, UploadSimple as UploadIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { labelStyle, coralBtn } from './profileModalHelpers'
import { SecondaryActionButton } from '../../atoms/ModalActions'
import { isUnsafeSvgContent } from '../../../shared/utils/svgSafety'
import { emailValidatorRule } from '../../../shared/utils/email'

interface EditProfileModalProps {
  open: boolean
  onClose: () => void
  onSave: (form: FormInstance) => Promise<void>
  initials: string
  userName: string | undefined
  userEmail: string | undefined
}

export function EditProfileModal({
  open,
  onClose,
  onSave,
  initials,
  userName,
  userEmail,
}: EditProfileModalProps) {
  const { t } = useTranslation(['profile', 'common'])
  const [editForm] = Form.useForm()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  // Unsafe-SVG validation is deferred until Save is pressed — beforeUpload
  // only stages the file so the error (and file removal) happen on the CTA
  // click, not the instant the file is picked.
  const [pendingAvatarUnsafe, setPendingAvatarUnsafe] = useState(false)
  // True while FileReader is reading a just-selected SVG. Save is disabled
  // during this window so a fast click can't bypass validation.
  const [avatarProcessing, setAvatarProcessing] = useState(false)

  useEffect(() => {
    if (open) editForm.setFieldsValue({ name: userName, email: userEmail })
  }, [open, userName, userEmail, editForm])

  const handleCancel = () => {
    setPendingAvatarUnsafe(false)
    setAvatarProcessing(false)
    onClose()
  }

  const handleSave = () => {
    if (pendingAvatarUnsafe) {
      void message.error(t('unsafeFile'))
      setPreviewUrl(null)
      setPendingAvatarUnsafe(false)
      return
    }
    void onSave(editForm)
  }

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={t('editProfile')}
      width={480}
      destroyOnClose
      footer={null}
    >
      <Form form={editForm} layout="vertical" requiredMark={false} className="app-form mt-2">
        <div className="flex flex-col items-center mb-5">
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={(file) => {
              const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
              if (!isSvg) {
                setPendingAvatarUnsafe(false)
                setPreviewUrl(URL.createObjectURL(file))
                return false
              }
              setPendingAvatarUnsafe(false)
              setAvatarProcessing(true)
              const reader = new FileReader()
              reader.onload = (e) => {
                const text = (e.target?.result as string) ?? ''
                if (isUnsafeSvgContent(text)) {
                  // Defer the error to Save — stage the "unsafe" flag but
                  // don't show the message or clear anything until the CTA.
                  setPendingAvatarUnsafe(true)
                  setAvatarProcessing(false)
                  return
                }
                setPreviewUrl(URL.createObjectURL(file))
                setAvatarProcessing(false)
              }
              reader.readAsText(file)
              return false
            }}
          >
            <div className="cursor-pointer relative w-20 h-20">
              <Avatar
                size={80}
                src={previewUrl ?? undefined}
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: '#fff',
                  fontSize: 26,
                  fontWeight: 700,
                }}
              >
                {!previewUrl && initials}
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-[rgba(0,0,0,0.35)] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-150">
                <UploadIcon size={18} color="white" />
              </div>
            </div>
          </Upload>
        </div>
        <Form.Item
          label={<span style={labelStyle}>{t('fullName')}</span>}
          name="name"
          rules={[{ required: true, message: t('common:validation.nameRequired') }]}
        >
          <Input size="large" />
        </Form.Item>
        <Form.Item
          label={<span style={labelStyle}>{t('email')}</span>}
          name="email"
          rules={[
            { required: true, message: t('common:validation.emailRequired') },
            emailValidatorRule(t('common:validation.emailRequired')),
          ]}
        >
          <Input size="large" type="email" />
        </Form.Item>

        <div className="app-modal-footer">
          <SecondaryActionButton onClick={handleCancel}>
            {t('common:buttons.cancel')}
          </SecondaryActionButton>
          <button style={coralBtn} disabled={avatarProcessing} onClick={handleSave}>
            <Check size={14} />
            {t('common:buttons.saveChanges')}
          </button>
        </div>
      </Form>
    </Modal>
  )
}
