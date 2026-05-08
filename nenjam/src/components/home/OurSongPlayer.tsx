import { useEffect, useRef, useState } from 'react'
import { Music, Volume2, VolumeX } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '../../stores/appStore'

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  return match?.[1] ?? null
}

export default function OurSongPlayer() {
  const { ourSongUrl } = useAppStore()
  const [muted, setMuted] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  if (!ourSongUrl) return null
  const videoId = getYouTubeId(ourSongUrl)
  if (!videoId) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4 flex items-center gap-3"
    >
      <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center flex-none">
        <Music size={18} className="text-rose-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Our Song</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate mt-0.5">
          Playing softly 🎵
        </p>
      </div>
      <button
        onClick={() => setMuted((v) => !v)}
        className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-500 hover:bg-rose-100 transition-colors"
      >
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>

      {/* Invisible auto-playing YouTube iframe */}
      <iframe
        ref={iframeRef}
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&mute=${muted ? 1 : 0}`}
        allow="autoplay"
        title="Our song"
      />
    </motion.div>
  )
}
