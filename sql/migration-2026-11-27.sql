-- Adds columns needed for quiz citations and the "Early Bird" achievement. Safe to run more than once.
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS citation TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
NOTIFY pgrst, 'reload schema';
