import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Lock, Unlock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useEncryptionStore } from '../../stores/encryptionStore'
import { encryptShared, decryptShared } from '../../lib/encryption'
import type { TimeCapsule as TimeCapsuleType } from '../../types'
import { format, parseISO, isPast } from 'date-fns'

export default function TimeCapsule() {
  const navigate = useNavigate()
  const { user, partner } = useAuthStore()
  const { sharedKey } = useEncryptionStore()
  const [capsules, setCapsules] = useState<TimeCapsuleType[]>([])
  const [showNew, setShowNew] = useState(false)
  const [message, setMessage] = useState('')
  const [unlockDate, setUnlockDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [opened, setOpened] = useState<TimeCapsuleType | null>(null)

  const load = async () => {
    if (!user || !partner) return
    const { data } = await supabase
      .from('time_capsules')
      .select('*')
      .or(`created_by.eq.${user.id},created_by.eq.${partner.id}`)
      .order('created_at', { ascending: false })
    setCapsules(data ?? [])
  }

  useEffect(() => { load() }, [user, partner])

  const save = async () => {
    if (!message.trim() || !unlockDate || !sharedKey || !user) return
    setSaving(true)
    const { encrypted, nonce } = encryptShared(message.trim(), sharedKey)
    await supabase.from('time_capsules').insert({
      created_by: user.id,
      encrypted_content: encrypted,
      nonce,
      unlock_date: unlockDate,
    })
    setSaving(false)
    setShowNew(false)
    setMessage(''); setUnlockDate('')
    load()
  }

  const openCapsule = (capsule: TimeCapsuleType) => {
    if (!sharedKey) return
    const content = decryptShared(capsule.encrypted_content, capsule.nonce, sharedKey) ?? '🔒'
    setOpened({ ...capsule, content })
  }

  const canOpen = (c: TimeCapsuleType) => isPast(parseISO(c.unlock_date))

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-gray-950 safe-top">
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/more')} className="text-gray-400 p-1"><ArrowLeft size={22} /></button>
          <h1 className="flex-1 text-xl font-bold text-gray-900 dark:text-white">Time Capsule</h1>
          <button onClick={() => setShowNew(true)} className="w-10 h-10 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-md">
            <Plus size={20} />
          </button>
        </div>

        {showNew && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4 mb-5 space-y-3"
          >
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">A message for future us 💌</p>
            <textarea
              className="input-field resize-none"
              rows={4}
              placeholder="Dear future us..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Unlock on</label>
              <input
                type="date"
                className="input-field"
                value={unlockDate}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setUnlockDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNew(false)} className="flex-1 btn-ghost text-sm">Cancel</button>
              <button onClick={save} disabled={saving || !message.trim() || !unlockDate} className="flex-1 btn-primary text-sm py-2.5">
                {saving ? '...' : 'Seal it 🔒'}
              </button>
            </div>
          </motion.div>
        )}

        <div className="space-y-3">
          {capsules.map((c) => {
            const unlocked = canOpen(c)
            return (
              <motion.button
                key={c.id}
                onClick={() => unlocked ? openCapsule(c) : undefined}
                className={`w-full card p-4 text-left transition-shadow ${unlocked ? 'hover:shadow-md cursor-pointer' : 'opacity-75 cursor-default'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-none ${unlocked ? 'bg-amber-100' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    {unlocked ? <Unlock size={22} className="text-amber-500" /> : <Lock size={22} className="text-gray-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                      {c.created_by === user?.id ? 'Your capsule' : `From ${partner?.display_name?.split(' ')[0]}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {unlocked
                        ? '✨ Tap to open!'
                        : `Unlocks ${format(parseISO(c.unlock_date), 'MMMM d, yyyy')}`}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">{format(parseISO(c.created_at), 'MMM d, yy')}</p>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Opened capsule */}
      <AnimatePresence>
        {opened && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpened(null)} />
            <motion.div
              className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-10 shadow-2xl"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <div className="text-center mb-5">
                <span className="text-4xl">💌</span>
                <h3 className="font-bold text-gray-900 dark:text-white mt-2">Time Capsule opened!</h3>
                <p className="text-xs text-gray-400 mt-1">
                  From {format(parseISO(opened.created_at), 'MMMM d, yyyy')}
                </p>
              </div>
              <div className="bg-cream-50 dark:bg-gray-800 rounded-2xl p-4">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm whitespace-pre-wrap">
                  {opened.content}
                </p>
              </div>
              <button onClick={() => setOpened(null)} className="btn-ghost w-full mt-4 text-sm">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
