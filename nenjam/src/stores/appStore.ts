import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { differenceInDays, parseISO, format } from 'date-fns'

interface AppState {
  streakCount: number
  daysTogther: number
  relationshipStart: string | null
  ourSongUrl: string | null
  loading: boolean
  loadAppSettings: (userId: string) => Promise<void>
  updateStreak: (userId: string) => Promise<void>
  setOurSong: (userId: string, url: string) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  streakCount: 0,
  daysTogther: 0,
  relationshipStart: import.meta.env.VITE_RELATIONSHIP_START ?? null,
  ourSongUrl: null,
  loading: false,

  loadAppSettings: async (userId: string) => {
    set({ loading: true })
    const { data } = await supabase
      .from('app_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    const start = data?.relationship_start_date ?? import.meta.env.VITE_RELATIONSHIP_START ?? null
    const days = start ? differenceInDays(new Date(), parseISO(start)) : 0

    set({
      streakCount: data?.streak_count ?? 0,
      ourSongUrl: data?.our_song_url ?? null,
      relationshipStart: start,
      daysTogther: days,
      loading: false,
    })
  },

  updateStreak: async (userId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd')

    const { data: existing } = await supabase
      .from('app_settings')
      .select('last_active_date, streak_count')
      .eq('user_id', userId)
      .single()

    if (!existing) {
      await supabase.from('app_settings').upsert({
        user_id: userId,
        last_active_date: today,
        streak_count: 1,
        updated_at: new Date().toISOString(),
      })
      set({ streakCount: 1 })
      return
    }

    const lastActive = existing.last_active_date
    if (lastActive === today) return

    const daysDiff = lastActive
      ? differenceInDays(parseISO(today), parseISO(lastActive))
      : 999

    const newStreak = daysDiff === 1 ? (existing.streak_count ?? 0) + 1 : 1

    await supabase
      .from('app_settings')
      .update({ last_active_date: today, streak_count: newStreak, updated_at: new Date().toISOString() })
      .eq('user_id', userId)

    set({ streakCount: newStreak })
  },

  setOurSong: async (userId, url) => {
    await supabase
      .from('app_settings')
      .update({ our_song_url: url, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    set({ ourSongUrl: url })
  },
}))
