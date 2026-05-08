import { motion } from 'framer-motion'
import { X } from 'lucide-react'

export default function HowToGenerateModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[600] flex items-center justify-center p-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <motion.div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 380,
          background: '#12121a',
          borderRadius: 20,
          padding: '24px 22px 28px',
          border: '1px solid rgba(255,255,255,0.08)',
          fontFamily: "'Noto Sans Tamil', sans-serif",
        }}
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.35)', padding: 4,
          }}
        >
          <X size={16} />
        </button>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(235,235,245,0.9)', margin: '0 0 14px' }}>
          Creating a hidden memory
        </h3>

        <p style={{ fontSize: 13, color: 'rgba(235,235,245,0.55)', lineHeight: 1.65, margin: '0 0 14px' }}>
          Use ChatGPT image generation or Midjourney. Describe a scene at a Singapore location — Orchard Road,
          Sentosa, Changi, a hawker centre — and the approximate year.
        </p>

        <p style={{ fontSize: 13, color: 'rgba(235,235,245,0.55)', lineHeight: 1.65, margin: '0 0 20px' }}>
          For best results, use portrait ratio (9:16) and ask for a candid, realistic street photography style
          with film grain. Then upload the result here.
        </p>

        <div style={{
          background: 'rgba(180,180,210,0.08)',
          border: '1px solid rgba(180,180,210,0.2)',
          borderRadius: 12,
          padding: '12px 14px',
        }}>
          <p style={{ fontSize: 12, color: 'rgba(210,210,235,0.6)', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
            "Candid street photo of a young woman walking alone on Orchard Road, Singapore, 2019.
            Film grain, slightly overcast day, portrait orientation, realistic."
          </p>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: 20,
            padding: '11px', borderRadius: 12,
            background: 'rgba(180,180,210,0.15)',
            border: '1px solid rgba(180,180,210,0.3)',
            color: 'rgba(210,210,235,0.8)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            fontFamily: "'Noto Sans Tamil', sans-serif",
          }}
        >
          Got it
        </button>
      </motion.div>
    </motion.div>
  )
}
