ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
