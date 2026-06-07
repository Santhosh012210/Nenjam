import {
  useEffect, useRef, useState, useCallback
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Moon, ImagePlus, Play, Pause, Volume2, VolumeX, Music } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useAppStore } from '../stores/appStore'
import { useReelMusic } from '../contexts/ReelMusicContext'
import type { TimelineEntry } from '../types'

import EmptyTimeline from '../components/timeline/EmptyTimeline'
import TimelineNav from '../components/timeline/TimelineNav'
import MemorySection, { type MemorySectionHandle } from '../components/timeline/MemorySection'
import AddMomentSheet from '../components/timeline/AddMomentSheet'
import MemoryDetailSheet from '../components/timeline/MemoryDetailSheet'
import HiddenReveal from '../components/timeline/HiddenReveal'

// ── Background image storage ──────────────────────────────────────────────────

function openBgDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open('nenjam-bg-v1', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('bg')
    req.onsuccess = () => res(req.result)
    req.onerror   = () => rej(req.error)
  })
}
async function loadBgBlob(): Promise<Blob | null> {
  const db = await openBgDB()
  return new Promise(res => {
    const req = db.transaction('bg', 'readonly').objectStore('bg').get('wallpaper')
    req.onsuccess = () => res(req.result ?? null)
    req.onerror   = () => res(null)
  })
}
async function saveBgBlob(blob: Blob): Promise<void> {
  const db = await openBgDB()
  return new Promise(res => {
    const tx = db.transaction('bg', 'readwrite')
    tx.objectStore('bg').put(blob, 'wallpaper')
    tx.oncomplete = () => res()
    tx.onerror    = () => res()
  })
}

const AUTOSCROLL_MS = 5000

export default function TimelinePage() {
  const { user, partner } = useAuthStore()
  const { ourSongUrl }    = useAppStore()
  const music             = useReelMusic()

  const [entries,       setEntries]       = useState<TimelineEntry[]>([])
  const [loading,       setLoading]       = useState(true)
  const [activeIndex,   setActiveIndex]   = useState(0)
  const [selectedEntry, setSelectedEntry] = useState<TimelineEntry | null>(null)
  const [showAdd,       setShowAdd]       = useState(false)
  const [showHidden,    setShowHidden]    = useState(false)
  const [hiddenPulsing, setHiddenPulsing] = useState(true)
  const [autoScrolling, setAutoScrolling] = useState(false)
  const [bgUrl,         setBgUrl]         = useState<string | null>(null)

  const scrollRef      = useRef<HTMLDivElement>(null)
  const bgInputRef     = useRef<HTMLInputElement>(null)
  const sectionRefs    = useRef<(MemorySectionHandle | null)[]>([])
  const tickingRef     = useRef(false)
  const newEntryIdRef  = useRef<string | null>(null)
  const autoTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoEnabledRef = useRef(false)   // user has toggled autoscroll ON
  const entriesRef     = useRef<TimelineEntry[]>([])
  const musicRef       = useRef(music)

  entriesRef.current = entries
  musicRef.current   = music

  // ── Load saved background ──────────────────────────────────────────────────
  useEffect(() => {
    let url: string
    loadBgBlob().then(blob => {
      if (blob) { url = URL.createObjectURL(blob); setBgUrl(url) }
    })
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [])

  const handleBgChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBgUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    const url = URL.createObjectURL(file)
    setBgUrl(url)
    saveBgBlob(file)
    e.target.value = ''
  }, [])

  // ── Load entries ───────────────────────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    if (!user) return
    const ids = [user.id, ...(partner ? [partner.id] : [])]
    const { data } = await supabase
      .from('timeline_entries')
      .select('*')
      .in('created_by', ids)
      .order('date', { ascending: true })
    setEntries((data as TimelineEntry[]) ?? [])
    setLoading(false)
  }, [user, partner])

  useEffect(() => { loadEntries() }, [loadEntries])

  // ── Background music (Our Song via YouTube) ────────────────────────────────
  useEffect(() => {
    const m = musicRef.current
    if (!ourSongUrl) return
    if (m.currentSong?.url !== ourSongUrl) {
      supabase.from('tamil_songs').select('title, artist').eq('youtube_url', ourSongUrl).maybeSingle().then(({ data }) => {
        m.loadSong({ title: data?.title ?? 'Our Song', artist: data?.artist ?? '', url: ourSongUrl })
      })
    }
    m.play()
    return () => m.pause()
  }, [ourSongUrl])

  // ── Autoscroll ─────────────────────────────────────────────────────────────
  const clearAutoTimer = () => {
    if (autoTimerRef.current) { clearInterval(autoTimerRef.current); autoTimerRef.current = null }
  }

  const scheduleNext = useCallback(() => {
    clearAutoTimer()
    autoTimerRef.current = setInterval(() => {
      const el   = scrollRef.current
      const ents = entriesRef.current
      if (!el || ents.length === 0) return
      const cur  = Math.round(el.scrollTop / el.clientHeight)
      const next = (cur + 1) % ents.length
      // scrollIntoView is more reliable than scrollTo inside snap containers
      ;(el.children[next] as HTMLElement | undefined)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, AUTOSCROLL_MS)
  }, [])

  const startAutoScroll = useCallback(() => {
    autoEnabledRef.current = true
    setAutoScrolling(true)
    scheduleNext()
  }, [scheduleNext])

  const stopAutoScroll = useCallback(() => {
    autoEnabledRef.current = false
    setAutoScrolling(false)
    clearAutoTimer()
  }, [])

  // Pause while finger is down, resume on release
  const handleScrollPointerDown = useCallback(() => {
    if (autoEnabledRef.current) clearAutoTimer()
  }, [])
  const handleScrollPointerUp = useCallback(() => {
    if (autoEnabledRef.current) scheduleNext()
  }, [scheduleNext])

  useEffect(() => () => clearAutoTimer(), [])

  // ── Stop hidden button pulse after 6 s ────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setHiddenPulsing(false), 6000)
    return () => clearTimeout(t)
  }, [])

  // ── Entrance animations via IntersectionObserver ───────────────────────────
  useEffect(() => {
    if (entries.length === 0) return
    const initialDelay = setTimeout(() => {
      sectionRefs.current[0]?.triggerEntrance()
      setTimeout(() => sectionRefs.current[1]?.triggerEntrance(), 80)
    }, 200)
    const observers: IntersectionObserver[] = []
    const container = scrollRef.current
    if (!container) return () => clearTimeout(initialDelay)
    entries.forEach((_, i) => {
      if (i < 2) return
      const sectionEl = container.children[i] as HTMLElement | undefined
      if (!sectionEl) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) { sectionRefs.current[i]?.triggerEntrance(); obs.disconnect() } },
        { root: container, threshold: 0.15 }
      )
      obs.observe(sectionEl)
      observers.push(obs)
    })
    return () => { clearTimeout(initialDelay); observers.forEach(o => o.disconnect()) }
  }, [entries])

  // ── RAF scroll loop ────────────────────────────────────────────────────────
  const update = useCallback(() => {
    const el = scrollRef.current
    if (!el) { tickingRef.current = false; return }
    const scrollTop     = el.scrollTop
    const sectionHeight = el.clientHeight
    const nearest = Math.round(scrollTop / sectionHeight)
    setActiveIndex(Math.max(0, Math.min(nearest, entries.length - 1)))
    sectionRefs.current.forEach((handle, i) => handle?.applyScroll(scrollTop, sectionHeight, i))
    tickingRef.current = false
  }, [entries.length])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      if (!tickingRef.current) { tickingRef.current = true; requestAnimationFrame(update) }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    requestAnimationFrame(update)
    return () => el.removeEventListener('scroll', onScroll)
  }, [update])

  // ── After adding a new entry ───────────────────────────────────────────────
  const handleAdded = useCallback(async (newId: string) => {
    newEntryIdRef.current = newId
    setShowAdd(false)
    await loadEntries()
    setTimeout(() => {
      const el = scrollRef.current
      if (!el) return
      const idx = entries.findIndex(e => e.id === newId)
      el.scrollTo({ top: (idx !== -1 ? idx : entries.length) * el.clientHeight, behavior: 'smooth' })
    }, 100)
  }, [loadEntries, entries])

  const handleDotClick = (index: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: index * el.clientHeight, behavior: 'smooth' })
  }

  const handleEntryEdited  = (updated: TimelineEntry) => {
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
    setSelectedEntry(updated)
  }
  const handleEntryDeleted = () => {
    if (selectedEntry) setEntries(prev => prev.filter(e => e.id !== selectedEntry.id))
    setSelectedEntry(null)
  }

  useEffect(() => {
    const onResize = () => requestAnimationFrame(update)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [update])

  const bgStyle: React.CSSProperties = bgUrl
    ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.38),rgba(0,0,0,0.38)),url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {}

  // ── Top-left control bar (shared by both states) ───────────────────────────
  const TopControls = (
    <div style={{ position: 'fixed', top: 'max(16px, env(safe-area-inset-top, 16px))', left: 16, zIndex: 20, display: 'flex', gap: 8 }}>
      <input ref={bgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgChange} />
      <button onClick={() => bgInputRef.current?.click()} style={iconBtn} title="Change background">
        <ImagePlus size={14} />
      </button>
      {entries.length > 1 && (
        <button
          onClick={() => autoScrolling ? stopAutoScroll() : startAutoScroll()}
          style={{ ...iconBtn, borderColor: autoScrolling ? 'rgba(212,83,126,0.5)' : 'rgba(255,255,255,0.2)', background: autoScrolling ? 'rgba(212,83,126,0.15)' : 'rgba(255,255,255,0.08)' }}
          title={autoScrolling ? 'Stop autoscroll' : 'Start autoscroll'}
        >
          {autoScrolling ? <Pause size={14} color="#F4C0D1" /> : <Play size={14} />}
        </button>
      )}
      {ourSongUrl && (
        <button
          onClick={() => music.toggleMute()}
          style={{ ...iconBtn, borderColor: !music.isMuted ? 'rgba(212,83,126,0.5)' : 'rgba(255,255,255,0.2)', background: !music.isMuted ? 'rgba(212,83,126,0.15)' : 'rgba(255,255,255,0.08)' }}
          title={music.isMuted ? 'Unmute' : 'Mute'}
        >
          {music.isMuted ? <VolumeX size={14} /> : <Volume2 size={14} color="#F4C0D1" />}
        </button>
      )}
    </div>
  )

  // ── iOS tap-to-play music pill ─────────────────────────────────────────────
  const MusicGesturePill = music.needsGesture && ourSongUrl ? (
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        onClick={() => music.triggerPlay()}
        style={{
          position: 'fixed',
          top: 'calc(max(16px, env(safe-area-inset-top, 16px)) + 50px)',
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 25,
          background: 'rgba(255,255,255,0.92)',
          border: 'none', borderRadius: 20,
          padding: '7px 16px',
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}
      >
        <Music size={13} color="#be185d" />
        <span style={{ fontSize: 12, color: '#be185d', fontWeight: 600 }}>Tap to play music</span>
      </motion.button>
    </AnimatePresence>
  ) : null

  if (loading) {
    return (
      <div style={{ height: '100vh', background: '#0d0008', ...bgStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(212,83,126,0.3)', borderTopColor: '#D4537E', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', background: '#0d0008', ...bgStyle }}>
        <EmptyTimeline onAdd={() => setShowAdd(true)} />
        {TopControls}
        {MusicGesturePill}
        <AnimatePresence>
          {showAdd && <AddMomentSheet onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
        </AnimatePresence>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height: '100vh', background: '#000', overflow: 'hidden', ...bgStyle }}>
      {/* ── Snap scroll container ── */}
      <div
        ref={scrollRef}
        onPointerDown={handleScrollPointerDown}
        onPointerUp={handleScrollPointerUp}
        onPointerCancel={handleScrollPointerUp}
        style={{
          height: '100vh',
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
        }}
      >
        {entries.map((entry, i) => (
          <MemorySection
            key={entry.id}
            ref={el => { sectionRefs.current[i] = el }}
            entry={entry}
            index={i}
            onTap={() => setSelectedEntry(entry)}
          />
        ))}
      </div>

      {/* ── Nav dots ── */}
      <TimelineNav count={entries.length} activeIndex={activeIndex} onDotClick={handleDotClick} />

      {/* ── Top-left controls: background / autoscroll / mute ── */}
      {TopControls}
      {MusicGesturePill}

      {/* ── Autoscroll progress bar ── */}
      {autoScrolling && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 2, zIndex: 20, background: 'rgba(255,255,255,0.08)' }}>
          <div key={activeIndex} style={{ height: '100%', background: '#D4537E', animation: `prog ${AUTOSCROLL_MS}ms linear forwards` }} />
        </div>
      )}

      {/* ── Hidden Timeline pill ── */}
      <div style={{ position: 'fixed', top: 'max(16px, env(safe-area-inset-top, 16px))', right: 16, zIndex: 20 }}>
        <button
          onClick={() => setShowHidden(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.7)', borderRadius: 20, padding: '5px 12px',
            fontSize: 11, cursor: 'pointer', fontFamily: "'Noto Sans Tamil', sans-serif",
            animation: hiddenPulsing ? 'hiddenPulse 2s ease-in-out infinite' : 'none',
          }}
        >
          <Moon size={11} />
          Hidden Timeline
        </button>
      </div>

      {/* ── Add moment FAB ── */}
      <button
        onClick={() => setShowAdd(true)}
        style={{
          position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)', right: 24, zIndex: 20,
          width: 48, height: 48, borderRadius: '50%', background: '#D4537E', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(212,83,126,0.45)',
        }}
      >
        <Plus size={22} color="white" />
      </button>

      {/* ── Sheets ── */}
      <AnimatePresence>
        {showAdd && <AddMomentSheet onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
      </AnimatePresence>
      <AnimatePresence>
        {selectedEntry && (
          <MemoryDetailSheet
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
            onDeleted={handleEntryDeleted}
            onEdited={handleEntryEdited}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showHidden && <HiddenReveal onClose={() => setShowHidden(false)} />}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes prog { from { width: 0% } to { width: 100% } }
        @keyframes hiddenPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
      `}</style>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: '50%',
  background: 'rgba(255,255,255,0.08)',
  border: '0.5px solid rgba(255,255,255,0.2)',
  color: 'rgba(255,255,255,0.55)',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(10px)',
}
