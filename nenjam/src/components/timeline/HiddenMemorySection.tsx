import {
  useRef, useEffect, useState, useImperativeHandle, forwardRef
} from 'react'
import type { HiddenTimelineEntry } from '../../types'
import { useTimelineStore } from '../../stores/timelineStore'
import { useEncryptionStore } from '../../stores/encryptionStore'

export interface HiddenSectionHandle {
  applyScroll: (scrollTop: number, sectionHeight: number, index: number) => void
}

interface Props {
  entry: HiddenTimelineEntry
  index: number
}

// Grain noise as a data-URI SVG (turbulence filter)
const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`

const HiddenMemorySection = forwardRef<HiddenSectionHandle, Props>(function HiddenMemorySection(
  { entry },
  ref
) {
  const photoLayerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [displayUrl, setDisplayUrl] = useState<string | null>(null)

  const { getOrDecrypt } = useTimelineStore()
  const { sharedKey, privateJournalKey } = useEncryptionStore()

  const photoKeys = entry.photo_urls ?? []

  useEffect(() => {
    const key = photoKeys[0]
    if (!key) return
    const encKey = sharedKey ?? privateJournalKey
    if (!encKey) return
    let cancelled = false
    getOrDecrypt(key, encKey).then((url) => {
      if (!cancelled) setDisplayUrl(url)
    })
    return () => { cancelled = true }
  }, [photoKeys, sharedKey, privateJournalKey, getOrDecrypt])

  // Identical scale formula to main timeline
  useImperativeHandle(ref, () => ({
    applyScroll(scrollTop: number, sectionHeight: number, index: number) {
      const raw = (scrollTop - index * sectionHeight) / sectionHeight
      const clamped = Math.max(-1, Math.min(1, raw))

      let scale: number
      if (clamped < 0) {
        scale = 0.72 + (1 + clamped) * 0.28
      } else {
        scale = 1.0 + clamped * 0.22
      }

      if (photoLayerRef.current) {
        photoLayerRef.current.style.transform = `scale3d(${scale},${scale},1)`
      }

      if (contentRef.current) {
        if (clamped <= 0) {
          contentRef.current.style.transform = 'translateY(0px)'
          contentRef.current.style.opacity = '1'
        } else {
          contentRef.current.style.transform = `translateY(${clamped * -28}px)`
          contentRef.current.style.opacity = String(Math.max(0, 1 - clamped * 2.6))
        }
      }
    },
  }))

  return (
    <div
      style={{
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        scrollSnapAlign: 'start',
        scrollSnapStop: 'always',
        background: '#0a0a0f',
        fontFamily: "'Noto Sans Tamil', sans-serif",
      }}
    >
      {/* Photo layer with desaturation */}
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
          filter: 'saturate(0.88)',
        }}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : photoKeys.length > 0 ? (
          <div style={{ width: '100%', height: '100%', background: '#151520' }} />
        ) : (
          // No photo — subtle textured bg
          <div style={{
            width: '100%', height: '100%',
            background: 'radial-gradient(ellipse at 40% 40%, rgba(90,80,130,0.25) 0%, #0a0a0f 70%)',
          }} />
        )}
      </div>

      {/* Grain overlay — static div, pointer-events none */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          backgroundImage: GRAIN_SVG,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
          opacity: 0.045,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Stronger vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 3,
          pointerEvents: 'none',
          background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* Content */}
      <div
        ref={contentRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '32px 24px 68px',
          zIndex: 4,
          willChange: 'transform, opacity',
        }}
      >
        {/* "What if" badge */}
        <div style={{ marginBottom: 10 }}>
          <span style={{
            display: 'inline-block',
            background: 'rgba(180,180,210,0.2)',
            border: '0.5px solid rgba(180,180,210,0.4)',
            color: 'rgba(210,210,235,0.9)',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            what if
          </span>
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: 22,
          fontWeight: 500,
          color: 'rgba(235,235,245,0.92)',
          lineHeight: 1.2,
          margin: '0 0 6px',
          letterSpacing: '-0.01em',
        }}>
          {entry.title}
        </h2>

        {/* Approximate date */}
        <p style={{ fontSize: 11, color: 'rgba(235,235,245,0.35)', margin: '0 0 10px' }}>
          {entry.approximate_date}
        </p>

        {/* Scenario */}
        {entry.scenario && (
          <p style={{
            fontSize: 13,
            color: 'rgba(235,235,245,0.72)',
            lineHeight: 1.6,
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {entry.scenario}
          </p>
        )}
      </div>
    </div>
  )
})

export default HiddenMemorySection
