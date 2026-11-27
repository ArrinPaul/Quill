-- E4: Quiz types (mcq, tf, short), model answers, short-answer text, and grading feedback

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'mcq';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quiz_questions_type_check'
      AND conrelid = 'public.quiz_questions'::regclass
  ) THEN
    ALTER TABLE public.quiz_questions
      ADD CONSTRAINT quiz_questions_type_check CHECK (type IN ('mcq', 'tf', 'short'));
  END IF;
END $$;

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS model_answer TEXT;

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS user_answer_text TEXT;

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS feedback TEXT;

ALTER TABLE public.quiz_questions
  ALTER COLUMN options DROP NOT NULL;

ALTER TABLE public.quiz_questions
  ALTER COLUMN correct_index DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
