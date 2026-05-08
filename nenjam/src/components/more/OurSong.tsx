import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Music, Plus, Trash2, Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useAppStore } from '../../stores/appStore'
import type { TamilSong } from '../../types'

const DEFAULT_SONGS: Omit<TamilSong, 'id' | 'added_by' | 'created_at'>[] = [
  { title: 'Vaseegara', artist: 'Bombay Jayashri', youtube_url: 'https://www.youtube.com/watch?v=JqnO9sPsVn0', file_url: null },
  { title: 'Munbe Vaa', artist: 'A.R. Rahman', youtube_url: 'https://www.youtube.com/watch?v=F1hFb0l5_GE', file_url: null },
  { title: 'Ennodu Nee Irundhaal', artist: 'A.R. Rahman', youtube_url: 'https://www.youtube.com/watch?v=E6t7U4LAkN8', file_url: null },
  { title: 'Kadhal Sadugudu', artist: 'A.R. Rahman', youtube_url: 'https://www.youtube.com/watch?v=OuvqDjvF_ks', file_url: null },
  { title: 'Unna Nenachu', artist: 'Harris Jayaraj', youtube_url: 'https://www.youtube.com/watch?v=_Jf1KkKBvt8', file_url: null },
  { title: 'Snegithane', artist: 'A.R. Rahman', youtube_url: 'https://www.youtube.com/watch?v=7P2YVp8dNZo', file_url: null },
]

export default function OurSong() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { ourSongUrl, setOurSong } = useAppStore()
  const [songs, setSongs] = useState<TamilSong[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [adding, setAdding] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('tamil_songs').select('*').order('created_at')
    if (!data || data.length === 0) {
      // Seed defaults on first load
      for (const s of DEFAULT_SONGS) {
        await supabase.from('tamil_songs').insert({ ...s, added_by: user?.id })
      }
      const { data: fresh } = await supabase.from('tamil_songs').select('*').order('created_at')
      setSongs(fresh ?? [])
    } else {
      setSongs(data)
    }
  }

  useEffect(() => { load() }, [])

  const setAsOurSong = (url: string) => {
    if (user) setOurSong(user.id, url)
  }

  const addSong = async () => {
    if (!newTitle.trim() || !newUrl.trim() || !user) return
    setAdding(true)
    await supabase.from('tamil_songs').insert({
      title: newTitle.trim(),
      youtube_url: newUrl.trim(),
      added_by: user.id,
    })
    setNewTitle(''); setNewUrl('')
    setAdding(false)
    load()
  }

  const remove = async (id: string) => {
    await supabase.from('tamil_songs').delete().eq('id', id)
    setSongs((s) => s.filter((x) => x.id !== id))
  }

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-gray-950 safe-top">
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/more')} className="text-gray-400 p-1"><ArrowLeft size={22} /></button>
          <h1 className="flex-1 text-xl font-bold text-gray-900 dark:text-white">Our Song &amp; Tamil Playlist</h1>
        </div>

        {ourSongUrl && (
          <div className="card p-4 mb-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
              <Music size={18} className="text-rose-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400">Currently playing on home</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{ourSongUrl}</p>
            </div>
          </div>
        )}

        {/* Add custom song */}
        <div className="card p-4 mb-5 space-y-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Plus size={16} /> Add a Tamil song
          </p>
          <input className="input-field" placeholder="Song title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <input className="input-field" placeholder="YouTube URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          <button onClick={addSong} disabled={adding || !newTitle.trim() || !newUrl.trim()} className="btn-primary w-full text-sm py-2.5">
            {adding ? '...' : 'Add to playlist'}
          </button>
        </div>

        {/* Playlist */}
        <div className="space-y-2">
          {songs.map((song) => (
            <motion.div
              key={song.id}
              className="card p-4 flex items-center gap-3"
            >
              <div className="w-9 h-9 bg-rose-100 dark:bg-rose-900/20 rounded-xl flex items-center justify-center flex-none">
                <Music size={16} className="text-rose-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{song.title}</p>
                {song.artist && <p className="text-xs text-gray-400">{song.artist}</p>}
              </div>
              <div className="flex gap-2 flex-none">
                {song.youtube_url && (
                  <button
                    onClick={() => setAsOurSong(song.youtube_url!)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                      ourSongUrl === song.youtube_url
                        ? 'bg-rose-500 text-white'
                        : 'bg-rose-50 dark:bg-rose-900/20 text-rose-500'
                    }`}
                  >
                    <Play size={14} fill="currentColor" />
                  </button>
                )}
                <button onClick={() => remove(song.id)} className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-300 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
