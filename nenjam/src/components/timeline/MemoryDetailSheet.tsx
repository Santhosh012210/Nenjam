import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import useEmblaCarousel from 'embla-carousel-react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import { X, MapPin, Calendar, Edit2, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { deletePhoto } from '../../lib/r2'
import { useAuthStore } from '../../stores/authStore'
import { useEncryptionStore } from '../../stores/encryptionStore'
import { useTimelineStore } from '../../stores/timelineStore'
import type { TimelineEntry } from '../../types'
import { format, parseISO } from 'date-fns'

const BADGE: Record<TimelineEntry['type'], { bg: string; border: string; text: string; label: string }> = {
  milestone: { bg: 'rgba(212,83,126,0.28)', border: 'rgba(212,83,126,0.5)', text: '#F4C0D1', label: 'milestone' },
  special:   { bg: 'rgba(127,119,221,0.28)', border: 'rgba(127,119,221,0.5)', text: '#CECBF6', label: 'special' },
  trip:      { bg: 'rgba(29,158,117,0.28)', border: 'rgba(29,158,117,0.5)', text: '#9FE1CB', label: 'trip' },
  everyday:  { bg: 'rgba(239,159,39,0.28)', border: 'rgba(239,159,39,0.5)', text: '#FAC775', label: 'everyday' },
}

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#D4537E;border:2px solid white;box-shadow:0 2px 8px rgba(212,83,126,0.5);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

interface Props {
  entry: TimelineEntry
  onClose: () => void
  onDeleted: () => void
  onEdited: (updated: TimelineEntry) => void
}

export default function MemoryDetailSheet({ entry, onClose, onDeleted, onEdited }: Props) {
  const { user } = useAuthStore()
  const { sharedKey, privateJournalKey } = useEncryptionStore()
  const { getOrDecrypt } = useTimelineStore()

  const [photoUrls, setPhotoUrls] = useState<(string | null)[]>(
    (entry.photo_urls ?? []).map(() => null)
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editNote, setEditNote] = useState(entry.note ?? '')
  const [editTitle, setEditTitle] = useState(entry.title)
  const [saving, setSaving] = useState(false)

  const [emblaRef] = useEmblaCarousel({ loop: false })

  const isOwner = user?.id === entry.created_by
  const photoKeys = entry.photo_urls ?? []

  const decryptPhotos = useCallback(async () => {
    const encKey = sharedKey ?? privateJournalKey
    if (!encKey || photoKeys.length === 0) return
    const results = await Promise.all(
      photoKeys.map((key) => getOrDecrypt(key, encKey))
    )
    setPhotoUrls(results)
  }, [photoKeys, sharedKey, privateJournalKey, getOrDecrypt])

  useEffect(() => { decryptPhotos() }, [decryptPhotos])

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      // Delete R2 objects
      await Promise.allSettled((entry.photo_urls ?? []).map((key) => deletePhoto(key)))
      // Delete DB row
      const { error } = await supabase.from('timeline_entries').delete().eq('id', entry.id)
      if (error) throw new Error(error.message)
      toast.success('Memory deleted')
      onDeleted()
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('timeline_entries')
      .update({ title: editTitle.trim(), note: editNote.trim() || null })
      .eq('id', entry.id)
    setSaving(false)
    if (error) { toast.error('Save failed'); return }
    onEdited({ ...entry, title: editTitle.trim(), note: editNote.trim() || null })
    setEditing(false)
    toast.success('Saved')
  }

  const badge = BADGE[entry.type]
  const hasMap = entry.lat !== null && entry.lng !== null

  return (
    <motion.div
      className="fixed inset-0 z-[500] flex items-end justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <motion.div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 500,
          background: '#0f0f14',
          borderRadius: '24px 24px 0 0',
          maxHeight: '92vh',
          overflowY: 'auto',
          fontFamily: "'Noto Sans Tamil', sans-serif",
        }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16, zIndex: 10,
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          <X size={16} />
        </button>

        {/* Photo carousel */}
        {photoKeys.length > 0 && (
          <div ref={emblaRef} style={{ overflow: 'hidden', height: 280 }}>
            <div style={{ display: 'flex', height: '100%' }}>
              {photoKeys.map((_, i) => (
                <div key={i} style={{ flex: '0 0 100%', minWidth: 0, height: '100%', position: 'relative' }}>
                  {photoUrls[i] ? (
                    <img
                      src={photoUrls[i]!}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', background: '#1a1a24',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Loader2 size={24} color="rgba(255,255,255,0.3)" style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '20px 22px 40px' }}>
          {/* Badge */}
          <span style={{
            display: 'inline-block',
            background: badge.bg, border: `1px solid ${badge.border}`,
            color: badge.text, borderRadius: 20,
            padding: '4px 12px', fontSize: 11, fontWeight: 500,
            textTransform: 'uppercase', letterSpacing: '0.04em',
            marginBottom: 10,
          }}>
            {badge.label}
          </span>

          {/* Title */}
          {editing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              style={{
                width: '100%', fontSize: 20, fontWeight: 500, color: 'white',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10, padding: '8px 12px', fontFamily: "'Noto Sans Tamil', sans-serif",
                marginBottom: 12, boxSizing: 'border-box', outline: 'none',
              }}
            />
          ) : (
            <h2 style={{ fontSize: 22, fontWeight: 500, color: 'white', margin: '0 0 8px', lineHeight: 1.2 }}>
              {entry.title}
            </h2>
          )}

          {/* Date + Location */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={12} color="rgba(255,255,255,0.4)" />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                {format(parseISO(entry.date), 'MMMM d, yyyy')}
              </span>
            </div>
            {entry.location_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={12} color="rgba(255,255,255,0.4)" />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                  {entry.location_name}
                </span>
              </div>
            )}
          </div>

          {/* Note */}
          {editing ? (
            <textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              rows={4}
              placeholder="Write a note..."
              style={{
                width: '100%', fontSize: 14, color: 'rgba(255,255,255,0.8)',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10, padding: '10px 12px', fontFamily: "'Noto Sans Tamil', sans-serif",
                lineHeight: 1.55, resize: 'none', outline: 'none', boxSizing: 'border-box',
              }}
            />
          ) : (
            entry.note && (
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: '0 0 20px' }}>
                {entry.note}
              </p>
            )
          )}

          {/* Mini map */}
          {hasMap && !editing && (
            <div style={{ height: 150, borderRadius: 14, overflow: 'hidden', marginTop: 12, marginBottom: 16 }}>
              <MapContainer
                center={[entry.lat!, entry.lng!]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                dragging={false}
                scrollWheelZoom={false}
                attributionControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  subdomains="abcd"
                />
                <Marker position={[entry.lat!, entry.lng!]} icon={pinIcon} />
              </MapContainer>
            </div>
          )}

          {/* Owner actions */}
          {isOwner && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    style={ghostBtnStyle}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    style={{ ...actionBtnStyle, background: '#D4537E', flex: 1 }}
                  >
                    {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save changes'}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditing(true)} style={ghostBtnStyle}>
                    <Edit2 size={14} />
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{
                      ...ghostBtnStyle,
                      borderColor: confirmDelete ? 'rgba(239,68,68,0.6)' : undefined,
                      color: confirmDelete ? '#fca5a5' : undefined,
                    }}
                  >
                    {deleting
                      ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Trash2 size={14} />}
                    {confirmDelete ? 'Confirm?' : 'Delete'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

const ghostBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '10px 18px', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'transparent', color: 'rgba(255,255,255,0.55)',
  fontSize: 13, fontWeight: 500, cursor: 'pointer',
  fontFamily: "'Noto Sans Tamil', sans-serif",
}

const actionBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '10px 18px', borderRadius: 12,
  border: 'none', color: 'white',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  fontFamily: "'Noto Sans Tamil', sans-serif",
}
