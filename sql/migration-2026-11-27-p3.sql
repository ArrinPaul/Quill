-- P3: Personal Markdown notes with optimistic concurrency

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_student_updated
  ON public.notes(student_id, updated_at DESC);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.notes TO service_role;

NOTIFY pgrst, 'reload schema';
