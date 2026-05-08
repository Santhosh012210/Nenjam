import { useEffect, useRef } from 'react'
import { Plus } from 'lucide-react'

export default function EmptyTimeline({ onAdd }: { onAdd: () => void }) {
  const lineRef = useRef<SVGLineElement>(null)
  const heartRef = useRef<SVGPathElement>(null)
  const circleRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    // Trigger the stroke-dashoffset animation after mount
    const t = setTimeout(() => {
      if (lineRef.current) lineRef.current.style.strokeDashoffset = '0'
      setTimeout(() => {
        if (heartRef.current) {
          heartRef.current.style.strokeDashoffset = '0'
          heartRef.current.style.opacity = '1'
        }
        if (circleRef.current) {
          circleRef.current.style.opacity = '1'
          circleRef.current.style.transform = 'scale(1)'
        }
      }, 1200)
    }, 300)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        height: '100vh',
        background: '#0d0008',
        fontFamily: "'Noto Sans Tamil', sans-serif",
      }}
    >
      {/* Animated SVG */}
      <svg width="80" height="160" viewBox="0 0 80 160" fill="none" style={{ marginBottom: 32 }}>
        {/* Vertical line drawing itself downward */}
        <line
          ref={lineRef}
          x1="40" y1="0" x2="40" y2="110"
          stroke="rgba(212,83,126,0.6)"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{
            strokeDasharray: 110,
            strokeDashoffset: 110,
            transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
        {/* Glow dot at the end of the line */}
        <circle
          ref={circleRef}
          cx="40" cy="110" r="3"
          fill="rgba(212,83,126,0.7)"
          style={{
            opacity: 0,
            transform: 'scale(0.4)',
            transformOrigin: '40px 110px',
            transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
        {/* Heart outline drawing itself */}
        <path
          ref={heartRef}
          d="M40 148 C40 148 18 133 18 118 C18 109 25 103 32 105 C36 106 39 109 40 111 C41 109 44 106 48 105 C55 103 62 109 62 118 C62 133 40 148 40 148Z"
          stroke="rgba(212,83,126,0.85)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{
            strokeDasharray: 120,
            strokeDashoffset: 120,
            opacity: 0,
            transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease',
          }}
        />
      </svg>

      <p
        style={{
          fontSize: 20,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.88)',
          marginBottom: 8,
          letterSpacing: '-0.01em',
        }}
      >
        Your story starts here.
      </p>
      <p
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.38)',
          marginBottom: 36,
        }}
      >
        Add your first moment together.
      </p>

      <button
        onClick={onAdd}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(212,83,126,0.18)',
          border: '1px solid rgba(212,83,126,0.45)',
          color: '#F4C0D1',
          borderRadius: 24,
          padding: '11px 24px',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: "'Noto Sans Tamil', sans-serif",
        }}
      >
        <Plus size={16} />
        Add your first moment
      </button>
    </div>
  )
}
