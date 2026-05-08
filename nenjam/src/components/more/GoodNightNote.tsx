import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Moon, Send, Heart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useEncryptionStore } from '../../stores/encryptionStore'
import { encryptShared, decryptShared } from '../../lib/encryption'
import type { GoodNightNote as GoodNightNoteType } from '../../types'
import { format } from 'date-fns'

export default function GoodNightNote() {
  const navigate = useNavigate()
  const { user, partner } = useAuthStore()
  const { sharedKey } = useEncryptionStore()
  const [myNote, setMyNote] = useState<GoodNightNoteType | null>(null)
  const [partnerNote, setPartnerNote] = useState<GoodNightNoteType | null>(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')

  const decrypt = (note: GoodNightNoteType): GoodNightNoteType => {
    if (!sharedKey) return note
    return { ...note, content: decryptShared(note.encrypted_content, note.nonce, sharedKey) ?? '🔒' }
  }

  const load = async () => {
    if (!user || !partner) return
    const { data } = await supabase
      .from('goodnight_notes')
      .select('*')
      .or(`sender_id.eq.${user.id},sender_id.eq.${partner.id}`)
      .eq('sent_date', today)

    setMyNote(data?.find((n) => n.sender_id === user.id) ?? null)
    const pNote = data?.find((n) => n.sender_id === partner.id)
    if (pNote) setPartnerNote(decrypt(pNote))

    // Mark partner's note as read
    if (pNote && !pNote.is_read) {
      await supabase.from('goodnight_notes').update({ is_read: true }).eq('id', pNote.id)
    }
  }

  useEffect(() => { load() }, [user, partner])

  const send = async () => {
    if (!text.trim() || !sharedKey || !user || !partner) return
    setSaving(true)
    const { encrypted, nonce } = encryptShared(text.trim(), sharedKey)
    const { data } = await supabase
      .from('goodnight_notes')
      .upsert({
        sender_id: user.id,
        encrypted_content: encrypted,
        nonce,
        sent_date: today,
        is_read: false,
      })
      .select()
      .single()
    setMyNote(data)
    setText('')
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 to-indigo-950 safe-top">
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/more')} className="text-indigo-400 p-1"><ArrowLeft size={22} /></button>
          <h1 className="flex-1 text-xl font-bold text-white">Good Night</h1>
          <Moon size={22} className="text-indigo-300" />
        </div>

        {/* Stars decoration */}
        <div className="text-center mb-6">
          <p className="text-4xl mb-2">🌙</p>
          <p className="text-indigo-300 text-sm">
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>

        {/* Partner's note for you */}
        <AnimatePresence>
          {partnerNote && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-indigo-800/50 border border-indigo-700/50 rounded-3xl p-5 mb-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Heart size={14} className="text-pink-400" fill="currentColor" />
                <p className="text-sm text-indigo-300 font-medium">
                  {partner?.display_name?.split(' ')[0]} sent you a good night note
                </p>
              </div>
              <p className="text-white leading-relaxed">
                {partnerNote.content}
              </p>
              <p className="text-xs text-indigo-400 mt-3">
                {format(new Date(partnerNote.created_at), 'h:mm a')} 🌸
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* My note */}
        {myNote ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 rounded-3xl p-5 mb-4"
          >
            <p className="text-xs text-indigo-300 mb-2">Your note sent ✓</p>
            <p className="text-white text-sm leading-relaxed">
              Encrypted and delivered 💕
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <textarea
              className="w-full bg-white/10 border border-indigo-600/50 rounded-2xl px-4 py-3 text-white placeholder-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none text-sm leading-relaxed"
              rows={5}
              placeholder={`Good night ${partner?.display_name?.split(' ')[0] ?? ''}... 🌙`}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={send}
              disabled={saving || !text.trim()}
              className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:bg-indigo-800 text-white font-medium rounded-2xl py-3.5 flex items-center justify-center gap-2 transition-colors"
            >
              <Moon size={18} />
              {saving ? 'Sending...' : 'Send good night note'}
            </motion.button>
          </div>
        )}

        {!partnerNote && !myNote && (
          <p className="text-center text-indigo-400 text-xs mt-6">
            Notes from {partner?.display_name?.split(' ')[0] ?? 'your partner'} will appear here 🌟
          </p>
        )}
      </div>
    </div>
  )
}
