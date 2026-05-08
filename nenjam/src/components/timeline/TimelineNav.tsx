import { memo } from 'react'

interface Props {
  count: number
  activeIndex: number
  onDotClick: (index: number) => void
}

// Navigation dots — CSS transitions only, never scroll-driven
const TimelineNav = memo(function TimelineNav({ count, activeIndex, onDotClick }: Props) {
  if (count === 0) return null

  // Collapse to a short scrollable strip if there are many entries
  const maxVisible = 12
  const dots = count <= maxVisible
    ? Array.from({ length: count }, (_, i) => i)
    : computeVisibleDots(count, activeIndex, maxVisible)

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      {dots.map((i) => (
        <button
          key={i}
          onClick={() => onDotClick(i)}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            pointerEvents: 'auto',
            background: i === activeIndex ? 'white' : 'rgba(255,255,255,0.32)',
            transform: i === activeIndex ? 'scale(1.4)' : 'scale(1)',
            transition: 'background 0.25s ease, transform 0.25s ease',
          }}
          aria-label={`Go to memory ${i + 1}`}
        />
      ))}
    </div>
  )
})

// When there are more dots than maxVisible, show a window around the active index
function computeVisibleDots(count: number, active: number, max: number): number[] {
  const half = Math.floor(max / 2)
  let start = Math.max(0, active - half)
  const end = Math.min(count - 1, start + max - 1)
  start = Math.max(0, end - max + 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export default TimelineNav
