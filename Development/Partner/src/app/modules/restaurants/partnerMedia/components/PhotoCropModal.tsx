import { useState } from 'react'
import Cropper, { type Area, type Point } from 'react-easy-crop'
import { Alert, Modal, Slider } from 'antd'
import { MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { ROLE_ASPECT } from '../constants'
import { toPercentages, type PixelArea } from '../cropImage'
import type { PhotoCrop, PhotoItem, PhotoRole } from '../types'

export interface CropResult {
  /** The part kept, in the photo's own pixels, for cutting the image. */
  pixels: PixelArea
  /** The same part as percentages of the photo, for reopening the editor later. */
  percentages: PixelArea
}

interface Props {
  photo: PhotoItem | null
  role: PhotoRole
  /** The crop saved last time, when reopening on the same photo. */
  initialCrop?: PhotoCrop | null
  saving: boolean
  error?: string
  onSave: (result: CropResult) => void
  onCancel: () => void
}

/**
 * Chooses the part of a photo to keep: a wide 8:3 frame for the cover, like a
 * Facebook cover, or a circle for the profile picture, like Instagram. Drag to
 * move, scroll or use the slider to zoom; arrow keys move the photo too.
 */
export function PhotoCropModal({ photo, role, initialCrop, saving, error, onSave, onCancel }: Readonly<Props>) {
  const { t } = useTranslation('restaurants')
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<CropResult | null>(null)
  const isCover = role === 'cover'

  return (
    <Modal
      open={Boolean(photo)}
      title={t(isCover ? 'partnerMedia.crop.coverTitle' : 'partnerMedia.crop.profileTitle')}
      okText={t('partnerMedia.crop.save')}
      cancelText={t('partnerMedia.crop.cancel')}
      okButtonProps={{ disabled: !area }}
      confirmLoading={saving}
      onOk={() => area && onSave(area)}
      onCancel={onCancel}
      width={isCover ? 760 : 520}
      destroyOnHidden
    >
      <p className="mt-0 mb-3 text-[13px] text-[var(--color-text-secondary)]">
        {t(isCover ? 'partnerMedia.crop.coverHint' : 'partnerMedia.crop.profileHint')}
      </p>
      {photo && (
        <div
          className={`relative w-full overflow-hidden rounded-[12px] bg-[#111] ${isCover ? 'h-[300px] sm:h-[360px]' : 'h-[340px]'}`}
          data-testid="crop-area"
        >
          <Cropper
            image={photo.url}
            crop={crop}
            zoom={zoom}
            minZoom={1}
            maxZoom={4}
            aspect={ROLE_ASPECT[role]}
            cropShape={isCover ? 'rect' : 'round'}
            showGrid={isCover}
            objectFit="contain"
            initialCroppedAreaPercentages={initialCrop ? toPercentages(initialCrop) : undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(percentages: Area, pixels: Area) => setArea({ percentages, pixels })}
            mediaProps={{ crossOrigin: 'anonymous', alt: photo.name }}
            cropperProps={{ 'aria-label': t('partnerMedia.crop.frameLabel') }}
          />
        </div>
      )}
      <div className="mt-4 flex items-center gap-3">
        <MagnifyingGlassMinus size={18} aria-hidden="true" className="text-[var(--color-text-muted)]" />
        <Slider
          className="flex-1"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={setZoom}
          tooltip={{ formatter: (v) => `${Math.round((v ?? 1) * 100)}%` }}
          ariaLabelForHandle={t('partnerMedia.crop.zoom')}
        />
        <MagnifyingGlassPlus size={18} aria-hidden="true" className="text-[var(--color-text-muted)]" />
      </div>
      <p className="mt-1 mb-0 text-[12px] text-[var(--color-text-muted)]">{t('partnerMedia.crop.howTo')}</p>
      {error && <Alert className="mt-3" type="error" showIcon title={error} />}
    </Modal>
  )
}
