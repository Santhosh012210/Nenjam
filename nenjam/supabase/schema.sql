-- ============================================================
-- Nenjam — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- -----------------------------------------------
-- 1. TRIGGER: Hard limit of exactly 2 users
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_max_two_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM auth.users) >= 2 THEN
    RAISE EXCEPTION 'Maximum of 2 users allowed. This app is private.';
  END IF;
  RETURN NEW;
END;
$$;

-- Drop first to avoid duplicate trigger error on re-run
DROP TRIGGER IF EXISTS enforce_two_user_limit ON auth.users;

CREATE TRIGGER enforce_two_user_limit
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_two_users();

-- -----------------------------------------------
-- 2. PROFILES
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL DEFAULT 'User',
  partner_id    UUID REFERENCES public.profiles(id),
  public_key    TEXT,                          -- nacl box public key (base64)
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------
-- 3. MESSAGES (E2E encrypted chat)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_content   TEXT NOT NULL,
  nonce               TEXT NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS messages_participants_idx ON public.messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at DESC);

-- -----------------------------------------------
-- 4. MOOD CHECK-INS
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.mood_checkins (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mood        TEXT NOT NULL,
  note        TEXT,
  check_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, check_date)
);

-- -----------------------------------------------
-- 5. JOURNAL ENTRIES (private, only writer can decrypt)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_content   TEXT NOT NULL,
  nonce               TEXT NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -----------------------------------------------
-- 6. SHARED NOTES
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.shared_notes (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title               TEXT NOT NULL DEFAULT 'Untitled',
  encrypted_content   TEXT NOT NULL,
  nonce               TEXT NOT NULL,
  last_edited_by      UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -----------------------------------------------
-- 7. PHOTOS (encrypted, stored in Cloudflare R2)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.photos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uploader_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  r2_key        TEXT NOT NULL,
  encrypted_key TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  taken_at      TIMESTAMPTZ,
  caption       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS photos_location_idx ON public.photos(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- -----------------------------------------------
-- 8. TIMELINE ENTRIES
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.timeline_entries (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  date        DATE NOT NULL,
  note        TEXT,
  photo_id    UUID REFERENCES public.photos(id),
  type        TEXT NOT NULL DEFAULT 'everyday'
                CHECK (type IN ('milestone', 'trip', 'everyday', 'special')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS timeline_date_idx ON public.timeline_entries(date);

-- -----------------------------------------------
-- 9. KEY DATES
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.key_dates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  date        DATE NOT NULL,
  type        TEXT NOT NULL DEFAULT 'custom'
                CHECK (type IN ('anniversary', 'birthday', 'custom')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -----------------------------------------------
-- 10. TIME CAPSULES
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.time_capsules (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_content   TEXT NOT NULL,
  nonce               TEXT NOT NULL,
  unlock_date         DATE NOT NULL,
  is_unlocked         BOOLEAN DEFAULT FALSE NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -----------------------------------------------
-- 11. COUPLE QUIZ
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question    TEXT NOT NULL,
  is_custom   BOOLEAN DEFAULT FALSE NOT NULL,
  created_by  UUID REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id   UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer        TEXT NOT NULL,
  quiz_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(question_id, user_id, quiz_date)
);

-- -----------------------------------------------
-- 12. BUCKET LIST
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.bucket_list (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  is_completed  BOOLEAN DEFAULT FALSE NOT NULL,
  completed_at  TIMESTAMPTZ,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -----------------------------------------------
-- 13. GOOD NIGHT NOTES
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.goodnight_notes (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_content   TEXT NOT NULL,
  nonce               TEXT NOT NULL,
  sent_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  is_read             BOOLEAN DEFAULT FALSE NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(sender_id, sent_date)
);

-- -----------------------------------------------
-- 14. TAMIL SONGS PLAYLIST
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.tamil_songs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  artist      TEXT,
  youtube_url TEXT,
  file_url    TEXT,
  added_by    UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -----------------------------------------------
-- 15. APP SETTINGS (per user)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  user_id                   UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  our_song_url              TEXT,
  last_active_date          DATE,
  streak_count              INTEGER DEFAULT 0 NOT NULL,
  relationship_start_date   DATE,
  push_subscription         JSONB,
  updated_at                TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Auto-create settings row when profile is created
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================

-- Helper function: get current user's partner id
-- SECURITY DEFINER bypasses RLS on profiles to avoid infinite recursion
-- (profiles RLS calls this function → this queries profiles → infinite loop without SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.my_partner_id()
RETURNS UUID
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT partner_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Enable RLS on all tables
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_checkins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_dates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_capsules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bucket_list      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goodnight_notes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tamil_songs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings     ENABLE ROW LEVEL SECURITY;

-- PROFILES: both users can read each other; only own update
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR id = my_partner_id());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- MESSAGES: participants only
CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- MOOD CHECK-INS: both can see each other's
CREATE POLICY "mood_select" ON public.mood_checkins FOR SELECT
  USING (user_id = auth.uid() OR user_id = my_partner_id());
CREATE POLICY "mood_insert" ON public.mood_checkins FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "mood_update" ON public.mood_checkins FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- JOURNAL: strictly private
CREATE POLICY "journal_select" ON public.journal_entries FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "journal_insert" ON public.journal_entries FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "journal_delete" ON public.journal_entries FOR DELETE
  USING (user_id = auth.uid());

-- SHARED NOTES: both can read/write
CREATE POLICY "notes_select" ON public.shared_notes FOR SELECT
  USING (TRUE);  -- only 2 users exist; both can see all notes
CREATE POLICY "notes_insert" ON public.shared_notes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "notes_update" ON public.shared_notes FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- PHOTOS: both can see
CREATE POLICY "photos_select" ON public.photos FOR SELECT
  USING (uploader_id = auth.uid() OR uploader_id = my_partner_id());
CREATE POLICY "photos_insert" ON public.photos FOR INSERT
  WITH CHECK (uploader_id = auth.uid());
CREATE POLICY "photos_update" ON public.photos FOR UPDATE
  USING (uploader_id = auth.uid());
CREATE POLICY "photos_delete" ON public.photos FOR DELETE
  USING (uploader_id = auth.uid());

-- TIMELINE: both can read/write
CREATE POLICY "timeline_select" ON public.timeline_entries FOR SELECT
  USING (created_by = auth.uid() OR created_by = my_partner_id());
CREATE POLICY "timeline_insert" ON public.timeline_entries FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- KEY DATES: both can see
CREATE POLICY "keydates_select" ON public.key_dates FOR SELECT
  USING (user_id = auth.uid() OR user_id = my_partner_id());
CREATE POLICY "keydates_insert" ON public.key_dates FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "keydates_delete" ON public.key_dates FOR DELETE
  USING (user_id = auth.uid());

-- TIME CAPSULES: both can see (but only creator made it, reader decrypts)
CREATE POLICY "capsule_select" ON public.time_capsules FOR SELECT
  USING (created_by = auth.uid() OR created_by = my_partner_id());
CREATE POLICY "capsule_insert" ON public.time_capsules FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- QUIZ QUESTIONS: both can read/insert
CREATE POLICY "quiz_q_select" ON public.quiz_questions FOR SELECT
  USING (TRUE);
CREATE POLICY "quiz_q_insert" ON public.quiz_questions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- QUIZ ANSWERS: both can see today's answers
CREATE POLICY "quiz_a_select" ON public.quiz_answers FOR SELECT
  USING (user_id = auth.uid() OR user_id = my_partner_id());
CREATE POLICY "quiz_a_insert" ON public.quiz_answers FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "quiz_a_update" ON public.quiz_answers FOR UPDATE
  USING (user_id = auth.uid());

-- BUCKET LIST: both can read/write
CREATE POLICY "bucket_select" ON public.bucket_list FOR SELECT
  USING (created_by = auth.uid() OR created_by = my_partner_id());
CREATE POLICY "bucket_insert" ON public.bucket_list FOR INSERT
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "bucket_update" ON public.bucket_list FOR UPDATE
  USING (created_by = auth.uid() OR created_by = my_partner_id());
CREATE POLICY "bucket_delete" ON public.bucket_list FOR DELETE
  USING (created_by = auth.uid());

-- GOOD NIGHT NOTES: both can see
CREATE POLICY "gn_select" ON public.goodnight_notes FOR SELECT
  USING (sender_id = auth.uid() OR sender_id = my_partner_id());
CREATE POLICY "gn_insert" ON public.goodnight_notes FOR INSERT
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY "gn_update" ON public.goodnight_notes FOR UPDATE
  USING (sender_id = auth.uid() OR sender_id = my_partner_id());

-- TAMIL SONGS: both can read/write
CREATE POLICY "songs_select" ON public.tamil_songs FOR SELECT
  USING (TRUE);
CREATE POLICY "songs_insert" ON public.tamil_songs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "songs_delete" ON public.tamil_songs FOR DELETE
  USING (added_by = auth.uid());

-- APP SETTINGS: own only
CREATE POLICY "settings_select" ON public.app_settings FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "settings_upsert" ON public.app_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "settings_update" ON public.app_settings FOR UPDATE
  USING (user_id = auth.uid());

-- ================================================================
-- REALTIME: enable for chat
-- ================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.goodnight_notes;

-- ================================================================
-- STORAGE: encrypted photo bucket
-- ================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photos', 'photos', false, 10485760, ARRAY['application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to their own folder (path starts with their user id)
CREATE POLICY "photos_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Both users can download any photo in the bucket (only 2 users exist)
CREATE POLICY "photos_storage_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'photos' AND auth.uid() IS NOT NULL);

-- Uploader can delete their own photos
CREATE POLICY "photos_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);
