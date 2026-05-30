import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Music2, VolumeX, Heart, Camera, MapPin } from 'lucide-react'
import { format, getISOWeek } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useEncryptionStore } from '../stores/encryptionStore'
import { downloadEncryptedPhoto } from '../lib/r2'
import { decryptBinary } from '../lib/encryption'
import { uint8ArrayToObjectUrl, revokeObjectUrl } from '../lib/imageProcessing'
import { useReelMusic } from '../contexts/ReelMusicContext'
import type { Photo } from '../types/index'

// ── Constants ─────────────────────────────────────────────────────────────────
const SLIDE_MS      = 4000
const CROSSFADE_MS  = 800
const OVERLAY_IN_MS = 300
const OVERLAY_OUT_MS = 3500

// ── Week helpers ──────────────────────────────────────────────────────────────
function getWeekKey(d = new Date()) {
  const w = getISOWeek(d)
  return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`
}
function getWeekRange(d = new Date()) {
  const dow = d.getDay()
  const mon = new Date(d); mon.setDate(d.getDate() - ((dow + 6) % 7))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return `${format(mon, 'd')}–${format(sun, 'd MMM')}`
}

// ── Weighted photo selection ──────────────────────────────────────────────────
function selectPhotos(all: Photo[], n: number): Photo[] {
  if (all.length === 0) return []
  const now = new Date()
  const curWeek  = getISOWeek(now)
  const curMonth = now.getMonth()
  const curYear  = now.getFullYear()

  const pool = all.length < 5 ? all : all.filter(p => {
    if (!p.taken_at) return true
    const ageYears = (now.getTime() - new Date(p.taken_at).getTime()) / (365.25 * 86400000)
    return ageYears <= 12
  })
  const src = pool.length === 0 ? all : pool

  const weighted = src.map(p => {
    let w = 1
    if (p.taken_at) {
      const d = new Date(p.taken_at)
      if (getISOWeek(d) === curWeek && d.getFullYear() < curYear) w = 3
      else if (d.getMonth() === curMonth) w = 2
    }
    return { p, w }
  })

  const count = Math.min(n, weighted.length)
  const selected: Photo[] = []
  const rem = [...weighted]
  for (let i = 0; i < count; i++) {
    const total = rem.reduce((s, x) => s + x.w, 0)
    let rand = Math.random() * total
    let idx = 0
    for (let j = 0; j < rem.length; j++) {
      rand -= rem[j].w
      if (rand <= 0) { idx = j; break }
    }
    selected.push(rem[idx].p)
    rem.splice(idx, 1)
  }
  return selected.sort(() => Math.random() - 0.5)
}

// ── Shimmer loading placeholder ───────────────────────────────────────────────
function ShimmerSlide() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#111' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute', inset: 0,
          animation: `shimmer-slide 2s ${i * 0.3}s infinite`,
          background: 'linear-gradient(90deg,#1a1a1a 25%,#2e2e2e 50%,#1a1a1a 75%)',
          backgroundSize: '400% 100%',
        }} />
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReelPage() {
  const { user, partner } = useAuthStore()
  const { sharedKey, privateJournalKey } = useEncryptionStore()
  const music = useReelMusic()
  const navigate = useNavigate()

  type Phase = 'loading' | 'ready' | 'end' | 'empty'
  const [phase,         setPhase]         = useState<Phase>('loading')
  const [selected,      setSelected]      = useState<Photo[]>([])
  const [decUrls,       setDecUrls]       = useState<Record<string, string>>({})
  const [currentIdx,    setCurrentIdx]    = useState(0)
  const [prevIdx,       setPrevIdx]       = useState<number | null>(null)
  const [isTransition,  setIsTransition]  = useState(false)
  const [isPaused,      setIsPaused]      = useState(false)
  const [showPauseIcon, setShowPauseIcon] = useState(false)
  const [showOverlay,   setShowOverlay]   = useState(false)
  const [kenBurns,      setKenBurns]      = useState<'in' | 'out'>('in')
  const [slideKey,      setSlideKey]      = useState(0)

  const urlsRef       = useRef<Record<string, string>>({})
  const selRef        = useRef<Photo[]>([])
  const idxRef        = useRef(0)
  const pausedRef     = useRef(false)
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ovInRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ovOutRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pauseIconRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchRef      = useRef<{ x: number; y: number; t: number } | null>(null)
  const wasSwipeRef   = useRef(false)
  const musicRef      = useRef(music)

  selRef.current    = selected
  idxRef.current    = currentIdx
  pausedRef.current = isPaused
  musicRef.current  = music

  // ── Decrypt a photo ─────────────────────────────────────────────────────────
  const decrypt = useCallback(async (photo: Photo): Promise<string | null> => {
    if (urlsRef.current[photo.id]) return urlsRef.current[photo.id]
    const keys = [sharedKey, privateJournalKey].filter((k): k is Uint8Array => k !== null)
    if (keys.length === 0) return null
    try {
      const { encrypted, nonce } = await downloadEncryptedPhoto(photo.r2_key)
      for (const key of keys) {
        const dec = decryptBinary(encrypted, nonce, key)
        if (dec) {
          const url = uint8ArrayToObjectUrl(dec)
          urlsRef.current[photo.id] = url
          setDecUrls(prev => ({ ...prev, [photo.id]: url }))
          return url
        }
      }
    } catch { /* silent */ }
    return null
  }, [sharedKey, privateJournalKey])

  // ── Load and select photos ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const weekKey = getWeekKey()
    ;(async () => {
      const ids = [user.id, ...(partner ? [partner.id] : [])]
      const { data } = await supabase
        .from('photos').select('*').in('uploader_id', ids).order('taken_at', { ascending: false })
      const all = (data ?? []) as Photo[]

      if (all.length === 0) { setPhase('empty'); return }

      // Check localStorage cache
      let sel: Photo[]
      try {
        const cached = JSON.parse(localStorage.getItem('reel_selection') ?? 'null')
        if (cached?.week === weekKey && Array.isArray(cached.photoKeys)) {
          const keySet = new Set<string>(cached.photoKeys)
          sel = all.filter(p => keySet.has(p.r2_key))
          if (sel.length === 0) sel = selectPhotos(all, 12)
        } else throw new Error('stale')
      } catch {
        const n = Math.floor(Math.random() * 8) + 8  // 8–15
        sel = selectPhotos(all, n)
        localStorage.setItem('reel_selection', JSON.stringify({ week: weekKey, photoKeys: sel.map(p => p.r2_key) }))
      }

      setSelected(sel)
      setPhase('ready')

      // Preload first 2
      if (sel[0]) decrypt(sel[0])
      if (sel[1]) decrypt(sel[1])
    })()

    // Load the configured song from app_settings
    ;(async () => {
      const { data: settings } = await supabase.from('app_settings').select('our_song_url').eq('user_id', user.id).maybeSingle()
      if (!settings?.our_song_url) return
      const { data: songMeta } = await supabase.from('tamil_songs').select('title, artist').eq('youtube_url', settings.our_song_url).maybeSingle()
      musicRef.current.loadSong({
        title: songMeta?.title ?? 'Our Song',
        artist: songMeta?.artist ?? '',
        url: settings.our_song_url,
      })
    })()

    return () => { Object.values(urlsRef.current).forEach(revokeObjectUrl); urlsRef.current = {} }
  }, [user, partner, decrypt])

  // ── Start slide timers ──────────────────────────────────────────────────────
  const startTimers = useCallback((idx: number, paused: boolean) => {
    if (paused) return
    if (timerRef.current)  clearTimeout(timerRef.current)
    if (ovInRef.current)   clearTimeout(ovInRef.current)
    if (ovOutRef.current)  clearTimeout(ovOutRef.current)

    ovInRef.current  = setTimeout(() => setShowOverlay(true), OVERLAY_IN_MS)
    ovOutRef.current = setTimeout(() => setShowOverlay(false), OVERLAY_OUT_MS)

    timerRef.current = setTimeout(() => {
      const sel = selRef.current
      if (idx >= sel.length - 1) { setPhase('end'); return }
      const next = idx + 1
      setPrevIdx(idx)
      setIsTransition(true)
      setShowOverlay(false)
      setCurrentIdx(next)
      setKenBurns(Math.random() < 0.5 ? 'in' : 'out')
      setSlideKey(k => k + 1)
      if (sel[next + 1]) decrypt(sel[next + 1])
      setTimeout(() => {
        setPrevIdx(null); setIsTransition(false)
        startTimers(next, pausedRef.current)
      }, CROSSFADE_MS)
    }, SLIDE_MS)
  }, [decrypt])

  // ── Begin playback once selected is ready ───────────────────────────────────
  useEffect(() => {
    if (phase !== 'ready' || selected.length === 0) return
    setKenBurns(Math.random() < 0.5 ? 'in' : 'out')
    setSlideKey(1)
    startTimers(0, false)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (ovInRef.current)  clearTimeout(ovInRef.current)
      if (ovOutRef.current) clearTimeout(ovOutRef.current)
    }
  }, [phase, selected.length, startTimers])

  // ── Music enter/exit ────────────────────────────────────────────────────────
  useEffect(() => {
    musicRef.current.play()
    return () => { musicRef.current.pause() }
  }, []) // intentionally mount-only

  // ── Toggle pause ───────────────────────────────────────────────────────────
  const togglePause = useCallback(() => {
    const nowPaused = !pausedRef.current
    setIsPaused(nowPaused)
    setShowPauseIcon(true)
    if (pauseIconRef.current) clearTimeout(pauseIconRef.current)
    pauseIconRef.current = setTimeout(() => setShowPauseIcon(false), 1000)
    if (!nowPaused) startTimers(idxRef.current, false)
    else {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (ovInRef.current)  clearTimeout(ovInRef.current)
      if (ovOutRef.current) clearTimeout(ovOutRef.current)
    }
  }, [startTimers])

  // ── Navigate slides ─────────────────────────────────────────────────────────
  const goPrev = useCallback(() => {
    if (idxRef.current === 0) return
    if (timerRef.current) clearTimeout(timerRef.current)
    const ni = idxRef.current - 1
    setPrevIdx(null); setIsTransition(false); setShowOverlay(false)
    setCurrentIdx(ni)
    setKenBurns(Math.random() < 0.5 ? 'in' : 'out')
    setSlideKey(k => k + 1)
    startTimers(ni, pausedRef.current)
  }, [startTimers])

  const goNext = useCallback(() => {
    const i = idxRef.current
    const sel = selRef.current
    if (i >= sel.length - 1) { setPhase('end'); return }
    if (timerRef.current) clearTimeout(timerRef.current)
    const ni = i + 1
    setPrevIdx(i); setIsTransition(true); setShowOverlay(false)
    setCurrentIdx(ni)
    setKenBurns(Math.random() < 0.5 ? 'in' : 'out')
    setSlideKey(k => k + 1)
    if (sel[ni + 1]) decrypt(sel[ni + 1])
    setTimeout(() => {
      setPrevIdx(null); setIsTransition(false)
      startTimers(ni, pausedRef.current)
    }, CROSSFADE_MS)
  }, [decrypt, startTimers])

  const replay = useCallback(() => {
    setCurrentIdx(0); setPrevIdx(null); setIsTransition(false)
    setShowOverlay(false); setKenBurns(Math.random() < 0.5 ? 'in' : 'out')
    setSlideKey(k => k + 1); setPhase('ready')
    startTimers(0, false)
  }, [startTimers])

  // ── Touch handling ──────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef.current) return
    const dx = e.changedTouches[0].clientX - touchRef.current.x
    const dy = e.changedTouches[0].clientY - touchRef.current.y
    const dt = Date.now() - touchRef.current.t
    touchRef.current = null
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50 && dt < 500) {
      wasSwipeRef.current = true
      setTimeout(() => { wasSwipeRef.current = false }, 120)
      if (dy > 0) { musicRef.current.pause(); navigate(-1) }  // swipe down: exit
    }
  }
  const onTap = (e: React.MouseEvent) => {
    if (wasSwipeRef.current) return
    if (music.needsGesture) { music.triggerPlay(); return }
    const x = e.clientX, w = window.innerWidth
    if (x < w * 0.35) goPrev()
    else if (x > w * 0.65) goNext()
    else togglePause()
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const cur  = selected[currentIdx]
  const prev = prevIdx !== null ? selected[prevIdx] : null
  const curUrl  = cur  ? decUrls[cur.id]  : undefined
  const prevUrl = prev ? decUrls[prev.id] : undefined

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 50, userSelect: 'none' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={onTap}
    >
      <style>{`
        @keyframes kb-in  { from{transform:scale(1.0)} to{transform:scale(1.08)} }
        @keyframes kb-out { from{transform:scale(1.08)} to{transform:scale(1.0)} }
        @keyframes prog   { from{width:0%} to{width:100%} }
        @keyframes shimmer-slide {
          0%   { background-position:100% 0 }
          100% { background-position:-100% 0 }
        }
      `}</style>

      {/* Loading */}
      {phase === 'loading' && <ShimmerSlide />}

      {/* Empty */}
      {phase === 'empty' && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40, textAlign:'center' }}>
          <Camera size={52} color="rgba(212,83,126,0.65)" style={{ marginBottom:20 }} />
          <p style={{ color:'white', fontSize:22, fontWeight:200, marginBottom:8 }}>Your first reel is waiting.</p>
          <p style={{ color:'rgba(255,255,255,0.45)', fontSize:14, marginBottom:28 }}>Add photos to your map to see them here.</p>
          <button
            onClick={e => { e.stopPropagation(); navigate('/map') }}
            style={{ padding:'11px 28px', borderRadius:24, background:'#D4537E', color:'white', border:'none', fontSize:14, fontWeight:600, cursor:'pointer' }}
          >
            Add a photo
          </button>
        </div>
      )}

      {/* Slideshow */}
      {(phase === 'ready' || phase === 'end') && selected.length > 0 && (
        <>
          {/* Fading-out previous slide */}
          {prev && (
            <div style={{ position:'absolute', inset:0, zIndex:1, opacity: isTransition ? 0 : 1, transition:`opacity ${CROSSFADE_MS}ms ease-in-out`, overflow:'hidden' }}>
              {prevUrl
                ? <img src={prevUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                : <div style={{ width:'100%', height:'100%', background:'#1a1a1a' }} />
              }
            </div>
          )}

          {/* Fading-in current slide */}
          <div style={{ position:'absolute', inset:0, zIndex:2, opacity: isTransition ? 1 : 1, transition: isTransition ? `opacity ${CROSSFADE_MS}ms ease-in-out` : 'none', overflow:'hidden' }}>
            {curUrl
              ? <img
                  key={`kb-${slideKey}`}
                  src={curUrl}
                  style={{ width:'100%', height:'100%', objectFit:'cover', transformOrigin:'center center', animation:`${kenBurns === 'in' ? 'kb-in' : 'kb-out'} ${SLIDE_MS}ms ease-in-out forwards` }}
                  alt=""
                />
              : <div style={{ width:'100%', height:'100%', background:'#1a1a1a' }} />
            }
          </div>

          {/* Dark gradient overlay (no zoom) */}
          <div style={{ position:'absolute', inset:0, zIndex:3, pointerEvents:'none', background:'linear-gradient(to top,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.0) 45%,rgba(0,0,0,0.3) 100%)' }} />

          {/* Progress segments */}
          <div style={{ position:'absolute', top:'max(10px,env(safe-area-inset-top,10px))', left:12, right:12, zIndex:10, display:'flex', gap:3, pointerEvents:'none' }}>
            {selected.map((_, i) => (
              <div key={i} style={{ flex:1, height:2, background:'rgba(255,255,255,0.25)', borderRadius:2, overflow:'hidden' }}>
                {i < currentIdx && (
                  <div style={{ width:'100%', height:'100%', background:'rgba(255,255,255,0.8)' }} />
                )}
                {i === currentIdx && !isPaused && (
                  <div key={`p-${slideKey}`} style={{ height:'100%', background:'#be185d', animation:`prog ${SLIDE_MS}ms linear forwards` }} />
                )}
                {i === currentIdx && isPaused && (
                  <div style={{ width:'50%', height:'100%', background:'#be185d' }} />
                )}
              </div>
            ))}
          </div>

          {/* "This Week" label — top-left */}
          <div style={{ position:'absolute', zIndex:10, pointerEvents:'none', top:'calc(max(10px,env(safe-area-inset-top,10px)) + 16px)', left:16 }}>
            <p style={{ color:'rgba(255,255,255,0.55)', fontSize:10, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>This Week</p>
            <p style={{ color:'white', fontSize:13 }}>{getWeekRange()}</p>
          </div>

          {/* Counter — top-right */}
          <div style={{ position:'absolute', zIndex:10, pointerEvents:'none', top:'calc(max(10px,env(safe-area-inset-top,10px)) + 16px)', right:16 }}>
            <p style={{ color:'rgba(255,255,255,0.55)', fontSize:11 }}>{currentIdx + 1} / {selected.length}</p>
          </div>

          {/* Bottom text overlay */}
          <div style={{
            position:'absolute', bottom:0, left:0, right:0, zIndex:10, pointerEvents:'none',
            padding:`0 20px calc(max(24px,env(safe-area-inset-bottom,24px)) + 24px)`,
            display:'flex', flexDirection:'column', gap:6,
            opacity: showOverlay ? 1 : 0,
            transition: showOverlay ? 'opacity 0.3s ease' : 'opacity 0.2s ease',
          }}>
            {cur?.lat != null && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:4, background:'rgba(212,83,126,0.3)', backdropFilter:'blur(8px)', borderRadius:12, padding:'3px 10px', alignSelf:'flex-start' }}>
                <MapPin size={11} color="#F4C0D1" />
                <span style={{ color:'#F4C0D1', fontSize:11, fontWeight:500 }}>{cur.lat.toFixed(3)}, {cur.lng?.toFixed(3)}</span>
              </div>
            )}
            {cur?.taken_at && (
              <p style={{ color:'rgba(255,255,255,0.85)', fontSize:13, fontWeight:300 }}>
                {format(new Date(cur.taken_at), 'MMMM d, yyyy')}
              </p>
            )}
            {cur?.caption && (
              <p style={{ color:'rgba(255,255,255,0.8)', fontSize:15, fontWeight:300, fontStyle:'italic', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const, overflow:'hidden' }}>
                {cur.caption}
              </p>
            )}
          </div>

          {/* Pause/play icon flash */}
          <AnimatePresence>
            {showPauseIcon && (
              <motion.div
                initial={{ opacity:0, scale:0.75 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
                style={{ position:'absolute', inset:0, zIndex:15, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}
              >
                <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(0,0,0,0.45)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {isPaused
                    ? <Play size={26} color="white" fill="white" style={{ marginLeft:3 }} />
                    : <Pause size={26} color="white" fill="white" />
                  }
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Music toggle button */}
          <div
            style={{ position:'absolute', bottom:'calc(max(20px,env(safe-area-inset-bottom,20px)) + 16px)', right:16, zIndex:15 }}
            onClick={e => { e.stopPropagation(); music.toggleMute() }}
          >
            <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(0,0,0,0.4)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              {music.isMuted ? <VolumeX size={16} color="white" /> : <Music2 size={16} color="white" />}
            </div>
          </div>

          {/* iOS tap-to-play music pill */}
          <AnimatePresence>
            {music.needsGesture && (
              <motion.div
                initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                style={{ position:'absolute', top:'calc(max(10px,env(safe-area-inset-top,10px)) + 52px)', left:0, right:0, zIndex:20, display:'flex', justifyContent:'center', pointerEvents:'none' }}
              >
                <div style={{ background:'white', borderRadius:20, padding:'6px 14px', display:'flex', alignItems:'center', gap:6 }}>
                  <Music2 size={13} color="#be185d" />
                  <span style={{ fontSize:12, color:'#be185d', fontWeight:500 }}>Tap anywhere to play music</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* End of reel screen */}
      <AnimatePresence>
        {phase === 'end' && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }}
            style={{ position:'absolute', inset:0, zIndex:30, background:'#0d0d0d', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:32, textAlign:'center' }}
          >
            <motion.div
              initial={{ scale:0.5, opacity:0 }}
              animate={{ scale:1, opacity:1 }}
              transition={{ type:'spring', stiffness:300, damping:20, delay:0.2 }}
            >
              <Heart size={40} color="#D4537E" fill="#D4537E" />
            </motion.div>
            <motion.p
              initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.35 }}
              style={{ color:'white', fontSize:22, fontWeight:200 }}
            >
              That's your week.
            </motion.p>
            <motion.p
              initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }}
              style={{ color:'rgba(255,255,255,0.4)', fontSize:13 }}
            >
              {selected.length} memories
            </motion.p>
            {music.currentSong?.title && (
              <motion.p
                initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.65 }}
                style={{ color:'rgba(255,255,255,0.25)', fontSize:11 }}
              >
                ♪ {music.currentSong.title}{music.currentSong.artist ? ` — ${music.currentSong.artist}` : ''}
              </motion.p>
            )}
            <motion.button
              initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.7 }}
              onClick={e => { e.stopPropagation(); replay() }}
              style={{ marginTop:8, padding:'11px 32px', borderRadius:24, background:'#D4537E', color:'white', border:'none', fontSize:14, fontWeight:600, cursor:'pointer' }}
            >
              Replay
            </motion.button>
            <motion.button
              initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.85 }}
              onClick={e => { e.stopPropagation(); music.pause(); navigate(-1) }}
              style={{ padding:'9px 24px', borderRadius:24, background:'transparent', color:'rgba(255,255,255,0.45)', border:'1px solid rgba(255,255,255,0.15)', fontSize:13, cursor:'pointer' }}
            >
              Close
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
