import {
  useEffect, useRef, useState, useCallback
} from 'react'
import { AnimatePresence } from 'framer-motion'
import { Plus, Moon, ImagePlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { TimelineEntry } from '../types'

import EmptyTimeline from '../components/timeline/EmptyTimeline'
import TimelineNav from '../components/timeline/TimelineNav'
import MemorySection, { type MemorySectionHandle } from '../components/timeline/MemorySection'
import AddMomentSheet from '../components/timeline/AddMomentSheet'
import MemoryDetailSheet from '../components/timeline/MemoryDetailSheet'
import HiddenReveal from '../components/timeline/HiddenReveal'
import TimelineMusicPlayer from '../components/timeline/TimelineMusicPlayer'

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

export default function TimelinePage() {
  const { user, partner } = useAuthStore()

  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedEntry, setSelectedEntry] = useState<TimelineEntry | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [hiddenPulsing, setHiddenPulsing] = useState(true)

  const [bgUrl, setBgUrl] = useState<string | null>(null)

  const scrollRef    = useRef<HTMLDivElement>(null)
  const bgInputRef   = useRef<HTMLInputElement>(null)
  // One ref per section, imperative handle for scroll-driven transforms
  const sectionRefs  = useRef<(MemorySectionHandle | null)[]>([])
  const tickingRef   = useRef(false)
  const newEntryIdRef = useRef<string | null>(null)

  // ── Load saved background ────────────────────────────────────────────────
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

  // ── Load entries ────────────────────────────────────────────────────────────
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

  // Stop hidden button pulse after 6 s
  useEffect(() => {
    const t = setTimeout(() => setHiddenPulsing(false), 6000)
    return () => clearTimeout(t)
  }, [])

  // ── Entrance animations via IntersectionObserver ────────────────────────────
  useEffect(() => {
    if (entries.length === 0) return

    // Trigger first 2 entries after 200ms
    const initialDelay = setTimeout(() => {
      sectionRefs.current[0]?.triggerEntrance()
      setTimeout(() => sectionRefs.current[1]?.triggerEntrance(), 80)
    }, 200)

    // All others: triggered by IntersectionObserver when they enter viewport
    const observers: IntersectionObserver[] = []
    const container = scrollRef.current
    if (!container) return () => clearTimeout(initialDelay)

    entries.forEach((_, i) => {
      if (i < 2) return
      const sectionEl = container.children[i] as HTMLElement | undefined
      if (!sectionEl) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            sectionRefs.current[i]?.triggerEntrance()
            obs.disconnect()
          }
        },
        { root: container, threshold: 0.15 }
      )
      obs.observe(sectionEl)
      observers.push(obs)
    })

    return () => {
      clearTimeout(initialDelay)
      observers.forEach((o) => o.disconnect())
    }
  }, [entries])

  // ── RAF scroll loop ─────────────────────────────────────────────────────────
  const update = useCallback(() => {
    const el = scrollRef.current
    if (!el) { tickingRef.current = false; return }
    const scrollTop = el.scrollTop
    const sectionHeight = el.clientHeight

    // Update active dot
    const nearest = Math.round(scrollTop / sectionHeight)
    setActiveIndex(Math.max(0, Math.min(nearest, entries.length - 1)))

    // Drive transforms on all sections
    sectionRefs.current.forEach((handle, i) => {
      handle?.applyScroll(scrollTop, sectionHeight, i)
    })

    tickingRef.current = false
  }, [entries.length])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      if (!tickingRef.current) {
        tickingRef.current = true
        requestAnimationFrame(update)
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    // Initial paint pass
    requestAnimationFrame(update)
    return () => el.removeEventListener('scroll', onScroll)
  }, [update])

  // ── After adding a new entry ─────────────────────────────────────────────
  const handleAdded = useCallback(async (newId: string) => {
    newEntryIdRef.current = newId
    setShowAdd(false)
    await loadEntries()
    // Scroll to new entry after state update
    setTimeout(() => {
      const el = scrollRef.current
      if (!el) return
      const idx = entries.findIndex((e) => e.id === newId)
      const target = idx !== -1 ? idx : entries.length
      el.scrollTo({ top: target * el.clientHeight, behavior: 'smooth' })
    }, 100)
  }, [loadEntries, entries])

  const handleDotClick = (index: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: index * el.clientHeight, behavior: 'smooth' })
  }

  const handleEntryEdited = (updated: TimelineEntry) => {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    setSelectedEntry(updated)
  }

  const handleEntryDeleted = () => {
    if (selectedEntry) {
      setEntries((prev) => prev.filter((e) => e.id !== selectedEntry.id))
    }
    setSelectedEntry(null)
  }

  // ── Resize: re-run RAF on orientation change ────────────────────────────────
  useEffect(() => {
    const onResize = () => requestAnimationFrame(update)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [update])

  const bgStyle: React.CSSProperties = bgUrl
    ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.38), rgba(0,0,0,0.38)), url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {}

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
        <TimelineMusicPlayer />
        {/* ── Change background button ── */}
        <div style={{ position: 'fixed', top: 'max(16px, env(safe-area-inset-top, 16px))', left: 16, zIndex: 20 }}>
          <input ref={bgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgChange} />
          <button onClick={() => bgInputRef.current?.click()} style={bgBtnStyle} title="Change background">
            <ImagePlus size={14} />
          </button>
        </div>
        <AnimatePresence>
          {showAdd && (
            <AddMomentSheet
              onClose={() => setShowAdd(false)}
              onAdded={handleAdded}
            />
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height: '100vh', background: '#000', overflow: 'hidden', ...bgStyle }}>
      {/* ── Snap scroll container ── */}
      <div
        ref={scrollRef}
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
            ref={(el) => { sectionRefs.current[i] = el }}
            entry={entry}
            index={i}
            onTap={() => setSelectedEntry(entry)}
          />
        ))}
      </div>

      {/* ── Nav dots ── */}
      <TimelineNav
        count={entries.length}
        activeIndex={activeIndex}
        onDotClick={handleDotClick}
      />

      {/* ── Change background button ── */}
      <div style={{ position: 'fixed', top: 'max(16px, env(safe-area-inset-top, 16px))', left: 16, zIndex: 20 }}>
        <input ref={bgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgChange} />
        <button onClick={() => bgInputRef.current?.click()} style={bgBtnStyle} title="Change background">
          <ImagePlus size={14} />
        </button>
      </div>

      {/* ── Hidden Timeline pill button ── */}
      <div
        style={{
          position: 'fixed',
          top: 'max(16px, env(safe-area-inset-top, 16px))',
          right: 16,
          zIndex: 20,
        }}
      >
        <button
          onClick={() => setShowHidden(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(255,255,255,0.08)',
            border: '0.5px solid rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.7)',
            borderRadius: 20,
            padding: '5px 12px',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: "'Noto Sans Tamil', sans-serif",
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
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
          right: 24,
          zIndex: 20,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#D4537E',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(212,83,126,0.45)',
        }}
      >
        <Plus size={22} color="white" />
      </button>

      {/* ── Sheets ── */}
      <AnimatePresence>
        {showAdd && (
          <AddMomentSheet
            onClose={() => setShowAdd(false)}
            onAdded={handleAdded}
          />
        )}
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

      {/* ── Background music player ── */}
      <TimelineMusicPlayer />

      {/* ── Hidden Timeline overlay ── */}
      <AnimatePresence>
        {showHidden && (
          <HiddenReveal onClose={() => setShowHidden(false)} />
        )}
      </AnimatePresence>

      {/* Global keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes hiddenPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
      `}</style>
    </div>
  )
}

const bgBtnStyle: React.CSSProperties = {
  width: 34, height: 34, borderRadius: '50%',
  background: 'rgba(255,255,255,0.08)',
  border: '0.5px solid rgba(255,255,255,0.2)',
  color: 'rgba(255,255,255,0.55)',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(10px)',
}
