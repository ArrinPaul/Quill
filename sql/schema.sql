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
  status TEXT CHECK (status IN ('pending','completed','cancelled')) DEFAULT 'pending',
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
