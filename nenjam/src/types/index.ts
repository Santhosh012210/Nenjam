export interface Profile {
  id: string
  display_name: string
  partner_id: string | null
  public_key: string | null
  avatar_url: string | null
  created_at: string
}

export interface Message {
  id: string
  sender_id: string
  recipient_id: string
  encrypted_content: string
  nonce: string
  created_at: string
  // Decrypted client-side
  content?: string
}

export interface KeyDate {
  id: string
  user_id: string
  title: string
  date: string
  type: 'anniversary' | 'birthday' | 'custom'
  created_at: string
}

export interface MoodCheckin {
  id: string
  user_id: string
  mood: string
  note: string | null
  check_date: string
  created_at: string
}

export interface JournalEntry {
  id: string
  user_id: string
  encrypted_content: string
  nonce: string
  created_at: string
  // Decrypted client-side
  content?: string
  title?: string
}

export interface SharedNote {
  id: string
  title: string
  encrypted_content: string
  nonce: string
  last_edited_by: string | null
  created_at: string
  updated_at: string
  // Decrypted client-side
  content?: string
}

export interface Photo {
  id: string
  uploader_id: string
  r2_key: string
  encrypted_key: string | null
  lat: number | null
  lng: number | null
  taken_at: string | null
  caption: string | null
  created_at: string
  // Client-side
  url?: string
}

export interface TimelineEntry {
  id: string
  created_by: string
  title: string
  date: string
  note: string | null
  photo_id: string | null
  type: 'milestone' | 'trip' | 'everyday' | 'special'
  created_at: string
  photo?: Photo
  // Extended fields
  photo_urls: string[] | null
  location_name: string | null
  lat: number | null
  lng: number | null
}

export interface HiddenTimelineEntry {
  id: string
  created_by: string
  title: string
  approximate_date: string
  location_name: string | null
  scenario: string | null
  photo_urls: string[] | null
  created_at: string
}

export interface TimeCapsule {
  id: string
  created_by: string
  encrypted_content: string
  nonce: string
  unlock_date: string
  is_unlocked: boolean
  created_at: string
  content?: string
}

export interface QuizQuestion {
  id: string
  question: string
  is_custom: boolean
  created_by: string | null
}

export interface QuizAnswer {
  id: string
  question_id: string
  user_id: string
  answer: string
  quiz_date: string
  created_at: string
}

export interface BucketListItem {
  id: string
  created_by: string
  title: string
  description: string | null
  is_completed: boolean
  completed_at: string | null
  lat: number | null
  lng: number | null
  created_at: string
}

export interface GoodNightNote {
  id: string
  sender_id: string
  encrypted_content: string
  nonce: string
  sent_date: string
  is_read: boolean
  created_at: string
  content?: string
}

export interface TamilSong {
  id: string
  title: string
  artist: string | null
  youtube_url: string | null
  file_url: string | null
  added_by: string | null
  created_at: string
}

export interface AppSettings {
  user_id: string
  our_song_url: string | null
  last_active_date: string | null
  streak_count: number
  relationship_start_date: string | null
  push_subscription: object | null
  updated_at: string
}

export type MoodEmoji = '😊' | '😍' | '😢' | '😴' | '😤' | '🥰' | '😌' | '🤩' | '😔' | '🌸'

export const MOOD_OPTIONS: { emoji: MoodEmoji; label: string }[] = [
  { emoji: '🥰', label: 'Loved' },
  { emoji: '😊', label: 'Happy' },
  { emoji: '😍', label: 'Excited' },
  { emoji: '🌸', label: 'Calm' },
  { emoji: '😌', label: 'Content' },
  { emoji: '😤', label: 'Frustrated' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😔', label: 'Low' },
  { emoji: '😴', label: 'Tired' },
  { emoji: '🤩', label: 'Amazing' },
]

export const TIMELINE_COLORS: Record<TimelineEntry['type'], string> = {
  milestone: '#f472b6',  // pink
  trip: '#a855f7',       // purple
  everyday: '#14b8a6',   // teal
  special: '#f59e0b',    // amber
}

export const DEFAULT_QUIZ_QUESTIONS: string[] = [
  "What is my favourite comfort food?",
  "Which song reminds you of me?",
  "What would I pick: beach or mountains?",
  "What's one thing I'm secretly afraid of?",
  "Name my favourite Tamil movie.",
  "What small thing makes me really happy?",
  "Describe me in 3 words.",
  "What's my go-to stress reliever?",
  "Which season matches my personality?",
  "What would my dream holiday look like?",
  "What is something I do that makes you smile?",
  "What's one thing you wish I knew about you?",
]
