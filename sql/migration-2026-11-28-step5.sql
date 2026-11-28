-- Step 5: email reminders and digest, focus history, share links.

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email_reminders BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email_digest BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS last_digest_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  minutes INTEGER NOT NULL CHECK (minutes BETWEEN 1 AND 180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_student ON public.focus_sessions(student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('note', 'deck')),
  resource_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_share_links_owner ON public.share_links(owner_id, resource_type, resource_id);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.focus_sessions, public.share_links TO service_role;

NOTIFY pgrst, 'reload schema';
