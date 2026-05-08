import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, StickyNote, Save, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useEncryptionStore } from '../../stores/encryptionStore'
import { encryptShared, decryptShared } from '../../lib/encryption'
import type { SharedNote } from '../../types'
import { format } from 'date-fns'

export default function SharedNotes() {
  const navigate = useNavigate()
  const { user, partner } = useAuthStore()
  const { sharedKey } = useEncryptionStore()
  const [notes, setNotes] = useState<SharedNote[]>([])
  const [editing, setEditing] = useState<SharedNote | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const decrypt = (note: SharedNote): SharedNote => {
    if (!sharedKey) return note
    const content = decryptShared(note.encrypted_content, note.nonce, sharedKey) ?? '🔒'
    return { ...note, content }
  }

  const load = async () => {
    const { data } = await supabase
      .from('shared_notes')
      .select('*')
      .order('updated_at', { ascending: false })
    setNotes((data ?? []).map(decrypt))
  }

  useEffect(() => { load() }, [sharedKey])

  const openEdit = (note: SharedNote) => {
    setEditing(note)
    setEditTitle(note.title)
    setEditContent(note.content ?? '')
  }

  const saveNote = async (isNew = false) => {
    if (!sharedKey || !user) return
    setSaving(true)
    const { encrypted, nonce } = encryptShared(editContent, sharedKey)
    if (isNew) {
      await supabase.from('shared_notes').insert({
        title: editTitle.trim() || 'Untitled',
        encrypted_content: encrypted,
        nonce,
        last_edited_by: user.id,
        updated_at: new Date().toISOString(),
      })
    } else if (editing) {
      await supabase.from('shared_notes').update({
        title: editTitle.trim() || 'Untitled',
        encrypted_content: encrypted,
        nonce,
        last_edited_by: user.id,
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id)
    }
    setSaving(false)
    setEditing(null)
    setShowNew(false)
    setEditTitle(''); setEditContent('')
    load()
  }

  const openNew = () => {
    setEditing(null)
    setEditTitle('')
    setEditContent('')
    setShowNew(true)
  }

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-gray-950 safe-top">
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/more')} className="text-gray-400 p-1"><ArrowLeft size={22} /></button>
          <h1 className="flex-1 text-xl font-bold text-gray-900 dark:text-white">Shared Notes</h1>
          <button onClick={openNew} className="w-10 h-10 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-md">
            <Plus size={20} />
          </button>
        </div>

        {notes.length === 0 ? (
          <div className="text-center py-16">
            <StickyNote size={40} className="mx-auto text-rose-200 mb-3" />
            <p className="text-gray-500">No shared notes yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <motion.button
                key={note.id}
                onClick={() => openEdit(note)}
                className="w-full card p-4 text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{note.title}</p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{note.content?.slice(0, 80)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-none text-gray-400">
                    <Pencil size={12} />
                    <span className="text-[10px]">{format(new Date(note.updated_at), 'MMM d')}</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Edit/Create modal */}
      <AnimatePresence>
        {(editing || showNew) && (
          <motion.div
            className="fixed inset-0 z-50 bg-cream-50 dark:bg-gray-950 flex flex-col safe-top"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-rose-100 dark:border-gray-800">
              <button onClick={() => { setEditing(null); setShowNew(false) }} className="text-gray-400 p-1"><ArrowLeft size={22} /></button>
              <button onClick={() => saveNote(showNew)} disabled={saving} className="btn-primary py-2 px-5 text-sm flex items-center gap-1.5">
                <Save size={14} /> {saving ? '...' : 'Save'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-3">
              <input
                className="w-full text-xl font-bold bg-transparent text-gray-900 dark:text-white placeholder-gray-300 focus:outline-none"
                placeholder="Note title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus={showNew}
              />
              <textarea
                className="w-full bg-transparent text-gray-700 dark:text-gray-300 placeholder-gray-300 focus:outline-none resize-none text-sm leading-relaxed"
                rows={24}
                placeholder="Write something together... both of you can edit this. 💕"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
