-- One-shot setup for a NEW, empty Supabase project. Run once.

-- ===== sql/schema.sql =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Students
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  branch TEXT NOT NULL,
  year INTEGER NOT NULL,
  subjects TEXT[] NOT NULL DEFAULT '{}',
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 0,
  feed_version INTEGER NOT NULL DEFAULT 0,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks / Deadlines
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMPTZ NOT NULL,
  reminder_time TIMESTAMPTZ,
  add_to_calendar BOOLEAN DEFAULT TRUE,
  importance TEXT NOT NULL DEFAULT 'normal' CHECK (importance IN ('low','normal','high')),
  status TEXT CHECK (status IN ('pending','in_progress','completed','cancelled')) DEFAULT 'pending',
  repeat TEXT NOT NULL DEFAULT 'none' CHECK (repeat IN ('none','weekly')),
  repeat_parent UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notices
CREATE TABLE public.notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  notice_text TEXT NOT NULL,
  ai_summary TEXT,
  event_date DATE,
  event_title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  total_classes INTEGER NOT NULL DEFAULT 0,
  attended_classes INTEGER NOT NULL DEFAULT 0,
  threshold NUMERIC DEFAULT 75.0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Preferences
CREATE TABLE public.preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.students(id) ON DELETE CASCADE UNIQUE,
  settings JSONB DEFAULT '{}',
  dashboard_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tasks_student_id ON public.tasks(student_id);
CREATE INDEX idx_tasks_deadline ON public.tasks(deadline);
CREATE UNIQUE INDEX idx_tasks_repeat_parent ON public.tasks(repeat_parent) WHERE repeat_parent IS NOT NULL;
CREATE INDEX idx_notices_student_id ON public.notices(student_id);
CREATE INDEX idx_attendance_student_id ON public.attendance(student_id);

-- Whiteboards
CREATE TABLE public.whiteboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Whiteboard',
  data JSONB NOT NULL DEFAULT '{}',
  thumbnail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_whiteboards_student_id ON public.whiteboards(student_id);


-- ===== sql/quizzes_schema.sql =====
-- Quizzes Schema

-- Quizzes Table (Represents a generated quiz session)
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    score INTEGER,
    total_questions INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quiz Questions Table (Represents individual questions inside a quiz)
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'mcq' CHECK (type IN ('mcq', 'tf', 'short')),
    question TEXT NOT NULL,
    options JSONB, -- Array of string options (null for short-answer)
    correct_index INTEGER, -- Null for short-answer
    model_answer TEXT,
    explanation TEXT,
    user_answer_index INTEGER, -- Null until answered
    user_answer_text TEXT,
    is_correct BOOLEAN,
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_quizzes_student_id ON quizzes(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);


-- ===== sql/flashcards_schema.sql =====
-- Flashcards Schema

-- 1. Flashcard Decks (Folders / Topics)
CREATE TABLE public.flashcard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Flashcards
CREATE TABLE public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  citation TEXT,
  status TEXT DEFAULT 'unseen' CHECK (status IN ('unseen', 'review', 'mastered')),
  repetitions INTEGER DEFAULT 0,
  interval_days INTEGER DEFAULT 0,
  ease_factor NUMERIC DEFAULT 2.5,
  next_review_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Client-side protection)
CREATE POLICY "Users can manage their own decks" ON public.flashcard_decks
  FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "Users can manage their own cards" ON public.flashcards
  FOR ALL USING (
    deck_id IN (SELECT id FROM public.flashcard_decks WHERE student_id = auth.uid())
  );


-- ===== automation_logs (used by routes/calendar.js) =====
CREATE TABLE public.automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  workflow_type TEXT CHECK (workflow_type IN ('deadline_reminder','notice_broadcast','attendance_alert')) NOT NULL,
  status TEXT CHECK (status IN ('triggered','success','failed')) DEFAULT 'triggered',
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_automation_logs_student_id ON public.automation_logs(student_id);

-- ===== activity_log =====
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_student ON public.activity_log(student_id, created_at DESC);

-- ===== ai_usage =====
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, day)
);

CREATE OR REPLACE FUNCTION public.bump_ai_usage(p_student uuid, p_limit int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  IF p_limit IS NULL OR p_limit <= 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_usage (student_id, day, count)
  VALUES (p_student, CURRENT_DATE, 1)
  ON CONFLICT (student_id, day)
  DO UPDATE SET count = public.ai_usage.count + 1
  WHERE public.ai_usage.count < p_limit
  RETURNING count INTO v_count;

  RETURN v_count IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_ai_usage(p_student uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.ai_usage
  SET count = count - 1
  WHERE student_id = p_student
    AND day = CURRENT_DATE
    AND count > 0;
END;
$$;

-- ===== Later columns =====
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS citation TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ===== Saved AI Chat (E8) =====
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_student_updated
  ON public.ai_conversations(student_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created
  ON public.ai_messages(conversation_id, created_at ASC);

-- ===== Notes (P3) =====
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

-- ===== Access control =====
-- RLS on every table blocks the public anon key; the backend's service_role key bypasses RLS.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
REVOKE EXECUTE ON FUNCTION public.bump_ai_usage(uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_ai_usage(uuid) FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.bump_ai_usage(uuid, int) SET search_path = public, pg_temp;
ALTER FUNCTION public.refund_ai_usage(uuid) SET search_path = public, pg_temp;
GRANT EXECUTE ON FUNCTION public.bump_ai_usage(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_ai_usage(uuid) TO service_role;

-- ===== Step 5: email reminders and digest, focus history, share links.

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

-- ===== C2: Email verification =====

CREATE TABLE IF NOT EXISTS public.email_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_codes_student_id ON public.email_codes(student_id, created_at DESC);

ALTER TABLE public.email_codes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.email_codes TO service_role;

-- ===== C3: Study groups and roles =====

CREATE TABLE IF NOT EXISTS public.study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 60),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  owner_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  realtime_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_study_groups_owner_id ON public.study_groups(owner_id);

CREATE TABLE IF NOT EXISTS public.study_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, student_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_study_group_one_owner
  ON public.study_group_members(group_id)
  WHERE role = 'owner';
CREATE INDEX IF NOT EXISTS idx_study_group_members_group_id ON public.study_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_study_group_members_student_id ON public.study_group_members(student_id);

ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.study_groups, public.study_group_members TO service_role;

CREATE OR REPLACE FUNCTION public.join_study_group(p_group uuid, p_student uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int;
  v_exists boolean;
BEGIN
  PERFORM 1 FROM public.study_groups WHERE id = p_group FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.study_group_members
    WHERE group_id = p_group AND student_id = p_student
  ) INTO v_exists;

  IF v_exists THEN
    RETURN 'already_member';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.study_group_members
  WHERE group_id = p_group;

  IF v_count >= 75 THEN
    RETURN 'full';
  END IF;

  INSERT INTO public.study_group_members (group_id, student_id, role)
  VALUES (p_group, p_student, 'member');

  RETURN 'joined';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_study_group(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_study_group(uuid, uuid) TO service_role;

-- C4: Study group invites and atomic 75-member invite acceptance.
CREATE TABLE IF NOT EXISTS public.study_group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INT NOT NULL DEFAULT 25 CHECK (max_uses >= 1),
  uses INT NOT NULL DEFAULT 0 CHECK (uses >= 0),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_study_group_invites_code_hash
  ON public.study_group_invites(code_hash);

CREATE INDEX IF NOT EXISTS idx_study_group_invites_group_id
  ON public.study_group_invites(group_id);

CREATE INDEX IF NOT EXISTS idx_study_group_invites_created_by
  ON public.study_group_invites(created_by);

ALTER TABLE public.study_group_invites ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.study_group_invites TO service_role;

CREATE OR REPLACE FUNCTION public.accept_study_group_invite(p_code_hash text, p_student uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite RECORD;
  v_count int;
  v_exists boolean;
BEGIN
  SELECT id, group_id, expires_at, max_uses, uses, revoked_at
  INTO v_invite
  FROM public.study_group_invites
  WHERE code_hash = p_code_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found', 'group_id', NULL);
  END IF;

  IF v_invite.revoked_at IS NOT NULL
     OR v_invite.expires_at <= now()
     OR (v_invite.max_uses IS NOT NULL AND v_invite.uses >= v_invite.max_uses) THEN
    RETURN jsonb_build_object('status', 'not_found', 'group_id', NULL);
  END IF;

  PERFORM 1 FROM public.study_groups WHERE id = v_invite.group_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found', 'group_id', NULL);
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.study_group_members
    WHERE group_id = v_invite.group_id AND student_id = p_student
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('status', 'already_member', 'group_id', v_invite.group_id);
  END IF;

  SELECT count(*) INTO v_count
  FROM public.study_group_members
  WHERE group_id = v_invite.group_id;

  IF v_count >= 75 THEN
    RETURN jsonb_build_object('status', 'full', 'group_id', v_invite.group_id);
  END IF;

  INSERT INTO public.study_group_members (group_id, student_id, role)
  VALUES (v_invite.group_id, p_student, 'member');

  UPDATE public.study_group_invites
  SET uses = uses + 1
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('status', 'joined', 'group_id', v_invite.group_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_study_group_invite(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_study_group_invite(text, uuid) TO service_role;
