import { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import type { HiddenTimelineEntry } from '../../types'
import HiddenMemorySection, { type HiddenSectionHandle } from './HiddenMemorySection'
import HiddenEmptyState from './HiddenEmptyState'
import AddHiddenMemorySheet from './AddHiddenMemorySheet'

interface Props {
  onClose: () => void
  savedScrollTop?: number
}

export default function HiddenTimeline({ onClose, savedScrollTop }: Props) {
  const { user, partner } = useAuthStore()
  const [entries, setEntries] = useState<HiddenTimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<(HiddenSectionHandle | null)[]>([])
  const tickingRef = useRef(false)

  // Load entries
  const loadEntries = useCallback(async () => {
    if (!user) return
    const ids = [user.id, ...(partner ? [partner.id] : [])]
    const { data } = await supabase
      .from('hidden_timeline_entries')
      .select('*')
      .in('created_by', ids)
      .order('created_at', { ascending: true })
    setEntries((data as HiddenTimelineEntry[]) ?? [])
    setLoading(false)
  }, [user, partner])

  useEffect(() => { loadEntries() }, [loadEntries])

  // RAF scroll loop — same mechanics as main timeline
  const update = useCallback(() => {
    const el = scrollRef.current
    if (!el) { tickingRef.current = false; return }
    const scrollTop = el.scrollTop
    const sectionHeight = el.clientHeight
    sectionRefs.current.forEach((handle, i) => {
      handle?.applyScroll(scrollTop, sectionHeight, i)
    })
    tickingRef.current = false
  }, [])

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
    // If parent saved a scrollTop (e.g. for cross-navigation), restore it
    if (savedScrollTop) el.scrollTop = savedScrollTop
    requestAnimationFrame(update)
    return () => el.removeEventListener('scroll', onScroll)
  }, [update, savedScrollTop])

  const handleAdded = async () => {
    setShowAdd(false)
    await loadEntries()
    // Scroll to last entry
    setTimeout(() => {
      const el = scrollRef.current
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }, 100)
  }

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: '#0a0a0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          border: '2px solid rgba(180,180,210,0.3)',
          borderTopColor: 'rgba(180,180,210,0.8)',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <>
        <HiddenEmptyState onAdd={() => setShowAdd(true)} />
        <AnimatePresence>
          {showAdd && (
            <AddHiddenMemorySheet
              onClose={() => setShowAdd(false)}
              onAdded={handleAdded}
            />
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      {/* Snap scroll container */}
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
          <HiddenMemorySection
            key={entry.id}
            ref={(el) => { sectionRefs.current[i] = el }}
            entry={entry}
            index={i}
          />
        ))}
      </div>

      {/* Add hidden memory FAB */}
      <button
        onClick={() => setShowAdd(true)}
        style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 40px)',
          right: 24,
          zIndex: 210,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'rgba(180,180,210,0.25)',
          border: '1px solid rgba(180,180,210,0.35)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(210,210,235,0.9)',
        }}
      >
        <Plus size={22} />
      </button>

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 'max(16px, env(safe-area-inset-top, 16px))',
          left: 16,
          zIndex: 210,
          background: 'rgba(255,255,255,0.08)',
          border: '0.5px solid rgba(255,255,255,0.15)',
          color: 'rgba(255,255,255,0.6)',
          borderRadius: '50%',
          width: 32,
          height: 32,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
        }}
      >
        ✕
      </button>

      <AnimatePresence>
        {showAdd && (
          <AddHiddenMemorySheet
            onClose={() => setShowAdd(false)}
            onAdded={handleAdded}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
