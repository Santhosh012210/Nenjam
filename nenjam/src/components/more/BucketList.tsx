import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, CheckSquare, Square, Trash2, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import type { BucketListItem } from '../../types'
import { format } from 'date-fns'

export default function BucketList() {
  const navigate = useNavigate()
  const { user, partner } = useAuthStore()
  const [items, setItems] = useState<BucketListItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const filter = useState<'all' | 'done' | 'todo'>('all')
  const [activeFilter, setActiveFilter] = filter

  const load = async () => {
    if (!user || !partner) return
    const { data } = await supabase
      .from('bucket_list')
      .select('*')
      .or(`created_by.eq.${user.id},created_by.eq.${partner.id}`)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
  }

  useEffect(() => { load() }, [user, partner])

  const add = async () => {
    if (!title.trim() || !user) return
    setSaving(true)
    await supabase.from('bucket_list').insert({
      created_by: user.id,
      title: title.trim(),
      description: desc.trim() || null,
    })
    setSaving(false)
    setShowAdd(false)
    setTitle(''); setDesc('')
    load()
  }

  const toggle = async (item: BucketListItem) => {
    const done = !item.is_completed
    await supabase.from('bucket_list').update({
      is_completed: done,
      completed_at: done ? new Date().toISOString() : null,
    }).eq('id', item.id)
    load()
  }

  const remove = async (id: string) => {
    await supabase.from('bucket_list').delete().eq('id', id)
    setItems((v) => v.filter((i) => i.id !== id))
  }

  const filtered = items.filter((i) => {
    if (activeFilter === 'done') return i.is_completed
    if (activeFilter === 'todo') return !i.is_completed
    return true
  })

  const doneCount = items.filter((i) => i.is_completed).length

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-gray-950 safe-top">
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/more')} className="text-gray-400 p-1"><ArrowLeft size={22} /></button>
          <h1 className="flex-1 text-xl font-bold text-gray-900 dark:text-white">Bucket List</h1>
          <button onClick={() => setShowAdd(true)} className="w-10 h-10 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-md">
            <Plus size={20} />
          </button>
        </div>

        {/* Progress */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {doneCount}/{items.length} done
            </p>
            <p className="text-xs text-rose-500">{items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0}%</p>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${items.length > 0 ? (doneCount / items.length) * 100 : 0}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          {(['all', 'todo', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
                activeFilter === f
                  ? 'bg-rose-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}
            >
              {f === 'all' ? 'All' : f === 'todo' ? 'To do' : 'Done ✓'}
            </button>
          ))}
        </div>

        {showAdd && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4 mb-4 space-y-3"
          >
            <input className="input-field" placeholder="What do you want to do together?" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <input className="input-field" placeholder="Details (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 btn-ghost text-sm">Cancel</button>
              <button onClick={add} disabled={saving || !title.trim()} className="flex-1 btn-primary text-sm py-2.5">
                {saving ? '...' : 'Add ✨'}
              </button>
            </div>
          </motion.div>
        )}

        <div className="space-y-2">
          {filtered.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`card p-4 flex items-start gap-3 ${item.is_completed ? 'opacity-60' : ''}`}
            >
              <button onClick={() => toggle(item)} className="mt-0.5 flex-none">
                {item.is_completed
                  ? <CheckSquare size={20} className="text-green-500" />
                  : <Square size={20} className="text-gray-300" />
                }
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm text-gray-900 dark:text-white ${item.is_completed ? 'line-through' : ''}`}>
                  {item.title}
                </p>
                {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
                {item.completed_at && (
                  <p className="text-xs text-green-500 mt-1">✓ {format(new Date(item.completed_at), 'MMM d, yyyy')}</p>
                )}
              </div>
              {item.created_by === user?.id && (
                <button onClick={() => remove(item.id)} className="text-gray-200 hover:text-red-400 p-1 flex-none">
                  <Trash2 size={14} />
                </button>
              )}
            </motion.div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <CheckSquare size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm">Nothing here yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
