import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, BookOpen, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useEncryptionStore } from '../../stores/encryptionStore'
import { encryptPrivate, decryptPrivate } from '../../lib/encryption'
import type { JournalEntry } from '../../types'
import { format } from 'date-fns'

export default function Journal() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { privateJournalKey } = useEncryptionStore()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [selected, setSelected] = useState<JournalEntry | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadEntries = async () => {
    if (!user) return
    const { data } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setEntries(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadEntries() }, [user])

  const decrypt = (e: JournalEntry): JournalEntry => {
    if (!privateJournalKey) return e
    const content = decryptPrivate(e.encrypted_content, e.nonce, privateJournalKey) ?? '🔒'
    const [title, ...rest] = content.split('\n')
    return { ...e, content, title }
  }

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-gray-950 safe-top">
      <div className="max-w-md mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/more')} className="text-gray-400 p-1">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Private Journal</h1>
            <div className="flex items-center gap-1 mt-0.5">
              <Lock size={10} className="text-rose-400" />
              <span className="text-xs text-rose-400">Only you can read this</span>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowNew(true)}
            className="w-10 h-10 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-md shadow-rose-200"
          >
            <Plus size={20} />
          </motion.button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen size={40} className="mx-auto text-rose-200 mb-3" />
            <p className="text-gray-500 font-medium">Your journal is empty</p>
            <p className="text-sm text-gray-400 mt-1">Start writing — only you can read it.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const d = decrypt(entry)
              return (
                <motion.button
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelected(d)}
                  className="w-full card p-4 text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1">
                        {d.title ?? 'Untitled'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                        {d.content?.split('\n').slice(1).join(' ').slice(0, 80) ?? '...'}
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-none">
                      {format(new Date(entry.created_at), 'MMM d')}
                    </span>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>

      {/* View entry modal */}
      <AnimatePresence>
        {selected && (
          <EntryModal entry={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>

      {/* New entry modal */}
      <AnimatePresence>
        {showNew && (
          <NewEntryModal
            onClose={() => setShowNew(false)}
            onSaved={() => { setShowNew(false); loadEntries() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function EntryModal({ entry, onClose }: { entry: JournalEntry; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 bg-cream-50 dark:bg-gray-950 overflow-y-auto safe-top"
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
    >
      <div className="max-w-md mx-auto px-4 pt-4 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onClose} className="text-gray-400 p-1"><ArrowLeft size={22} /></button>
          <span className="text-sm text-gray-400">{format(new Date(entry.created_at), 'MMMM d, yyyy')}</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {entry.title ?? 'Untitled'}
        </h2>
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">
          {entry.content?.split('\n').slice(1).join('\n') ?? entry.content}
        </p>
      </div>
    </motion.div>
  )
}

function NewEntryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuthStore()
  const { privateJournalKey } = useEncryptionStore()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!user || !privateJournalKey || !title.trim()) return
    setSaving(true)
    const combined = `${title.trim()}\n${body.trim()}`
    const { encrypted, nonce } = encryptPrivate(combined, privateJournalKey)
    await supabase.from('journal_entries').insert({
      user_id: user.id,
      encrypted_content: encrypted,
      nonce,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-cream-50 dark:bg-gray-950 flex flex-col safe-top"
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-rose-100 dark:border-gray-800">
        <button onClick={onClose} className="text-gray-400 p-1"><ArrowLeft size={22} /></button>
        <button onClick={save} disabled={saving || !title.trim()} className="btn-primary py-2 px-5 text-sm">
          {saving ? '...' : 'Save'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-3">
        <input
          className="w-full text-2xl font-bold bg-transparent text-gray-900 dark:text-white placeholder-gray-300 focus:outline-none"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <textarea
          className="w-full bg-transparent text-gray-700 dark:text-gray-300 placeholder-gray-300 focus:outline-none resize-none text-sm leading-relaxed"
          rows={20}
          placeholder="Write freely... only you will ever read this. 🌸"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
    </motion.div>
  )
}
