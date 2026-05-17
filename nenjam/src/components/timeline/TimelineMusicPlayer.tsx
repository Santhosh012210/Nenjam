import { useState, useRef, useEffect, useCallback } from 'react'
import { Music, Plus, Trash2, X, Shuffle, Search, Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LrcLine { time: number; text: string }

interface Track {
  id: string
  name: string
  type: string
  searchArtist: string
  searchTitle: string
  manualLyrics: string
}
interface StoredTrack extends Track { buf: ArrayBuffer }

// ── IndexedDB ─────────────────────────────────────────────────────────────────

const DB_NAME = 'nenjam-player-v2'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('tracks'))
        req.result.createObjectStore('tracks', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror  = () => reject(req.error)
  })
}
async function dbGetAll(): Promise<StoredTrack[]> {
  const db = await openDB()
  return new Promise(r => {
    const req = db.transaction('tracks','readonly').objectStore('tracks').getAll()
    req.onsuccess = () => r(req.result ?? [])
    req.onerror   = () => r([])
  })
}
async function dbPut(t: StoredTrack): Promise<void> {
  const db = await openDB()
  return new Promise(r => {
    const tx = db.transaction('tracks','readwrite')
    tx.objectStore('tracks').put(t)
    tx.oncomplete = () => r()
    tx.onerror    = () => r()
  })
}
async function dbDelete(id: string): Promise<void> {
  const db = await openDB()
  return new Promise(r => {
    const tx = db.transaction('tracks','readwrite')
    tx.objectStore('tracks').delete(id)
    tx.oncomplete = () => r()
    tx.onerror    = () => r()
  })
}

// ── LRC helpers ───────────────────────────────────────────────────────────────

function parseLRC(lrc: string): LrcLine[] {
  return lrc.split('\n')
    .map(line => {
      const m = line.match(/\[(\d+):(\d+\.\d+)\](.*)/)
      if (!m) return null
      return { time: parseInt(m[1]) * 60 + parseFloat(m[2]), text: m[3].trim() }
    })
    .filter((l): l is LrcLine => l !== null && l.text.length > 0)
}

async function fetchLRC(artist: string, title: string): Promise<{ lines: LrcLine[]; source: string } | null> {
  try {
    const q = [artist, title].filter(Boolean).join(' ')
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`
    console.log('[LRCLIB] fetching:', url)
    const res = await fetch(url)
    console.log('[LRCLIB] status:', res.status)
    if (!res.ok) return null
    const results: any[] = await res.json()
    console.log('[LRCLIB] results:', results.length, results[0])
    if (!results.length) return null
    // Prefer a result with synced lyrics
    const match = results.find(r => r.syncedLyrics) ?? results.find(r => r.plainLyrics)
    if (!match) return null
    if (match.syncedLyrics) {
      return { lines: parseLRC(match.syncedLyrics), source: `${match.artistName} – ${match.trackName}` }
    }
    if (match.plainLyrics) {
      const lines = match.plainLyrics
        .split('\n').filter((l: string) => l.trim())
        .map((text: string, i: number) => ({ time: i * 4, text }))
      return { lines, source: `${match.artistName} – ${match.trackName} (plain)` }
    }
    return null
  } catch (e) {
    console.error('LRCLIB fetch failed:', e)
    return null
  }
}

// ── Misc ──────────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
function pickRandom(arr: Track[], excludeId?: string): Track | null {
  if (!arr.length) return null
  const pool = arr.length > 1 ? arr.filter(t => t.id !== excludeId) : arr
  return pool[Math.floor(Math.random() * pool.length)]
}
function parseFilename(name: string): { artist: string; title: string } {
  const parts = name.split(' - ')
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() }
  return { artist: '', title: name.trim() }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TimelineMusicPlayer() {
  const [playlist,    setPlaylist]    = useState<Track[]>([])
  const [currentId,   setCurrentId]   = useState<string | null>(null)
  const [playing,     setPlaying]     = useState(false)
  const [showPanel,   setShowPanel]   = useState(false)
  const [editTrack,   setEditTrack]   = useState<Track | null>(null)
  const [lrcLines,    setLrcLines]    = useState<LrcLine[]>([])
  const [activeIdx,   setActiveIdx]   = useState(-1)
  const [lyricsStatus, setLyricsStatus] = useState<'idle'|'fetching'|'found'|'notfound'>('idle')
  const [lyricsSource, setLyricsSource] = useState('')
  const [volume,      setVolume]      = useState(0.35)

  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const blobsRef    = useRef<Record<string, string>>({})
  const currentRef  = useRef<string | null>(null)
  const playlistRef = useRef<Track[]>([])

  useEffect(() => { currentRef.current  = currentId   }, [currentId])
  useEffect(() => { playlistRef.current = playlist    }, [playlist])

  // ── Load & autoplay on mount ───────────────────────────────────────────────
  useEffect(() => {
    dbGetAll().then(stored => {
      const tracks = stored.map(({ buf, ...t }) => t)
      setPlaylist(tracks)
      playlistRef.current = tracks
      stored.forEach(s => {
        blobsRef.current[s.id] ??= URL.createObjectURL(new Blob([s.buf], { type: s.type }))
      })
      const pick = pickRandom(tracks)
      if (pick) doPlay(pick, tracks)
    })
    return () => {
      audioRef.current?.pause()
      Object.values(blobsRef.current).forEach(URL.revokeObjectURL)
    }
  }, [])

  // ── Core play function ─────────────────────────────────────────────────────
  const doPlay = useCallback((track: Track, pl: Track[] = playlistRef.current) => {
    audioRef.current?.pause()
    setCurrentId(track.id)
    setLrcLines([])
    setActiveIdx(-1)

    const url = blobsRef.current[track.id]
    if (!url) return

    const audio = new Audio(url)
    audio.volume  = volume
    audio.loop    = false
    audioRef.current = audio

    // Sync lyrics on timeupdate — binary search for synced, ratio-based for plain
    audio.addEventListener('timeupdate', () => {
      setLrcLines(lines => {
        if (!lines.length) return lines
        const isSynced = lines.some(l => l.time > 0)
        if (isSynced) {
          let lo = 0, hi = lines.length - 1, best = -1
          while (lo <= hi) {
            const mid = (lo + hi) >> 1
            if (lines[mid].time <= audio.currentTime) { best = mid; lo = mid + 1 }
            else hi = mid - 1
          }
          setActiveIdx(best)
        } else {
          // Plain lyrics: distribute evenly across song duration
          const dur = audio.duration || 1
          const idx = Math.min(
            Math.floor((audio.currentTime / dur) * lines.length),
            lines.length - 1
          )
          setActiveIdx(idx)
        }
        return lines
      })
    })

    audio.onended = () => {
      const next = pickRandom(playlistRef.current, currentRef.current ?? undefined)
      if (next) doPlay(next)
      else setPlaying(false)
    }

    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))

    // Fetch LRC in background
    const artist = track.searchArtist
    const title  = track.searchTitle || track.name
    setLyricsStatus('fetching')
    setLyricsSource(`Searching: ${[artist, title].filter(Boolean).join(' – ')}`)
    fetchLRC(artist, title).then(result => {
      if (result) {
        setLrcLines(result.lines)
        setLyricsStatus('found')
        setLyricsSource(result.source)
      } else if (track.manualLyrics) {
        const lines = track.manualLyrics.split('\n').filter(l => l.trim()).map((text, i) => ({ time: i * 4, text }))
        setLrcLines(lines)
        setLyricsStatus('found')
        setLyricsSource('manual')
      } else {
        setLyricsStatus('notfound')
        setLyricsSource('No lyrics found — tap 🔍 to set artist/title')
      }
    })
  }, [volume])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // ── Add songs ──────────────────────────────────────────────────────────────
  const addSongs = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'audio/*'; input.multiple = true
    input.onchange = async () => {
      const files = Array.from(input.files ?? [])
      if (!files.length) return
      const newTracks: Track[] = []
      for (const file of files) {
        const id = uid()
        const rawName = file.name.replace(/\.[^/.]+$/, '')
        const { artist, title } = parseFilename(rawName)
        const track: Track = { id, name: rawName, type: file.type, searchArtist: artist, searchTitle: title, manualLyrics: '' }
        blobsRef.current[id] = URL.createObjectURL(file)
        await dbPut({ ...track, buf: await file.arrayBuffer() })
        newTracks.push(track)
      }
      setPlaylist(prev => {
        const next = [...prev, ...newTracks]
        playlistRef.current = next
        if (!currentRef.current) {
          const pick = pickRandom(newTracks)
          if (pick) doPlay(pick, next)
        }
        return next
      })
    }
    input.click()
  }, [doPlay])

  // ── Delete track ───────────────────────────────────────────────────────────
  const deleteTrack = useCallback(async (id: string) => {
    await dbDelete(id)
    URL.revokeObjectURL(blobsRef.current[id] ?? '')
    delete blobsRef.current[id]
    setPlaylist(prev => {
      const next = prev.filter(t => t.id !== id)
      playlistRef.current = next
      if (currentRef.current === id) {
        audioRef.current?.pause()
        const pick = pickRandom(next)
        if (pick) doPlay(pick, next)
        else { setCurrentId(null); setPlaying(false); setLrcLines([]) }
      }
      return next
    })
  }, [doPlay])

  // ── Save edits ─────────────────────────────────────────────────────────────
  const saveEdit = useCallback(async () => {
    if (!editTrack) return
    const stored = await dbGetAll()
    const rec = stored.find(s => s.id === editTrack.id)
    if (rec) await dbPut({ ...rec, ...editTrack })
    setPlaylist(prev => prev.map(t => t.id === editTrack.id ? editTrack : t))
    // Re-fetch lyrics if this is the current track
    if (currentRef.current === editTrack.id) {
      setLyricsStatus('fetching')
      fetchLRC(editTrack.searchArtist, editTrack.searchTitle || editTrack.name).then(result => {
        if (result) { setLrcLines(result.lines); setLyricsStatus('found'); setLyricsSource(result.source) }
        else if (editTrack.manualLyrics) {
          setLrcLines(editTrack.manualLyrics.split('\n').filter(l => l.trim()).map((text, i) => ({ time: i * 4, text })))
          setLyricsStatus('found'); setLyricsSource('manual')
        } else { setLrcLines([]); setLyricsStatus('notfound'); setLyricsSource('No lyrics found') }
      })
    }
    setEditTrack(null)
  }, [editTrack])

  const skipTrack = useCallback(() => {
    const pick = pickRandom(playlist, currentId ?? undefined)
    if (pick) doPlay(pick)
  }, [playlist, currentId, doPlay])

  const currentTrack = playlist.find(t => t.id === currentId)

  // Three lines to show: prev, active, next
  const prevLine   = activeIdx > 0            ? lrcLines[activeIdx - 1] : null
  const activeLine = activeIdx >= 0           ? lrcLines[activeIdx]     : null
  const nextLine   = activeIdx < lrcLines.length - 1 ? lrcLines[activeIdx + 1] : null

  return (
    <>
      {/* ── Lyrics overlay — shown when lines exist ───────────────────────── */}
      {playing && lrcLines.length > 0 && (
        <div style={{
          position: 'fixed', top: '38%', left: 0, right: 0, zIndex: 15,
          pointerEvents: 'none', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 10, padding: '0 28px',
        }}>
          <AnimatePresence mode="wait">
            <motion.p key={`prev-${activeIdx}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.5, fontFamily: "'Noto Sans Tamil', sans-serif", textShadow: '0 1px 8px rgba(0,0,0,0.95)', minHeight: 20 }}
            >{prevLine?.text ?? ''}</motion.p>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.p key={`active-${activeIdx}`}
              initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
              style={{ margin: 0, fontSize: 17, fontWeight: 500, color: 'rgba(255,255,255,0.95)', textAlign: 'center', lineHeight: 1.4, fontFamily: "'Noto Sans Tamil', sans-serif", textShadow: '0 1px 16px rgba(0,0,0,1), 0 0 30px rgba(212,83,126,0.3)', letterSpacing: '0.01em', minHeight: 24 }}
            >{activeLine?.text ?? ''}</motion.p>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.p key={`next-${activeIdx}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.28)', textAlign: 'center', lineHeight: 1.5, fontFamily: "'Noto Sans Tamil', sans-serif", textShadow: '0 1px 8px rgba(0,0,0,0.95)', minHeight: 20 }}
            >{nextLine?.text ?? ''}</motion.p>
          </AnimatePresence>
        </div>
      )}

      {/* ── Lyrics status — always visible while playing ───────────────────── */}
      {playing && lyricsStatus !== 'idle' && lyricsStatus !== 'notfound' && (
        <div style={{
          position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 184px)',
          left: 0, right: 0, zIndex: 15, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          {lyricsStatus === 'fetching' && (
            <Loader2 size={10} color="rgba(255,255,255,0.35)" style={{ animation: 'spin 1s linear infinite' }} />
          )}
          <span style={{
            fontSize: 10, fontFamily: "'Noto Sans Tamil', sans-serif",
            color: lyricsStatus === 'found' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.3)',
            textAlign: 'center',
          }}>
            {lyricsSource}
          </span>
        </div>
      )}

      {/* ── "Add lyrics" prompt when not found ────────────────────────────── */}
      {playing && lyricsStatus === 'notfound' && (
        <div style={{
          position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 184px)',
          left: 0, right: 0, zIndex: 15,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: "'Noto Sans Tamil', sans-serif" }}>
            No lyrics found
          </span>
          <button
            onClick={() => {
              const track = playlistRef.current.find(t => t.id === currentRef.current)
              if (track) setEditTrack(track)
            }}
            style={{
              padding: '7px 18px', borderRadius: 20,
              background: 'rgba(212,83,126,0.22)', border: '1px solid rgba(212,83,126,0.45)',
              color: '#F4C0D1', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'Noto Sans Tamil', sans-serif",
              backdropFilter: 'blur(10px)',
            }}
          >
            ✍ Add lyrics
          </button>
        </div>
      )}

      {/* ── Music button (above + FAB) ────────────────────────────────────── */}
      <button
        onClick={() => setShowPanel(true)}
        style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 136px)',
          right: 24, zIndex: 20,
          width: 40, height: 40, borderRadius: '50%',
          background: playing ? 'rgba(212,83,126,0.28)' : 'rgba(20,12,28,0.88)',
          border: playing ? '1px solid rgba(212,83,126,0.5)' : '1px solid rgba(255,255,255,0.2)',
          backdropFilter: 'blur(12px)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 14px rgba(0,0,0,0.5)',
          transition: 'all 0.22s ease',
        }}
      >
        {playing ? <EqualizerBars /> : <Music size={15} color="rgba(255,255,255,0.7)" />}
      </button>

      {/* ── Management panel ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70" onClick={() => setShowPanel(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'tween', ease: [0.22,1,0.36,1], duration: 0.38 }}
              style={{
                position: 'relative', width: '100%', maxWidth: 500,
                background: '#0f0c18', borderRadius: '24px 24px 0 0',
                maxHeight: '80vh', overflowY: 'auto',
                fontFamily: "'Noto Sans Tamil', sans-serif",
              }}
            >
              <div style={{ padding: '12px 20px 0' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)', margin: '0 auto 16px' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', margin: 0 }}>Music</h2>
                  <button onClick={() => setShowPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 4 }}>
                    <X size={18} />
                  </button>
                </div>
                {currentTrack && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>
                    Now playing: {currentTrack.name}
                  </p>
                )}
              </div>

              <div style={{ padding: '12px 20px 40px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Controls */}
                {playlist.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    <button onClick={skipTrack} style={ctrlBtn}>
                      <Shuffle size={13} /> Next random
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Vol</span>
                      <input type="range" min={0} max={1} step={0.05} value={volume}
                        onChange={e => setVolume(Number(e.target.value))}
                        style={{ flex: 1, accentColor: '#D4537E' }} />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{Math.round(volume * 100)}%</span>
                    </div>
                  </div>
                )}

                {/* Add */}
                <button onClick={addSongs} style={addBtn}>
                  <Plus size={15} /> Add songs
                </button>

                {/* Track list */}
                {playlist.map(track => (
                  <div key={track.id} style={{
                    borderRadius: 14, padding: '12px 14px',
                    background: track.id === currentId ? 'rgba(212,83,126,0.12)' : 'rgba(255,255,255,0.04)',
                    border: track.id === currentId ? '1px solid rgba(212,83,126,0.25)' : '1px solid rgba(255,255,255,0.07)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <button onClick={() => doPlay(track)} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: track.id === currentId ? '#F4C0D1' : 'rgba(255,255,255,0.82)' }}>
                        {track.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>
                        {track.searchArtist ? `${track.searchArtist} — ` : ''}{track.searchTitle || track.name}
                      </div>
                    </button>
                    <button onClick={() => setEditTrack(track)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4 }}>
                      <Search size={14} />
                    </button>
                    <button onClick={() => deleteTrack(track.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,100,100,0.4)', padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {playlist.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13, padding: '24px 0' }}>
                    No songs yet. Tap "Add songs" to pick files.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Lyrics / search edit sheet ────────────────────────────────────── */}
      <AnimatePresence>
        {editTrack && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/80" onClick={() => setEditTrack(null)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'tween', ease: [0.22,1,0.36,1], duration: 0.38 }}
              style={{
                position: 'relative', width: '100%', maxWidth: 500,
                background: '#0f0c18', borderRadius: '24px 24px 0 0',
                maxHeight: '88vh', overflowY: 'auto',
                fontFamily: "'Noto Sans Tamil', sans-serif",
                padding: '16px 20px 40px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'white', margin: 0 }}>Lyrics search</h3>
                <button onClick={() => setEditTrack(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)' }}>
                  <X size={18} />
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
                Set the artist and title used to fetch synced lyrics from LRCLIB.
                Name your file "Artist - Title.mp3" and it'll pre-fill automatically.
              </p>

              <Label>Artist name</Label>
              <input
                value={editTrack.searchArtist}
                onChange={e => setEditTrack(prev => prev ? { ...prev, searchArtist: e.target.value } : null)}
                placeholder="e.g. Ilaiyaraaja"
                style={inputStyle}
              />

              <Label>Song title</Label>
              <input
                value={editTrack.searchTitle}
                onChange={e => setEditTrack(prev => prev ? { ...prev, searchTitle: e.target.value } : null)}
                placeholder="e.g. Mouna Ragam"
                style={inputStyle}
              />

              <Label>Manual lyrics fallback</Label>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>
                Used only when LRCLIB has no results. One line per line.
              </p>
              <textarea
                value={editTrack.manualLyrics}
                onChange={e => setEditTrack(prev => prev ? { ...prev, manualLyrics: e.target.value } : null)}
                placeholder={'Line 1\nLine 2\n...'}
                rows={6}
                style={{ ...inputStyle, resize: 'none', lineHeight: 1.7 }}
              />

              <button onClick={saveEdit} style={{ ...addBtn, marginTop: 14, background: '#D4537E', border: 'none', color: 'white' }}>
                Save &amp; re-fetch lyrics
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

// ── Small shared styles ────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, marginTop: 14 }}>
      {children}
    </p>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.85)', fontSize: 14,
  fontFamily: "'Noto Sans Tamil', sans-serif", outline: 'none', boxSizing: 'border-box', marginBottom: 4,
}
const ctrlBtn: React.CSSProperties = {
  flex: 1, padding: '10px 0', borderRadius: 14, fontSize: 12, fontWeight: 500,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  fontFamily: "'Noto Sans Tamil', sans-serif",
}
const addBtn: React.CSSProperties = {
  width: '100%', padding: '12px 0', borderRadius: 16, fontSize: 13, fontWeight: 600,
  background: 'rgba(212,83,126,0.18)', border: '1px solid rgba(212,83,126,0.35)',
  color: '#F4C0D1', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  fontFamily: "'Noto Sans Tamil', sans-serif",
}

function EqualizerBars() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width: 3, borderRadius: 2, background: '#F4C0D1', animation: `eqb${i} ${0.5+i*0.15}s ease-in-out infinite alternate` }} />
      ))}
      <style>{`
        @keyframes eqb0{from{height:3px}to{height:13px}}
        @keyframes eqb1{from{height:7px}to{height:13px}}
        @keyframes eqb2{from{height:3px}to{height:10px}}
      `}</style>
    </div>
  )
}
