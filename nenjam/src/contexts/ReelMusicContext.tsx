import {
  createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback,
} from 'react'

// ── YouTube IFrame API global types ───────────────────────────────────────────
declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, opts: YTPlayerOptions) => YTPlayer
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; UNSTARTED: number }
    }
    onYouTubeIframeAPIReady: () => void
  }
}
interface YTPlayerOptions {
  videoId?: string
  playerVars?: Record<string, number | string>
  events?: {
    onReady?: (e: { target: YTPlayer }) => void
    onStateChange?: (e: { data: number }) => void
    onError?: () => void
  }
}
interface YTPlayer {
  loadVideoById(id: string): void
  playVideo(): void
  pauseVideo(): void
  setVolume(v: number): void
  getVolume(): number
  getPlayerState(): number
  destroy(): void
}

// ── Context shape ─────────────────────────────────────────────────────────────
export interface ReelSong { title: string; artist: string; url: string }

interface ReelMusicCtx {
  currentSong: ReelSong | null
  isPlaying: boolean
  isMuted: boolean
  needsGesture: boolean
  play: () => void
  pause: () => void
  toggleMute: () => void
  loadSong: (song: ReelSong) => void
  triggerPlay: () => void
}

const Ctx = createContext<ReelMusicCtx | null>(null)

export function useReelMusic() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useReelMusic must be inside ReelMusicProvider')
  return c
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TARGET_VOL = 28

function extractVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m?.[1] ?? null
}

function fadeVol(playerRef: React.MutableRefObject<YTPlayer | null>, from: number, to: number, ms: number) {
  const steps = 30
  const stepMs = ms / steps
  const step = (to - from) / steps
  let cur = from
  let count = 0
  const id = setInterval(() => {
    count++
    cur += step
    playerRef.current?.setVolume(Math.max(0, Math.min(100, cur)))
    if (count >= steps) clearInterval(id)
  }, stepMs)
  return id
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function ReelMusicProvider({ children }: { children: ReactNode }) {
  const playerRef    = useRef<YTPlayer | null>(null)
  const readyRef     = useRef(false)
  const fadeRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingRef   = useRef<string | null>(null)
  const wantsPlayRef = useRef(false)  // tracks whether we intend to be playing

  const [apiReady,     setApiReady]     = useState(false)
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [isMuted,      setIsMuted]      = useState(() => localStorage.getItem('reel_music_muted') === 'true')
  const [currentSong,  setCurrentSong]  = useState<ReelSong | null>(null)
  const [needsGesture, setNeedsGesture] = useState(false)

  const isMutedRef = useRef(isMuted)
  isMutedRef.current = isMuted

  // Load YouTube IFrame API once
  useEffect(() => {
    if (window.YT?.Player) { setApiReady(true); return }
    if (document.getElementById('yt-iframe-api')) return
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); setApiReady(true) }
    const s = document.createElement('script')
    s.id  = 'yt-iframe-api'
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(s)
  }, [])

  // Create hidden player once API ready
  useEffect(() => {
    if (!apiReady || document.getElementById('reel-yt-player')) return
    const div = document.createElement('div')
    div.id = 'reel-yt-player'
    Object.assign(div.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none', bottom: '0', left: '0', zIndex: '-1' })
    document.body.appendChild(div)

    const startPlayback = () => {
      if (!playerRef.current || !wantsPlayRef.current) return
      if (fadeRef.current) clearInterval(fadeRef.current)
      playerRef.current.playVideo()
      if (!isMutedRef.current) {
        playerRef.current.setVolume(0)
        fadeRef.current = fadeVol(playerRef, 0, TARGET_VOL, 2000)
      }
      setNeedsGesture(false)
    }

    playerRef.current = new window.YT.Player('reel-yt-player', {
      playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0 },
      events: {
        onReady: () => {
          readyRef.current = true
          if (pendingRef.current) {
            const vid = extractVideoId(pendingRef.current)
            pendingRef.current = null
            if (vid) {
              playerRef.current?.loadVideoById(vid)
              // onStateChange(5) will handle auto-play; also set a fallback
              setTimeout(startPlayback, 600)
            }
          }
        },
        onStateChange: (e) => {
          setIsPlaying(e.data === 1)
          if (e.data === 5 && wantsPlayRef.current) {
            // Video cued and ready — start playback
            startPlayback()
          } else if (e.data === 0 && wantsPlayRef.current) {
            // Ended — loop manually (loop:1 only works with a playlist param)
            playerRef.current?.playVideo()
          } else if (e.data === -1 && wantsPlayRef.current) {
            // iOS blocked autoplay — show tap prompt
            setNeedsGesture(true)
          }
        },
        onError: () => { if (wantsPlayRef.current) setNeedsGesture(true) },
      },
    })

    return () => {
      playerRef.current?.destroy()
      document.getElementById('reel-yt-player')?.remove()
    }
  }, [apiReady])

  const clearFade = () => { if (fadeRef.current) clearInterval(fadeRef.current) }

  const play = useCallback(() => {
    wantsPlayRef.current = true
    if (!playerRef.current || !readyRef.current) return
    clearFade()
    playerRef.current.playVideo()
    if (!isMutedRef.current) {
      playerRef.current.setVolume(0)
      fadeRef.current = fadeVol(playerRef, 0, TARGET_VOL, 2000)
    } else {
      playerRef.current.setVolume(0)
    }
    setNeedsGesture(false)
  }, [])

  const pause = useCallback(() => {
    wantsPlayRef.current = false
    if (!playerRef.current || !readyRef.current) return
    clearFade()
    const cur = playerRef.current.getVolume()
    fadeRef.current = fadeVol(playerRef, cur, 0, 1000)
    setTimeout(() => playerRef.current?.pauseVideo(), 1000)
    setIsPlaying(false)
  }, [])

  const toggleMute = useCallback(() => {
    const nowMuted = !isMutedRef.current
    setIsMuted(nowMuted)
    localStorage.setItem('reel_music_muted', String(nowMuted))
    clearFade()
    if (nowMuted) {
      fadeRef.current = fadeVol(playerRef, TARGET_VOL, 0, 500)
    } else {
      fadeRef.current = fadeVol(playerRef, 0, TARGET_VOL, 500)
    }
  }, [])

  const loadSong = useCallback((song: ReelSong) => {
    setCurrentSong(song)
    const vid = extractVideoId(song.url)
    if (!vid) return
    if (!readyRef.current) { pendingRef.current = song.url; return }
    playerRef.current?.loadVideoById(vid)
    // onStateChange(5) fires when cued and triggers startPlayback.
    // Fallback timeout in case state 5 doesn't fire on this platform.
    if (wantsPlayRef.current) {
      setTimeout(() => {
        if (!playerRef.current || !wantsPlayRef.current) return
        if (fadeRef.current) clearInterval(fadeRef.current)
        playerRef.current.playVideo()
        if (!isMutedRef.current) {
          playerRef.current.setVolume(0)
          fadeRef.current = fadeVol(playerRef, 0, TARGET_VOL, 2000)
        }
        setNeedsGesture(false)
      }, 600)
    }
  }, [])

  const triggerPlay = useCallback(() => { play(); setNeedsGesture(false) }, [play])

  return (
    <Ctx.Provider value={{ currentSong, isPlaying, isMuted, needsGesture, play, pause, toggleMute, loadSong, triggerPlay }}>
      {children}
    </Ctx.Provider>
  )
}
