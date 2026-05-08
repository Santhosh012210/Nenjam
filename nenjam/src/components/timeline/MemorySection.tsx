import {
  useRef, useEffect, useState, useImperativeHandle, forwardRef
} from 'react'
import type { TimelineEntry } from '../../types'
import { useTimelineStore } from '../../stores/timelineStore'
import { useEncryptionStore } from '../../stores/encryptionStore'

// ─── Type badge config ────────────────────────────────────────────────────────
const BADGE: Record<TimelineEntry['type'], {
  bg: string; border: string; text: string; label: string
}> = {
  milestone: {
    bg: 'rgba(212,83,126,0.28)', border: 'rgba(212,83,126,0.5)',
    text: '#F4C0D1', label: 'milestone',
  },
  special: {
    bg: 'rgba(127,119,221,0.28)', border: 'rgba(127,119,221,0.5)',
    text: '#CECBF6', label: 'special',
  },
  trip: {
    bg: 'rgba(29,158,117,0.28)', border: 'rgba(29,158,117,0.5)',
    text: '#9FE1CB', label: 'trip',
  },
  everyday: {
    bg: 'rgba(239,159,39,0.28)', border: 'rgba(239,159,39,0.5)',
    text: '#FAC775', label: 'everyday',
  },
}

const BG_COLOR: Record<TimelineEntry['type'], string> = {
  milestone: '#1a0812',
  special:   '#0f0a1a',
  trip:      '#0a1a14',
  everyday:  '#1a1208',
}

// ─── Public API exposed via ref ───────────────────────────────────────────────
export interface MemorySectionHandle {
  applyScroll: (scrollTop: number, sectionHeight: number, index: number) => void
  triggerEntrance: () => void
}

interface Props {
  entry: TimelineEntry
  index: number
  onTap: () => void
}

const MemorySection = forwardRef<MemorySectionHandle, Props>(function MemorySection(
  { entry, onTap },
  ref
) {
  const photoLayerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [displayUrl, setDisplayUrl] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const { getOrDecrypt } = useTimelineStore()
  const { sharedKey, privateJournalKey } = useEncryptionStore()

  const photoKeys = entry.photo_urls ?? []
  const hasPhotos = photoKeys.length > 0

  // ── Decrypt current photo ──────────────────────────────────────────────────
  useEffect(() => {
    const key = photoKeys[activePhotoIndex]
    if (!key) { setDisplayUrl(null); return }
    const encKey = sharedKey ?? privateJournalKey
    if (!encKey) return

    let cancelled = false
    getOrDecrypt(key, encKey).then((url) => {
      if (!cancelled) setDisplayUrl(url)
    })
    return () => { cancelled = true }
  }, [activePhotoIndex, photoKeys, sharedKey, privateJournalKey, getOrDecrypt])

  // ── Preload next photo when this one is being scrolled away ───────────────
  const preloadNext = () => {
    const nextKey = photoKeys[activePhotoIndex + 1]
    if (!nextKey) return
    const encKey = sharedKey ?? privateJournalKey
    if (!encKey) return
    getOrDecrypt(nextKey, encKey)
  }

  // ── Scroll-driven scale (called from parent RAF loop) ─────────────────────
  useImperativeHandle(ref, () => ({
    applyScroll(scrollTop: number, sectionHeight: number, index: number) {
      const raw = (scrollTop - index * sectionHeight) / sectionHeight
      const clamped = Math.max(-1, Math.min(1, raw))

      let scale: number
      if (clamped < 0) {
        // Entering from below: 0.72 → 1.0
        scale = 0.72 + (1 + clamped) * 0.28
      } else {
        // In view / leaving: 1.0 → 1.22
        scale = 1.0 + clamped * 0.22
        // Preload next photo when this section is half-scrolled away
        if (clamped > 0.5) preloadNext()
      }

      if (photoLayerRef.current) {
        photoLayerRef.current.style.transform = `scale3d(${scale},${scale},1)`
      }

      // Content drifts up and fades only when leaving (raw > 0)
      if (contentRef.current) {
        if (clamped <= 0) {
          contentRef.current.style.transform = 'translateY(0px)'
          contentRef.current.style.opacity = '1'
        } else {
          const ty = clamped * -28
          const op = Math.max(0, 1 - clamped * 2.6)
          contentRef.current.style.transform = `translateY(${ty}px)`
          contentRef.current.style.opacity = String(op)
        }
      }
    },

    triggerEntrance() {
      const el = contentRef.current
      if (!el) return
      el.style.transition = 'opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1)'
      el.style.opacity = '1'
      el.style.transform = 'translateY(0px)'
      // Remove transition after it fires so RAF loop can take over without fighting CSS
      setTimeout(() => {
        if (el) el.style.transition = ''
      }, 700)
    },
  }))

  // ── Entrance animation initial state (invisible, shifted down) ────────────
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.opacity = '0'
      contentRef.current.style.transform = 'translateY(32px)'
    }
    setLoaded(true)
  }, [])

  const badge = BADGE[entry.type]
  const bgColor = BG_COLOR[entry.type]

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00')
      return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        scrollSnapAlign: 'start',
        scrollSnapStop: 'always',
        background: bgColor,
        fontFamily: "'Noto Sans Tamil', sans-serif",
        opacity: loaded ? 1 : 0,
      }}
    >
      {/* ── Photo layer — extra 30% on all sides for scale room ── */}
      <div
        ref={photoLayerRef}
        style={{
          position: 'absolute',
          inset: '-15%',
          width: '130%',
          height: '130%',
          willChange: 'transform',
          transformOrigin: 'center center',
          transform: 'scale3d(0.72,0.72,1)',
        }}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : hasPhotos ? (
          // Placeholder shimmer while decrypting
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
            animation: 'pulse 1.8s ease-in-out infinite',
          }} />
        ) : null}
      </div>

      {/* ── Gradient overlay — static, does NOT scale ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.18) 50%, transparent 100%)',
        }}
      />

      {/* ── Clickable content block ── */}
      <div
        ref={contentRef}
        onClick={onTap}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '32px 24px 68px',
          zIndex: 3,
          cursor: 'pointer',
          willChange: 'transform, opacity',
        }}
      >
        {/* Type badge */}
        <div style={{ marginBottom: 10 }}>
          <span style={{
            display: 'inline-block',
            background: badge.bg,
            border: `1px solid ${badge.border}`,
            color: badge.text,
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {badge.label}
          </span>
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: 22,
          fontWeight: 500,
          color: 'white',
          lineHeight: 1.2,
          margin: '0 0 6px',
          letterSpacing: '-0.01em',
        }}>
          {entry.title}
        </h2>

        {/* Date */}
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '0 0 10px' }}>
          {formatDate(entry.date)}
        </p>

        {/* Note */}
        {entry.note && (
          <p style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.78)',
            lineHeight: 1.55,
            margin: '0 0 14px',
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {entry.note}
          </p>
        )}

        {/* Multi-photo thumbnail strip */}
        {photoKeys.length > 1 && (
          <ThumbnailStrip
            photoKeys={photoKeys}
            activeIndex={activePhotoIndex}
            onSelect={setActivePhotoIndex}
          />
        )}
      </div>
    </div>
  )
})

// ─── Thumbnail strip ──────────────────────────────────────────────────────────
function ThumbnailStrip({
  photoKeys,
  activeIndex,
  onSelect,
}: {
  photoKeys: string[]
  activeIndex: number
  onSelect: (i: number) => void
}) {
  const { getOrDecrypt } = useTimelineStore()
  const { sharedKey, privateJournalKey } = useEncryptionStore()
  const [thumbUrls, setThumbUrls] = useState<Record<number, string>>({})

  useEffect(() => {
    const encKey = sharedKey ?? privateJournalKey
    if (!encKey) return
    photoKeys.forEach((key, i) => {
      getOrDecrypt(key, encKey).then((url) => {
        if (url) setThumbUrls((prev) => ({ ...prev, [i]: url }))
      })
    })
  }, [photoKeys, sharedKey, privateJournalKey, getOrDecrypt])

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
      {photoKeys.map((_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            overflow: 'hidden',
            border: i === activeIndex ? '2px solid white' : '2px solid rgba(255,255,255,0.25)',
            padding: 0,
            cursor: 'pointer',
            background: 'rgba(255,255,255,0.1)',
            transition: 'border-color 0.3s ease, opacity 0.3s ease',
            opacity: i === activeIndex ? 1 : 0.7,
            flexShrink: 0,
          }}
        >
          {thumbUrls[i] ? (
            <img src={thumbUrls[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.08)' }} />
          )}
        </button>
      ))}
    </div>
  )
}

export default MemorySection
