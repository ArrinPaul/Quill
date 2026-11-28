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


-- ===== sql/notifyme-migration.sql =====
-- NotifyMe tables for n8n workflow support
-- Run this migration against your Supabase project

-- Telegram Groups (registered via /start)
CREATE TABLE public.telegram_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_chat_id BIGINT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  invite_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_telegram_groups_chat_id ON public.telegram_groups(telegram_chat_id);

-- Group Members (students linked to telegram groups)
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.telegram_groups(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, student_id)
);
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_group_members_student_id ON public.group_members(student_id);

-- Events (deadlines extracted by AI from teacher messages)
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.telegram_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  priority TEXT CHECK (priority IN ('High','Medium','Low')) DEFAULT 'Medium',
  category TEXT CHECK (category IN ('Exam','Assignment','Attendance','Fee','Placement','Other')) DEFAULT 'Other',
  raw_message TEXT,
  source TEXT DEFAULT 'telegram',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_events_group_id ON public.events(group_id);
CREATE INDEX idx_events_event_date ON public.events(event_date);

-- Reminders (auto-generated from events at 7, 3, 1 day offsets)
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.telegram_groups(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  category TEXT,
  priority TEXT,
  days_left INTEGER NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reminders_sent ON public.reminders(sent);
CREATE INDEX idx_reminders_event_date ON public.reminders(event_date);

-- Function to auto-create reminders when an event is inserted
CREATE OR REPLACE FUNCTION create_event_reminders()
RETURNS TRIGGER AS $$
DECLARE
  chat_id BIGINT;
  offset_days INTEGER;
BEGIN
  -- Get the telegram_chat_id for this group
  SELECT telegram_chat_id INTO chat_id
  FROM public.telegram_groups
  WHERE id = NEW.group_id;

  IF chat_id IS NOT NULL THEN
    FOREACH offset_days IN ARRAY ARRAY[7, 3, 1]
    LOOP
      -- Only create reminder if the event is far enough in the future
      IF (NEW.event_date - CURRENT_DATE) >= offset_days THEN
        INSERT INTO public.reminders (event_id, group_id, telegram_chat_id, title, event_date, category, priority, days_left)
        VALUES (NEW.id, NEW.group_id, chat_id, NEW.title, NEW.event_date, NEW.category, NEW.priority, offset_days);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_event_reminders
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION create_event_reminders();


-- ===== sql/reminders-migration.sql =====
-- Migration for Multi-Stage Reminders

-- 1. Add JSONB column to tasks to track which reminders have been sent
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS reminders_sent JSONB DEFAULT '{}'::jsonb;

-- 2. Update the trigger for group events to only generate 7-day and 1-day reminders
CREATE OR REPLACE FUNCTION create_event_reminders()
RETURNS TRIGGER AS $$
DECLARE
  chat_id BIGINT;
  offset_days INTEGER;
BEGIN
  -- Get the telegram_chat_id for this group
  SELECT telegram_chat_id INTO chat_id
  FROM public.telegram_groups
  WHERE id = NEW.group_id;

  IF chat_id IS NOT NULL THEN
    -- Changed from [7, 3, 1] to [7, 1] for Option B
    FOREACH offset_days IN ARRAY ARRAY[7, 1]
    LOOP
      -- Only create reminder if the event is far enough in the future
      IF (NEW.event_date - CURRENT_DATE) >= offset_days THEN
        INSERT INTO public.reminders (event_id, group_id, telegram_chat_id, title, event_date, category, priority, days_left)
        VALUES (NEW.id, NEW.group_id, chat_id, NEW.title, NEW.event_date, NEW.category, NEW.priority, offset_days);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


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
