import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Calendar, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import type { KeyDate } from '../../types'
import { format, parseISO, differenceInDays, isFuture } from 'date-fns'

function daysUntil(dateStr: string): number {
  const now = new Date()
  const target = parseISO(dateStr)
  // Use this year's occurrence
  const thisYear = new Date(now.getFullYear(), target.getMonth(), target.getDate())
  if (thisYear < now) thisYear.setFullYear(now.getFullYear() + 1)
  return differenceInDays(thisYear, now)
}

export default function KeyDates() {
  const navigate = useNavigate()
  const { user, partner } = useAuthStore()
  const [dates, setDates] = useState<KeyDate[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState<KeyDate['type']>('anniversary')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!user || !partner) return
    const { data } = await supabase
      .from('key_dates')
      .select('*')
      .or(`user_id.eq.${user.id},user_id.eq.${partner.id}`)
      .order('date')
    setDates(data ?? [])
  }

  useEffect(() => { load() }, [user, partner])

  const save = async () => {
    if (!title.trim() || !date || !user) return
    setSaving(true)
    await supabase.from('key_dates').insert({ user_id: user.id, title: title.trim(), date, type })
    setSaving(false)
    setShowAdd(false)
    setTitle(''); setDate('')
    load()
  }

  const remove = async (id: string) => {
    await supabase.from('key_dates').delete().eq('id', id)
    setDates((d) => d.filter((x) => x.id !== id))
  }

  const TYPE_ICONS: Record<KeyDate['type'], string> = {
    anniversary: '💍',
    birthday: '🎂',
    custom: '⭐',
  }

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-gray-950 safe-top">
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/more')} className="text-gray-400 p-1"><ArrowLeft size={22} /></button>
          <h1 className="flex-1 text-xl font-bold text-gray-900 dark:text-white">Key Dates</h1>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="w-10 h-10 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-md"
          >
            <Plus size={20} />
          </button>
        </div>

        {showAdd && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4 mb-4 space-y-3"
          >
            <input className="input-field" placeholder="What's this date?" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="flex gap-2">
              {(['anniversary', 'birthday', 'custom'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                    type === t ? 'bg-rose-500 text-white border-rose-500' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {TYPE_ICONS[t]} {t}
                </button>
              ))}
            </div>
            <button onClick={save} disabled={saving || !title.trim() || !date} className="btn-primary w-full text-sm py-2.5">
              {saving ? '...' : 'Save date'}
            </button>
          </motion.div>
        )}

        {dates.length === 0 ? (
          <div className="text-center py-16">
            <Calendar size={40} className="mx-auto text-rose-200 mb-3" />
            <p className="text-gray-500">No dates yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...dates]
              .sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
              .map((d) => {
                const days = daysUntil(d.date)
                return (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card p-4 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center text-2xl flex-none">
                      {TYPE_ICONS[d.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{d.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(parseISO(d.date), 'MMMM d')}
                      </p>
                    </div>
                    <div className="text-right flex-none">
                      {days === 0 ? (
                        <span className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded-lg">
                          Today! 🎉
                        </span>
                      ) : (
                        <>
                          <p className="text-xl font-bold text-rose-600">{days}</p>
                          <p className="text-[10px] text-gray-400">days away</p>
                        </>
                      )}
                    </div>
                    {d.user_id === user?.id && (
                      <button onClick={() => remove(d.id)} className="text-gray-300 hover:text-red-400 p-1">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </motion.div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
