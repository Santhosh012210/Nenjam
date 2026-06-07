import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useEncryptionStore } from '../../stores/encryptionStore'
import { compressPhoto, fileToUint8Array } from '../../lib/imageProcessing'
import { encryptBinary } from '../../lib/encryption'
import { uploadEncryptedPhoto, generatePhotoKey } from '../../lib/r2'
import ImageCropModal from './ImageCropModal'

interface PhotoPreview { file: File; previewUrl: string }

interface Props {
  onClose: () => void
  onAdded: () => void
}

export default function AddHiddenMemorySheet({ onClose, onAdded }: Props) {
  const { user } = useAuthStore()
  const { sharedKey, privateJournalKey } = useEncryptionStore()

  const [title, setTitle] = useState('')
  const [approxDate, setApproxDate] = useState('')
  const [locationName, setLocationName] = useState('')
  const [scenario, setScenario] = useState('')
  const [photos, setPhotos] = useState<PhotoPreview[]>([])
  const [saving, setSaving] = useState(false)
  const [cropState, setCropState] = useState<{ file: File; url: string; queue: File[] } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const startCrop = useCallback((files: File[]) => {
    if (files.length === 0) return
    const [first, ...rest] = files
    setCropState({ file: first, url: URL.createObjectURL(first), queue: rest })
  }, [])

  const handleCropDone = useCallback((croppedFile: File) => {
    if (!cropState) return
    const { url, queue } = cropState
    URL.revokeObjectURL(url)
    setPhotos(prev => [...prev, { file: croppedFile, previewUrl: URL.createObjectURL(croppedFile) }])
    if (queue.length > 0 && photos.length + 1 < 6) startCrop(queue)
    else setCropState(null)
  }, [cropState, photos.length, startCrop])

  const handleCropCancel = useCallback(() => {
    if (!cropState) return
    URL.revokeObjectURL(cropState.url)
    if (cropState.queue.length > 0 && photos.length < 6) startCrop(cropState.queue)
    else setCropState(null)
  }, [cropState, photos.length, startCrop])

  const handleFiles = useCallback((files: FileList) => {
    const remaining = 6 - photos.length
    const toAdd = Array.from(files).slice(0, remaining)
    if (toAdd.length > 0) startCrop(toAdd)
  }, [photos.length, startCrop])

  const removePhoto = (i: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[i].previewUrl)
      return prev.filter((_, idx) => idx !== i)
    })
  }

  const handleSave = async () => {
    if (!title.trim() || !user) return
    const encKey = sharedKey ?? privateJournalKey
    if (!encKey) { toast.error('Encryption not ready'); return }

    setSaving(true)
    try {
      const photoKeys: string[] = []
      for (const p of photos) {
        const compressed = await compressPhoto(p.file)
        const bytes = await fileToUint8Array(compressed)
        const { encrypted, nonce } = encryptBinary(bytes, encKey)
        const key = generatePhotoKey(user.id)
        await uploadEncryptedPhoto(key, encrypted, nonce)
        photoKeys.push(key)
        URL.revokeObjectURL(p.previewUrl)
      }

      const { error } = await supabase.from('hidden_timeline_entries').insert({
        created_by: user.id,
        title: title.trim(),
        approximate_date: approxDate.trim() || 'Unknown time',
        location_name: locationName.trim() || null,
        scenario: scenario.trim() || null,
        photo_urls: photoKeys.length > 0 ? photoKeys : null,
      })

      if (error) throw new Error(error.message)
      onAdded()
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
      setSaving(false)
    }
  }

  return (
    <>
    {cropState && (
      <ImageCropModal
        imageSrc={cropState.url}
        fileName={cropState.file.name}
        onDone={handleCropDone}
        onCancel={handleCropCancel}
      />
    )}
    <motion.div
      className="fixed inset-0 z-[9999] flex items-end justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <motion.div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 500,
          background: '#10101a',
          borderRadius: '24px 24px 0 0',
          maxHeight: '92vh',
          overflowY: 'auto',
          fontFamily: "'Noto Sans Tamil', sans-serif",
        }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
      >
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'rgba(235,235,245,0.9)', margin: 0 }}>
              Add a hidden memory
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 4 }}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ padding: '0 20px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <HiddenField label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Orchard Road, 2020"
              style={inputStyle}
            />
          </HiddenField>

          <HiddenField label="Approximate date">
            <input
              value={approxDate}
              onChange={(e) => setApproxDate(e.target.value)}
              placeholder="e.g. Sometime in 2019"
              style={inputStyle}
            />
          </HiddenField>

          <HiddenField label="Location name">
            <input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Jewel Changi Airport"
              style={inputStyle}
            />
          </HiddenField>

          <HiddenField label="What might have happened...">
            <textarea
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder={"You were probably here that weekend too.\nMaybe you walked past. Maybe you looked up."}
              rows={4}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
            />
          </HiddenField>

          <HiddenField label={`Photos (${photos.length}/6)`}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: 'relative', width: 72, height: 72 }}>
                  <img
                    src={p.previewUrl}
                    alt=""
                    style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, filter: 'saturate(0.8)' }}
                  />
                  <button
                    onClick={() => removePhoto(i)}
                    style={{
                      position: 'absolute', top: -6, right: -6,
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'rgba(180,180,210,0.6)', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}
                  >
                    <X size={11} color="white" />
                  </button>
                </div>
              ))}
              {photos.length < 6 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: 72, height: 72, borderRadius: 10,
                    border: '1.5px dashed rgba(180,180,210,0.2)',
                    background: 'rgba(180,180,210,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'rgba(180,180,210,0.3)',
                  }}
                >
                  <Plus size={20} />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </HiddenField>

          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            style={{
              width: '100%', padding: '14px', borderRadius: 16,
              background: saving || !title.trim()
                ? 'rgba(180,180,210,0.1)'
                : 'rgba(180,180,210,0.2)',
              border: '1px solid rgba(180,180,210,0.35)',
              color: saving || !title.trim() ? 'rgba(210,210,235,0.3)' : 'rgba(210,210,235,0.85)',
              fontSize: 15, fontWeight: 600,
              cursor: saving || !title.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: "'Noto Sans Tamil', sans-serif",
              transition: 'all 0.2s ease',
            }}
          >
            {saving ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save hidden memory'}
          </button>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </motion.div>
    </motion.div>
    </>
  )
}

function HiddenField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(180,180,210,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid rgba(180,180,210,0.12)',
  background: 'rgba(180,180,210,0.05)',
  color: 'rgba(235,235,245,0.85)',
  fontSize: 14,
  fontFamily: "'Noto Sans Tamil', sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
}
