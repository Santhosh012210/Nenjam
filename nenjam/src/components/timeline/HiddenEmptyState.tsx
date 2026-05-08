import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import HowToGenerateModal from './HowToGenerateModal'

export default function HiddenEmptyState({ onAdd }: { onAdd: () => void }) {
  const [showHow, setShowHow] = useState(false)

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: '#0a0a0f',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 40px',
          fontFamily: "'Noto Sans Tamil', sans-serif",
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 300, color: 'rgba(235,235,245,0.75)', marginBottom: 10 }}>
          No crossed paths yet.
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: 32 }}>
          Generate a moment with an AI tool and upload it here.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <button
            onClick={onAdd}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(180,180,210,0.15)',
              border: '1px solid rgba(180,180,210,0.3)',
              color: 'rgba(210,210,235,0.85)',
              borderRadius: 24, padding: '11px 22px',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              fontFamily: "'Noto Sans Tamil', sans-serif",
            }}
          >
            <Plus size={16} />
            Add a hidden memory
          </button>

          <button
            onClick={() => setShowHow(true)}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(180,180,210,0.5)',
              fontSize: 13, cursor: 'pointer',
              fontFamily: "'Noto Sans Tamil', sans-serif",
              textDecoration: 'underline',
              textDecorationColor: 'rgba(180,180,210,0.25)',
            }}
          >
            How to generate photos →
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showHow && <HowToGenerateModal onClose={() => setShowHow(false)} />}
      </AnimatePresence>
    </>
  )
}
