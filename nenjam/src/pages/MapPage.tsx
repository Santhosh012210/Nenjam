import { useEffect, useRef, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, MapPin, Calendar, Search, Locate,
  CheckCircle, AlertCircle, Loader2, Trash2, Image, Map as MapIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useEncryptionStore } from '../stores/encryptionStore'
import { extractPhotoMeta } from '../lib/exif'
import { compressPhoto, fileToUint8Array, uint8ArrayToObjectUrl, revokeObjectUrl } from '../lib/imageProcessing'
import { encryptBinary, decryptBinary } from '../lib/encryption'
import { uploadEncryptedPhoto, downloadEncryptedPhoto, generatePhotoKey, deletePhoto as r2Delete } from '../lib/r2'
import { toast } from 'sonner'
import type { Photo } from '../types'
import { format } from 'date-fns'

const SG_CENTER: [number, number] = [1.3521, 103.8198]
const CLUSTER_THRESHOLD = 0.005

interface PhotoCluster { lat: number; lng: number; photos: Photo[] }
interface LocationResult { lat: number; lng: number; displayName: string }

function clusterPhotos(photos: Photo[]): PhotoCluster[] {
  const clusters: PhotoCluster[] = []
  for (const photo of photos) {
    if (photo.lat === null || photo.lng === null) continue
    const hit = clusters.find(
      (c) => Math.abs(c.lat - photo.lat!) < CLUSTER_THRESHOLD && Math.abs(c.lng - photo.lng!) < CLUSTER_THRESHOLD
    )
    if (hit) hit.photos.push(photo)
    else clusters.push({ lat: photo.lat!, lng: photo.lng!, photos: [photo] })
  }
  return clusters
}

function MapController({
  flyTo, clusters, active,
}: {
  flyTo: [number, number] | null
  clusters: PhotoCluster[]
  active: boolean
}) {
  const map = useMap()
  const fittedRef = useRef(false)

  useEffect(() => {
    if (active) setTimeout(() => map.invalidateSize(), 60)
  }, [active, map])

  useEffect(() => {
    if (flyTo) map.flyTo(flyTo, 16, { animate: true, duration: 1 })
  }, [flyTo, map])

  useEffect(() => {
    if (fittedRef.current || clusters.length === 0) return
    fittedRef.current = true
    if (clusters.length === 1) {
      map.setView([clusters[0].lat, clusters[0].lng], 15)
    } else {
      map.fitBounds(
        L.latLngBounds(clusters.map(c => [c.lat, c.lng] as [number, number])),
        { padding: [60, 60], maxZoom: 16 }
      )
    }
  }, [clusters, map])

  return null
}

function LocateControl() {
  const map = useMap()
  const [locating, setLocating] = useState(false)
  const locate = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { map.flyTo([pos.coords.latitude, pos.coords.longitude], 16); setLocating(false) },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }
  return (
    <div className="leaflet-bottom leaflet-right" style={{ marginBottom: '6rem', marginRight: '1rem' }}>
      <div className="leaflet-control">
        <button
          onClick={locate}
          className="bg-white dark:bg-gray-900 shadow-lg rounded-2xl w-11 h-11 flex items-center justify-center text-rose-600 border border-rose-100"
        >
          {locating ? <Loader2 size={18} className="animate-spin" /> : <Locate size={18} />}
        </button>
      </div>
    </div>
  )
}

function makePhotoPin(url: string | undefined, count: number): L.DivIcon {
  const badge = count > 1
    ? `<div style="position:absolute;top:-7px;right:-7px;background:#be185d;color:white;border:2px solid white;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">+${count - 1}</div>`
    : ''
  const inner = url
    ? `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#fce7f3;border-radius:8px;font-size:22px;">📸</div>`
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:54px;filter:drop-shadow(0 4px 8px rgba(190,24,93,.4));">
      <div style="width:54px;height:54px;background:white;border:3px solid #be185d;border-radius:10px;overflow:hidden;position:relative;">
        ${inner}${badge}
      </div>
      <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid #be185d;margin:0 auto;"></div>
    </div>`,
    iconSize: [54, 68],
    iconAnchor: [27, 68],
  })
}

async function searchPlace(query: string): Promise<LocationResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' }, credentials: 'omit' })
  const data = await res.json()
  return data.map((r: any) => ({
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    displayName: r.display_name,
  }))
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

interface PendingUpload {
  file: File
  previewUrl: string
  exifLat: number | null
  exifLng: number | null
  exifDate: Date | null
}

function UploadModal({
  pending,
  onClose,
  onConfirm,
}: {
  pending: PendingUpload
  onClose: () => void
  onConfirm: (lat: number | null, lng: number | null, caption: string, date: string) => Promise<void>
}) {
  const [locMode, setLocMode] = useState<'exif' | 'gps' | 'search' | 'manual'>(
    pending.exifLat !== null ? 'exif' : 'gps'
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<LocationResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [chosenLoc, setChosenLoc] = useState<LocationResult | null>(
    pending.exifLat !== null
      ? { lat: pending.exifLat, lng: pending.exifLng!, displayName: 'From photo GPS' }
      : null
  )
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [manualLat, setManualLat] = useState(pending.exifLat?.toFixed(6) ?? '')
  const [manualLng, setManualLng] = useState(pending.exifLng?.toFixed(6) ?? '')
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState(
    pending.exifDate ? format(pending.exifDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  )
  const [saving, setSaving] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true); setSearchResults([]); setSearched(false)
    try { setSearchResults(await searchPlace(searchQuery)) } catch { setSearchResults([]) }
    setSearching(false); setSearched(true)
  }

  const getGpsLocation = () => {
    if (!navigator.geolocation) { setGpsError('Geolocation not supported.'); return }
    setGpsLoading(true); setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGpsLat(pos.coords.latitude); setGpsLng(pos.coords.longitude); setGpsLoading(false) },
      (err) => { setGpsError(err.code === 1 ? 'Location permission denied.' : 'Could not get location.'); setGpsLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const finalLat = (): number | null => {
    if (locMode === 'exif') return pending.exifLat
    if (locMode === 'gps') return gpsLat
    if (locMode === 'search') return chosenLoc?.lat ?? null
    const v = parseFloat(manualLat); return isNaN(v) ? null : v
  }
  const finalLng = (): number | null => {
    if (locMode === 'exif') return pending.exifLng
    if (locMode === 'gps') return gpsLng
    if (locMode === 'search') return chosenLoc?.lng ?? null
    const v = parseFloat(manualLng); return isNaN(v) ? null : v
  }

  const hasLocation = finalLat() !== null && finalLng() !== null

  const handleConfirm = async () => {
    setSaving(true)
    await onConfirm(finalLat(), finalLng(), caption.trim(), date)
    setSaving(false)
  }

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-end justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl overflow-hidden"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-bold text-gray-900 dark:text-white text-lg">Add to map</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto max-h-[80vh] px-5 py-4 space-y-5">
          <div className="w-full h-44 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800">
            <img src={pending.previewUrl} className="w-full h-full object-cover" alt="" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Date taken</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field text-sm" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Caption <span className="font-normal normal-case">(optional)</span>
            </label>
            <input className="input-field text-sm" placeholder="A little memory note..." value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Location</label>
            <div className="flex gap-1 mb-3 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              {[
                { id: 'exif', label: '📷 Photo', disabled: pending.exifLat === null },
                { id: 'gps',  label: '📡 GPS' },
                { id: 'search', label: '🔍 Search' },
                { id: 'manual', label: '✏️ Manual' },
              ].map(({ id, label, disabled }) => (
                <button
                  key={id}
                  disabled={disabled}
                  onClick={() => setLocMode(id as typeof locMode)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    locMode === id ? 'bg-white dark:bg-gray-700 text-rose-600 shadow-sm'
                    : disabled ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                  }`}
                >{label}</button>
              ))}
            </div>

            {locMode === 'exif' && pending.exifLat !== null && (
              <div className="flex items-center gap-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-3">
                <CheckCircle size={16} className="text-green-500 flex-none" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">GPS found in photo</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{pending.exifLat.toFixed(6)}, {pending.exifLng!.toFixed(6)}</p>
                </div>
              </div>
            )}

            {locMode === 'gps' && (
              <div className="space-y-2">
                {gpsLat !== null ? (
                  <div className="flex items-center gap-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-3">
                    <CheckCircle size={16} className="text-green-500 flex-none" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Location found</p>
                      <p className="text-xs text-gray-500 mt-0.5 font-mono">{gpsLat.toFixed(6)}, {gpsLng!.toFixed(6)}</p>
                    </div>
                    <button onClick={getGpsLocation} className="text-xs text-rose-500 font-medium">Refresh</button>
                  </div>
                ) : (
                  <button onClick={getGpsLocation} disabled={gpsLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-rose-200 dark:border-rose-800 text-rose-600 text-sm font-medium hover:bg-rose-50 transition-colors disabled:opacity-60"
                  >
                    {gpsLoading ? <><Loader2 size={16} className="animate-spin" /> Getting location…</> : <><Locate size={16} /> Use my current location</>}
                  </button>
                )}
                {gpsError && (
                  <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-2.5">
                    <AlertCircle size={14} className="flex-none mt-0.5" /><span>{gpsError}</span>
                  </div>
                )}
              </div>
            )}

            {locMode === 'search' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    className="input-field text-sm flex-1"
                    placeholder="Search any place…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <button onClick={handleSearch} disabled={searching || !searchQuery.trim()}
                    className="w-10 h-10 bg-rose-500 disabled:bg-gray-200 text-white disabled:text-gray-400 rounded-xl flex items-center justify-center flex-none"
                  >
                    {searching ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin block" /> : <Search size={16} />}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                    {searchResults.map((r, i) => (
                      <button key={i} onClick={() => { setChosenLoc(r); setSearchResults([]) }}
                        className="w-full text-left px-4 py-3 flex items-start gap-2.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 bg-white dark:bg-gray-900 transition-colors"
                      >
                        <MapPin size={14} className="text-rose-400 flex-none mt-0.5" />
                        <span className="text-xs text-gray-700 dark:text-gray-300 leading-snug line-clamp-2">{r.displayName}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!searching && searched && searchResults.length === 0 && !chosenLoc && (
                  <p className="text-xs text-gray-400 text-center py-2">No results — try a different name or use Manual.</p>
                )}
                {chosenLoc && searchResults.length === 0 && (
                  <div className="flex items-center gap-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-4 py-3">
                    <MapPin size={14} className="text-rose-500 flex-none" />
                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug">{chosenLoc.displayName.split(',').slice(0, 3).join(', ')}</p>
                  </div>
                )}
              </div>
            )}

            {locMode === 'manual' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 mb-1 block">Latitude</label>
                    <input className="input-field text-sm font-mono" placeholder="1.3521" value={manualLat} onChange={(e) => setManualLat(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 mb-1 block">Longitude</label>
                    <input className="input-field text-sm font-mono" placeholder="103.8198" value={manualLng} onChange={(e) => setManualLng(e.target.value)} />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400">Tip: open Google Maps, long-press a spot, copy the coordinates shown.</p>
              </div>
            )}

            {!hasLocation && (
              <div className="flex items-center gap-2 mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-2.5">
                <AlertCircle size={14} className="flex-none" />
                Photo will be saved but won't appear as a pin on the map.
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={handleConfirm} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving
              ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin block" />
              : <><MapPin size={16} />{hasLocation ? 'Add to map' : 'Save without location'}</>
            }
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Delete button (two-tap confirm) ─────────────────────────────────────────

function DeleteButton({
  photo,
  confirmId,
  deletingId,
  onConfirmChange,
  onDelete,
}: {
  photo: Photo
  confirmId: string | null
  deletingId: string | null
  onConfirmChange: (id: string | null) => void
  onDelete: (photo: Photo) => void
}) {
  const isConfirming = confirmId === photo.id
  const isDeleting = deletingId === photo.id

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isConfirming) {
      onDelete(photo)
    } else {
      onConfirmChange(photo.id)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isDeleting}
      className={`flex items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition-all ${
        isConfirming
          ? 'bg-red-500 text-white'
          : 'bg-black/30 text-white hover:bg-red-500/80 backdrop-blur-sm'
      }`}
    >
      {isDeleting
        ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin block" />
        : <Trash2 size={11} />}
      {isConfirming ? 'Sure?' : ''}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MapPage() {
  const { user, partner, loadProfiles } = useAuthStore()
  const { sharedKey, privateJournalKey, refreshSharedKey } = useEncryptionStore()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [clusters, setClusters] = useState<PhotoCluster[]>([])
  const [selected, setSelected] = useState<PhotoCluster | null>(null)
  const [pending, setPending] = useState<PendingUpload | null>(null)
  const [decryptedUrls, setDecryptedUrls] = useState<Record<string, string>>({})
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null)
  const [view, setView] = useState<'map' | 'gallery'>('map')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const urlsRef = useRef<Record<string, string>>({})

  useEffect(() => {
    if (user) {
      loadProfiles(user.id)
      refreshSharedKey(user.id)
    }
  }, [user])

  const loadPhotos = useCallback(async () => {
    if (!user) return
    const ids = [user.id, ...(partner ? [partner.id] : [])]
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .in('uploader_id', ids)
      .order('created_at', { ascending: false })
    if (error) {
      toast.error(`Could not load photos: ${error.message}`)
      return
    }
    setPhotos(data ?? [])
  }, [user, partner])

  // Derive clusters whenever photos change
  useEffect(() => {
    setClusters(clusterPhotos(photos))
  }, [photos])

  useEffect(() => {
    loadPhotos()
    return () => { Object.values(urlsRef.current).forEach(revokeObjectUrl) }
  }, [loadPhotos])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const meta = await extractPhotoMeta(file)
    setPending({ file, previewUrl: URL.createObjectURL(file), exifLat: meta.lat, exifLng: meta.lng, exifDate: meta.takenAt })
    e.target.value = ''
  }

  const handleConfirm = async (lat: number | null, lng: number | null, caption: string, date: string) => {
    if (!user) { toast.error('Not logged in'); return }
    const encKey = sharedKey ?? privateJournalKey
    if (!encKey) { toast.error('PIN not entered'); return }
    if (!pending) return
    try {
      const compressed = await compressPhoto(pending.file)
      const bytes = await fileToUint8Array(compressed)
      const { encrypted, nonce } = encryptBinary(bytes, encKey)
      const key = generatePhotoKey(user.id)
      await uploadEncryptedPhoto(key, encrypted, nonce)
      const { error: dbError } = await supabase.from('photos').insert({
        uploader_id: user.id,
        r2_key: key,
        lat,
        lng,
        taken_at: date ? new Date(date).toISOString() : null,
        caption: caption || null,
      })
      if (dbError) throw new Error(dbError.message)
      URL.revokeObjectURL(pending.previewUrl)
      setPending(null)
      if (lat !== null && lng !== null) { setFlyTo([lat, lng]); setView('map') }
      toast.success(lat ? 'Photo pinned to map!' : 'Photo saved')
      await loadPhotos()
    } catch (err) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const decryptPhoto = useCallback(async (photo: Photo) => {
    if (urlsRef.current[photo.id]) return
    const keysToTry = [sharedKey, privateJournalKey].filter((k): k is Uint8Array => k !== null)
    if (keysToTry.length === 0) return
    try {
      const { encrypted, nonce } = await downloadEncryptedPhoto(photo.r2_key)
      for (const key of keysToTry) {
        const decrypted = decryptBinary(encrypted, nonce, key)
        if (decrypted) {
          const url = uint8ArrayToObjectUrl(decrypted)
          urlsRef.current[photo.id] = url
          setDecryptedUrls((prev) => ({ ...prev, [photo.id]: url }))
          return
        }
      }
    } catch (err) {
      console.error('Decrypt failed for', photo.r2_key, err)
    }
  }, [sharedKey, privateJournalKey])

  useEffect(() => { photos.forEach(decryptPhoto) }, [photos, decryptPhoto])
  useEffect(() => { if (selected) selected.photos.forEach(decryptPhoto) }, [selected, decryptPhoto])

  const handleDelete = async (photo: Photo) => {
    if (photo.uploader_id !== user?.id) {
      toast.error("You can only delete your own photos")
      return
    }
    setDeletingId(photo.id)
    setConfirmDeleteId(null)
    try {
      await r2Delete(photo.r2_key)
      const { error } = await supabase.from('photos').delete().eq('id', photo.id)
      if (error) throw new Error(error.message)

      // Clean up local state
      const newPhotos = photos.filter(p => p.id !== photo.id)
      setPhotos(newPhotos)
      if (urlsRef.current[photo.id]) {
        revokeObjectUrl(urlsRef.current[photo.id])
        delete urlsRef.current[photo.id]
        setDecryptedUrls(prev => { const n = { ...prev }; delete n[photo.id]; return n })
      }
      // Update or close cluster sheet
      if (selected) {
        const remaining = selected.photos.filter(p => p.id !== photo.id)
        if (remaining.length === 0) setSelected(null)
        else setSelected({ ...selected, photos: remaining })
      }
      toast.success('Photo deleted')
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setDeletingId(null)
    }
  }

  // Sorted photos for gallery (newest first by taken_at, fallback created_at)
  const sortedPhotos = [...photos].sort((a, b) => {
    const aDate = a.taken_at ?? a.created_at
    const bDate = b.taken_at ?? b.created_at
    return new Date(bDate).getTime() - new Date(aDate).getTime()
  })

  const pinnedCount = photos.filter(p => p.lat !== null).length

  return (
    <div className="relative" style={{ height: '100vh' }}>
      {/* Map — always mounted so Leaflet keeps its state */}
      <div style={{ height: '100vh', width: '100%' }}>
        <MapContainer center={SG_CENTER} zoom={12} style={{ height: '100vh', width: '100%' }} zoomControl={false}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
            maxZoom={19}
            crossOrigin="anonymous"
          />
          {clusters.map((cluster) => {
            const thumbUrl = decryptedUrls[cluster.photos[0].id]
            return (
              <Marker
                key={`${cluster.lat}-${cluster.lng}-${thumbUrl ?? 'loading'}`}
                position={[cluster.lat, cluster.lng]}
                icon={makePhotoPin(thumbUrl, cluster.photos.length)}
                eventHandlers={{ click: () => { setSelected(cluster); setView('map') } }}
              />
            )
          })}
          <MapController flyTo={flyTo} clusters={clusters} active={view === 'map'} />
          <LocateControl />
        </MapContainer>
      </div>

      {/* Gallery overlay — sits on top of the map */}
      <AnimatePresence>
        {view === 'gallery' && (
          <motion.div
            key="gallery"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 z-[800] bg-white dark:bg-gray-950 overflow-y-auto"
            onClick={() => setConfirmDeleteId(null)}
          >
            <div className="pt-20 pb-28">
              {sortedPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center px-8">
                  <div className="text-5xl mb-4">📸</div>
                  <p className="font-semibold text-gray-700 dark:text-gray-300">No memories yet</p>
                  <p className="text-sm text-gray-400 mt-1">Tap "Add photo" to save your first memory</p>
                </div>
              ) : (
                <>
                  <div className="px-4 mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {photos.length} photo{photos.length !== 1 ? 's' : ''} · {pinnedCount} on map
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-0.5">
                    {sortedPhotos.map((photo) => (
                      <div key={photo.id} className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                        {decryptedUrls[photo.id] ? (
                          <img
                            src={decryptedUrls[photo.id]}
                            className="w-full h-full object-cover"
                            alt={photo.caption ?? ''}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="w-5 h-5 border-2 border-rose-300 border-t-rose-500 rounded-full animate-spin block" />
                          </div>
                        )}

                        {/* No-location badge */}
                        {photo.lat === null && (
                          <div className="absolute top-1 left-1">
                            <div className="bg-black/40 backdrop-blur-sm rounded-md px-1.5 py-0.5">
                              <MapPin size={9} className="text-white/60" />
                            </div>
                          </div>
                        )}

                        {/* Date strip */}
                        {photo.taken_at && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1.5">
                            <p className="text-[9px] text-white/90 leading-none">
                              {format(new Date(photo.taken_at), 'MMM d, yy')}
                            </p>
                          </div>
                        )}

                        {/* Delete button — own photos only */}
                        {photo.uploader_id === user?.id && (
                          <div className="absolute top-1 right-1">
                            <DeleteButton
                              photo={photo}
                              confirmId={confirmDeleteId}
                              deletingId={deletingId}
                              onConfirmChange={setConfirmDeleteId}
                              onDelete={handleDelete}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab switcher — always on top */}
      <div className="absolute top-4 left-0 right-0 z-[1002] flex justify-center safe-top pointer-events-none">
        <div className="pointer-events-auto bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 flex p-1 gap-1">
          <button
            onClick={() => setView('map')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all ${
              view === 'map' ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            <MapIcon size={14} />
            Map
          </button>
          <button
            onClick={() => { setView('gallery'); setConfirmDeleteId(null) }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all ${
              view === 'gallery' ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            <Image size={14} />
            Gallery
          </button>
        </div>
      </div>

      {/* Add photo button */}
      <div className="absolute top-4 right-4 z-[1001] safe-top">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => fileInputRef.current?.click()}
          className="bg-white dark:bg-gray-900 shadow-lg rounded-2xl px-4 py-3 flex items-center gap-2 text-rose-600 font-medium text-sm border border-rose-100"
        >
          <Plus size={18} />
          Add photo
        </motion.button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Memory count badge (map view only) */}
      {view === 'map' && photos.length > 0 && (
        <div className="absolute top-4 left-4 z-[1001] safe-top">
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-2xl px-3 py-2 shadow border border-rose-100 flex items-center gap-1.5">
            <MapPin size={13} className="text-rose-500" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              {pinnedCount} pin{pinnedCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Cluster viewer sheet */}
      <AnimatePresence>
        {selected && view === 'map' && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute bottom-24 left-0 right-0 z-[1000] mx-4"
          >
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <MapPin size={15} className="text-rose-500" />
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">
                    {selected.photos.length} photo{selected.photos.length > 1 ? 's' : ''} here
                  </span>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                  <X size={18} />
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto p-4 scrollbar-hide">
                {selected.photos.map((photo) => (
                  <div key={photo.id} className="flex-none w-44">
                    <div className="relative w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden">
                      {decryptedUrls[photo.id] ? (
                        <img src={decryptedUrls[photo.id]} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="w-5 h-5 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin block" />
                        </div>
                      )}
                      {photo.uploader_id === user?.id && (
                        <div className="absolute top-2 right-2">
                          <DeleteButton
                            photo={photo}
                            confirmId={confirmDeleteId}
                            deletingId={deletingId}
                            onConfirmChange={setConfirmDeleteId}
                            onDelete={handleDelete}
                          />
                        </div>
                      )}
                    </div>
                    {photo.taken_at && (
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-400">
                        <Calendar size={9} />
                        {format(new Date(photo.taken_at), 'MMM d, yyyy')}
                      </div>
                    )}
                    {photo.caption && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{photo.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload modal */}
      <AnimatePresence>
        {pending && (
          <UploadModal
            pending={pending}
            onClose={() => { URL.revokeObjectURL(pending.previewUrl); setPending(null) }}
            onConfirm={handleConfirm}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
