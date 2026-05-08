import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { MOOD_OPTIONS } from '../../types'
import type { MoodCheckin as MoodCheckinType } from '../../types'
import { format } from 'date-fns'

export default function MoodCheckin() {
  const { user, partner } = useAuthStore()
  const [myCheckin, setMyCheckin] = useState<MoodCheckinType | null>(null)
  const [partnerCheckin, setPartnerCheckin] = useState<MoodCheckinType | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [selectedMood, setSelectedMood] = useState<string>('')
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const ids = [user.id, partner?.id].filter(Boolean)
      const { data } = await supabase
        .from('mood_checkins')
        .select('*')
        .in('user_id', ids as string[])
        .eq('check_date', today)
      setMyCheckin(data?.find((c) => c.user_id === user.id) ?? null)
      setPartnerCheckin(data?.find((c) => c.user_id === partner?.id) ?? null)
      setLoading(false)
    }
    load()
  }, [user, partner, today])

  const save = async () => {
    if (!selectedMood || !user) return
    setSaving(true)
    const { data } = await supabase
      .from('mood_checkins')
      .upsert({ user_id: user.id, mood: selectedMood, note: note || null, check_date: today })
      .select()
      .single()
    setMyCheckin(data)
    setSaving(false)
  }

  if (loading) return null

  return (
    <div className="card p-4">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <span>How are you feeling?</span>
        <span className="text-xs text-gray-400 font-normal">Today</span>
      </h3>

      {!myCheckin ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {MOOD_OPTIONS.map(({ emoji, label }) => (
              <motion.button
                key={emoji}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSelectedMood(emoji)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border transition-all ${
                  selectedMood === emoji
                    ? 'bg-rose-500 border-rose-500 text-white'
                    : 'bg-cream-50 border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                }`}
              >
                <span className="text-base">{emoji}</span>
                <span className="text-xs">{label}</span>
              </motion.button>
            ))}
          </div>
          {selectedMood && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              <input
                className="input-field text-sm"
                placeholder="Add a little note... (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button onClick={save} disabled={saving} className="btn-primary w-full text-sm py-2.5">
                {saving ? 'Saving...' : 'Share my mood'}
              </button>
            </motion.div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl p-3">
            <span className="text-2xl">{myCheckin.mood}</span>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">You're feeling {myCheckin.mood}</p>
              {myCheckin.note && <p className="text-xs text-gray-500 mt-0.5">{myCheckin.note}</p>}
            </div>
          </div>
          {partnerCheckin ? (
            <div className="flex items-center gap-3 bg-pink-50 dark:bg-pink-900/20 rounded-xl p-3">
              <span className="text-2xl">{partnerCheckin.mood}</span>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {partner?.display_name?.split(' ')[0]} feels {partnerCheckin.mood}
                </p>
                {partnerCheckin.note && <p className="text-xs text-gray-500 mt-0.5">{partnerCheckin.note}</p>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-1">
              Waiting for {partner?.display_name?.split(' ')[0]}'s check-in... 💕
            </p>
          )}
        </div>
      )}
    </div>
  )
}
