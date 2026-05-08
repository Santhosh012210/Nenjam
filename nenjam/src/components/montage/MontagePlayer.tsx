import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Music } from 'lucide-react'
import { downloadEncryptedPhoto } from '../../lib/r2'
import { decryptBinary } from '../../lib/encryption'
import { uint8ArrayToObjectUrl, revokeObjectUrl } from '../../lib/imageProcessing'
import type { Photo } from '../../types'
import { format } from 'date-fns'

const DEFAULT_SONGS = [
  { title: 'Vaseegara', youtube: 'https://www.youtube.com/watch?v=example1' },
  { title: 'Munbe Vaa', youtube: 'https://www.youtube.com/watch?v=example2' },
  { title: 'Ennodu Nee Irundhaal', youtube: 'https://www.youtube.com/watch?v=example3' },
  { title: 'Kadhal Sadugudu', youtube: 'https://www.youtube.com/watch?v=example4' },
  { title: 'Snegithane', youtube: 'https://www.youtube.com/watch?v=example5' },
]

interface Props {
  photos: Photo[]
  sharedKey: Uint8Array | null
  onClose: () => void
}

export default function MontagePlayer({ photos, sharedKey, onClose }: Props) {
  const [decryptedUrls, setDecryptedUrls] = useState<string[]>([])
  const [current, setCurrent] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const urlsRef = useRef<string[]>([])

  useEffect(() => {
    const load = async () => {
      if (!sharedKey) return
      const urls: string[] = []
      for (const photo of photos) {
        try {
          const { encrypted, nonce } = await downloadEncryptedPhoto(photo.r2_key)
          const bytes = decryptBinary(encrypted, nonce, sharedKey)
          if (bytes) urls.push(uint8ArrayToObjectUrl(bytes))
        } catch {
          // skip failed
        }
      }
      urlsRef.current = urls
      setDecryptedUrls(urls)
      setLoading(false)
      setIsPlaying(true)
    }
    load()
    return () => {
      timerRef.current && clearInterval(timerRef.current)
      urlsRef.current.forEach(revokeObjectUrl)
    }
  }, [photos, sharedKey])

  // Auto-advance slides
  useEffect(() => {
    if (!isPlaying || decryptedUrls.length === 0) return
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % decryptedUrls.length)
    }, 3500)
    return () => { timerRef.current && clearInterval(timerRef.current) }
  }, [isPlaying, decryptedUrls.length])

  const prev = () => setCurrent((c) => (c - 1 + decryptedUrls.length) % decryptedUrls.length)
  const next = () => setCurrent((c) => (c + 1) % decryptedUrls.length)
  const photo = photos[current]

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white"
      >
        <X size={20} />
      </button>

      {/* Header */}
      <div className="absolute top-4 left-4 z-10 text-white">
        <p className="text-xs opacity-70 font-medium uppercase tracking-wider">Memory</p>
        <p className="text-lg font-bold">
          {photo?.taken_at ? format(new Date(photo.taken_at), 'MMMM yyyy') : 'A moment in time'}
        </p>
      </div>

      {/* Image */}
      <div className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.img
              key={current}
              src={decryptedUrls[current]}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
          </AnimatePresence>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        {/* Nav arrows */}
        {decryptedUrls.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 rounded-full flex items-center justify-center text-white"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={next}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 rounded-full flex items-center justify-center text-white"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            {photo?.taken_at && (
              <p className="text-sm opacity-70">{format(new Date(photo.taken_at), 'MMMM d, yyyy')}</p>
            )}
            {photo?.caption && <p className="text-sm mt-1">{photo.caption}</p>}
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5">
            <Music size={14} className="opacity-70" />
            <span className="text-xs opacity-70">
              {DEFAULT_SONGS[current % DEFAULT_SONGS.length]?.title}
            </span>
          </div>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-1.5">
          {decryptedUrls.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all ${i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
