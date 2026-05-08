import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import HiddenTimeline from './HiddenTimeline'

type Phase = 'overlay' | 'text' | 'timeline'

interface Props {
  onClose: () => void
}

export default function HiddenReveal({ onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('overlay')

  useEffect(() => {
    // Phase 1 → 2: show text after overlay fades in (0.4s)
    const t1 = setTimeout(() => setPhase('text'), 400)
    // Phase 2 → 3: fade text out after 2.2s total, slide timeline up
    const t2 = setTimeout(() => setPhase('timeline'), 2200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <motion.div
      style={{ position: 'fixed', inset: 0, zIndex: 100 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* Black overlay — always present during reveal */}
      <div style={{ position: 'absolute', inset: 0, background: '#000' }} />

      {/* "What could have been" text — fades in, then out */}
      <AnimatePresence>
        {phase === 'text' && (
          <motion.div
            key="reveal-text"
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '0 48px',
              fontFamily: "'Noto Sans Tamil', sans-serif",
              zIndex: 1,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p style={{
              fontSize: 24, fontWeight: 300,
              color: 'rgba(255,255,255,0.92)',
              margin: 0, letterSpacing: '-0.01em', lineHeight: 1.2,
            }}>
              What could have been
            </p>
            <p style={{
              fontSize: 13, color: 'rgba(255,255,255,0.38)',
              margin: '10px 0 0', lineHeight: 1.5,
            }}>
              Moments where your paths almost crossed
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden Timeline slides up from below */}
      <AnimatePresence>
        {phase === 'timeline' && (
          <motion.div
            key="hidden-timeline"
            style={{ position: 'absolute', inset: 0, zIndex: 2 }}
            initial={{ y: '100vh' }}
            animate={{ y: 0 }}
            exit={{ y: '100vh' }}
            transition={{ type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.7 }}
          >
            <HiddenTimeline onClose={onClose} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
