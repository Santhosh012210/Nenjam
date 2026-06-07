import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { X, Loader2 } from 'lucide-react'
import { getCroppedImage } from '../../lib/imageProcessing'

interface CropArea { x: number; y: number; width: number; height: number }

interface Props {
  imageSrc: string
  fileName: string
  onDone: (cropped: File) => void
  onCancel: () => void
}

const ASPECTS = [
  { label: 'Free', value: undefined },
  { label: '1:1',  value: 1 },
  { label: '4:5',  value: 4 / 5 },
  { label: '9:16', value: 9 / 16 },
  { label: '16:9', value: 16 / 9 },
] as const

export default function ImageCropModal({ imageSrc, fileName, onDone, onCancel }: Props) {
  const [crop,             setCrop]             = useState({ x: 0, y: 0 })
  const [zoom,             setZoom]             = useState(1)
  const [aspect,           setAspect]           = useState<number | undefined>(undefined)
  const [croppedPixels,    setCroppedPixels]    = useState<CropArea | null>(null)
  const [saving,           setSaving]           = useState(false)

  const onCropComplete = useCallback((_: unknown, pixels: CropArea) => {
    setCroppedPixels(pixels)
  }, [])

  const handleDone = async () => {
    if (!croppedPixels) return
    setSaving(true)
    try {
      const cropped = await getCroppedImage(imageSrc, croppedPixels, fileName)
      onDone(cropped)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: '#000', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
        paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
        paddingBottom: 14,
        flexShrink: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(10px)',
      }}>
        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: 8, borderRadius: 8 }}
        >
          <X size={22} />
        </button>
        <span style={{ color: 'white', fontSize: 15, fontWeight: 600 }}>Crop photo</span>
        <button
          onClick={handleDone}
          disabled={saving}
          style={{
            background: '#D4537E', border: 'none', color: 'white',
            cursor: saving ? 'not-allowed' : 'pointer',
            padding: '9px 20px', borderRadius: 22,
            fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
          Done
        </button>
      </div>

      {/* Crop area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          style={{ containerStyle: { background: '#111' } }}
          zoomWithScroll={true}
          showGrid={true}
        />
      </div>

      {/* Aspect ratio + zoom */}
      <div style={{
        flexShrink: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(10px)',
        padding: '14px 20px',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* Aspect buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {ASPECTS.map(opt => {
            const active = aspect === opt.value
            return (
              <button
                key={opt.label}
                onClick={() => setAspect(opt.value)}
                style={{
                  padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  border: `1px solid ${active ? '#D4537E' : 'rgba(255,255,255,0.18)'}`,
                  background: active ? 'rgba(212,83,126,0.22)' : 'transparent',
                  color: active ? '#F4C0D1' : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Zoom slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', minWidth: 28 }}>Zoom</span>
          <input
            type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#D4537E', height: 2 }}
          />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', minWidth: 28, textAlign: 'right' }}>
            {zoom.toFixed(1)}×
          </span>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
