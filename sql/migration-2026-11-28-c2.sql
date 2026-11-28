-- C2: Email verification (email_verified_at on students, email_codes table).

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

UPDATE public.students
SET email_verified_at = COALESCE(created_at, now())
WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS public.email_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_codes_student_id
  ON public.email_codes(student_id, created_at DESC);

ALTER TABLE public.email_codes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.email_codes TO service_role;

NOTIFY pgrst, 'reload schema';
