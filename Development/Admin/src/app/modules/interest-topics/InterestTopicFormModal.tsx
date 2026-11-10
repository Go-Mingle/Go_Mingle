import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Form, Input, Button, Select, Upload, message, Spin } from 'antd'
import type { FormInstance } from 'antd'
import type { RcFile } from 'antd/es/upload'
import { Check, UploadSimple } from '@phosphor-icons/react'
import { DESCRIPTION_MAX_LENGTH } from './constants'
import type { InterestTopic, InterestTopicFormValues, CreateTopicRequest } from './types'
import { AppButton } from '../../atoms/AppButton'
import { useUploadFileMutation } from '../uploads/hooks/useUploadsQuery'
import { useTopicDetail } from './hooks/useTopics'
import { getApiErrorMessage } from '../../../shared/utils/apiError'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg']
const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // 2MB
const MIN_IMAGE_DIMENSION = 300 // px — logo must be at least 300×300

interface InterestOption {
  value: string
  label: string
}

interface InterestTopicFormModalProps {
  open: boolean
  editing: InterestTopic | null
  form: FormInstance
  interestOptions: InterestOption[]
  onClose: () => void
  onFinish: (v: CreateTopicRequest) => void
  submitting?: boolean
}

export function InterestTopicFormModal({
  open,
  editing,
  form,
  interestOptions,
  onClose,
  onFinish,
  submitting = false,
}: InterestTopicFormModalProps) {
  const { t } = useTranslation('interest-topics')
  // `graphicUrl` form field holds only the preview (base64 for a fresh upload,
  // or the existing server URL on edit) — it drives the <img> and the "logo
  // present" required rule. The value actually submitted is `graphicKey` below.
  const graphicUrlValue = Form.useWatch('graphicUrl', form) as string | undefined
  const uploadMutation = useUploadFileMutation()
  // Storage key from the signed-url endpoint; submitted as `graphicKey`.
  // Stays undefined on edit until the image is actually replaced. This state
  // must not outlive a single modal session — the parent remounts this
  // component on every open (see the `key` on InterestTopicFormModal) so a key
  // from a just-created topic can't leak into the next edit (MET-1285).
  const [graphicKey, setGraphicKey] = useState<string | undefined>(undefined)

  // On edit, fetch the authoritative topic by id and populate the form from it.
  // Disabled (no fetch) for the create flow where `editing` is null. `isLoading`
  // (not `isPending`) is used below so the disabled create query shows no spinner.
  const {
    data: detail,
    isLoading: isDetailLoading,
    isError: isDetailError,
    error: detailError,
  } = useTopicDetail(editing?.id ?? null)

  useEffect(() => {
    if (!detail) return
    form.setFieldsValue({
      name: detail.name,
      description: detail.description ?? undefined,
      graphicUrl: detail.graphicUrl ?? undefined,
      interestIds: detail.interests.map((i) => i.id),
    })
  }, [detail, form])

  useEffect(() => {
    if (!isDetailError) return
    void message.error(getApiErrorMessage(detailError, t('errors.notFound')))
    onClose()
  }, [isDetailError, detailError, onClose, t])

  const handleFinish = (values: InterestTopicFormValues) => {
    const payload: CreateTopicRequest = {
      name: values.name.trim(),
      // Description is now required (validated below), so it's always present.
      description: (values.description ?? '').trim(),
      interestIds: values.interestIds ?? [],
    }
    // Only send graphicKey when a new image was uploaded — on create that's
    // always (logo required); on edit, omitting it leaves the graphic unchanged.
    if (graphicKey) payload.graphicKey = graphicKey
    onFinish(payload)
  }

  const beforeUpload = (file: RcFile) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      void message.error(t('form.imageTypeError'))
      return Upload.LIST_IGNORE
    }
    if (file.size > MAX_IMAGE_BYTES) {
      void message.error(t('form.imageSizeError'))
      return Upload.LIST_IGNORE
    }
    // Validate dimensions client-side before requesting a signed URL.
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
      img.onload = () => {
        if (img.naturalWidth < MIN_IMAGE_DIMENSION || img.naturalHeight < MIN_IMAGE_DIMENSION) {
          void message.error(t('form.imageDimensionError'))
          return
        }
        // Request a signed URL and PUT the bytes to S3, then keep the returned
        // key; the base64 data URL is used only for the preview. The key is set
        // only after S3 accepts the upload, so a rejected upload cannot persist a
        // key whose object is missing (MET-963).
        uploadMutation.mutate(
          { file, purpose: 'TOPIC_GRAPHIC' },
          {
            onSuccess: ({ key }) => {
              setGraphicKey(key)
              form.setFieldValue('graphicUrl', dataUrl)
              void form.validateFields(['graphicUrl'])
            },
            onError: (err) =>
              void message.error(getApiErrorMessage(err, t('form.imageUploadError'))),
          },
        )
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
    return Upload.LIST_IGNORE
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={editing ? t('form.editTitle') : t('form.newTitle')}
      width={480}
      closable
      destroyOnClose
      className="topic-form-modal"
    >
      {editing && isDetailLoading ? (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          className="app-form"
          onFinish={handleFinish}
          requiredMark={false}
        >
          <Form.Item
            name="name"
            label={t('form.topicName')}
            rules={[{ required: true, whitespace: true, message: t('form.topicNameRequired') }]}
          >
            <Input
              placeholder={t('form.topicNamePlaceholder')}
              style={{ height: 40, borderRadius: 8 }}
            />
          </Form.Item>
          {/* Label + upload live in a name-less item (Upload isn't a form control);
            the required rule + validation message live in the sibling item below
            so the error renders as a normal full-width, horizontal line. */}
          <Form.Item label={t('form.image')} required style={{ marginBottom: 4 }}>
            <Upload.Dragger
              accept=".png,.jpg,.jpeg"
              showUploadList={false}
              beforeUpload={beforeUpload}
              disabled={uploadMutation.isPending}
              className="topic-image-dragger"
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 0',
                }}
              >
                {uploadMutation.isPending ? (
                  <Spin size="small" />
                ) : graphicUrlValue ? (
                  <img
                    src={graphicUrlValue}
                    alt=""
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      objectFit: 'cover',
                      border: '1px solid var(--color-border)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'var(--color-accent-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <UploadSimple size={20} weight="regular" color="var(--color-accent)" />
                  </div>
                )}
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {uploadMutation.isPending
                    ? t('form.imageUploading')
                    : graphicUrlValue
                      ? t('form.imageReplace')
                      : t('form.imageUploadTitle')}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    fontFamily: 'Poppins, sans-serif',
                    lineHeight: 1.5,
                    textAlign: 'center',
                  }}
                >
                  {t('form.imageHint')}
                </div>
              </div>
            </Upload.Dragger>
          </Form.Item>
          {/* Value + required rule (and any server field error) — full-width explain. */}
          <Form.Item
            name="graphicUrl"
            rules={[{ required: true, message: t('form.imageRequired') }]}
          >
            <Input type="hidden" />
          </Form.Item>

          <Form.Item
            name="interestIds"
            label={t('form.interests')}
            rules={[{ required: true, message: t('form.interestsRequired') }]}
          >
            <Select
              mode="multiple"
              allowClear
              options={interestOptions}
              placeholder={t('form.interestsPlaceholder')}
              optionFilterProp="label"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('form.description')}
            rules={[
              { required: true, whitespace: true, message: t('form.descriptionRequired') },
              { max: DESCRIPTION_MAX_LENGTH, message: t('form.descriptionMaxLength') },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={DESCRIPTION_MAX_LENGTH}
              showCount
              placeholder={t('form.descriptionPlaceholder')}
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          {/* Footer rendered inside Form so type="submit" triggers validation + onFinish */}
          <div className="app-modal-footer">
            <Button
              onClick={onClose}
              style={{
                height: 36,
                borderRadius: 12,
                fontFamily: 'Poppins, sans-serif',
                fontSize: 13,
              }}
            >
              {t('form.cancel')}
            </Button>
            <AppButton type="submit" loading={submitting} style={{ padding: '0 20px' }}>
              <Check size={14} weight="bold" />
              {editing ? t('form.saveChanges') : t('form.createTopic')}
            </AppButton>
          </div>
        </Form>
      )}
    </Modal>
  )
}
