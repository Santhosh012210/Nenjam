-- ================================================================
-- Timeline Migration — run in Supabase SQL Editor
-- Adds columns to timeline_entries and creates hidden_timeline_entries
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards)
-- ================================================================

-- -----------------------------------------------
-- 1. ALTER timeline_entries — add new columns
-- -----------------------------------------------
ALTER TABLE public.timeline_entries
  ADD COLUMN IF NOT EXISTS photo_urls    TEXT[],
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS lat           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng           DOUBLE PRECISION;

-- -----------------------------------------------
-- 2. Add missing RLS policies for timeline_entries
-- -----------------------------------------------

-- UPDATE: only the creator can edit
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'timeline_entries' AND policyname = 'timeline_update'
  ) THEN
    CREATE POLICY "timeline_update" ON public.timeline_entries FOR UPDATE
      USING (created_by = auth.uid())
      WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

-- DELETE: only the creator can delete
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'timeline_entries' AND policyname = 'timeline_delete'
  ) THEN
    CREATE POLICY "timeline_delete" ON public.timeline_entries FOR DELETE
      USING (created_by = auth.uid());
  END IF;
END $$;

-- -----------------------------------------------
-- 3. CREATE hidden_timeline_entries
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.hidden_timeline_entries (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  approximate_date TEXT NOT NULL,
  location_name    TEXT,
  scenario         TEXT,
  photo_urls       TEXT[],
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -----------------------------------------------
-- 4. Enable RLS on hidden_timeline_entries
-- -----------------------------------------------
ALTER TABLE public.hidden_timeline_entries ENABLE ROW LEVEL SECURITY;

-- SELECT: both users in couple can read
CREATE POLICY "hidden_select" ON public.hidden_timeline_entries FOR SELECT
  USING (created_by = auth.uid() OR created_by = my_partner_id());

-- INSERT: any authenticated user in the couple
CREATE POLICY "hidden_insert" ON public.hidden_timeline_entries FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- DELETE: only the creator (no UPDATE — hidden memories are permanent)
CREATE POLICY "hidden_delete" ON public.hidden_timeline_entries FOR DELETE
  USING (created_by = auth.uid());

-- Realtime for hidden timeline (optional — nice to have)
ALTER PUBLICATION supabase_realtime ADD TABLE public.hidden_timeline_entries;
