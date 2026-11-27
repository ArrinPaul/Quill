ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS importance TEXT NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_importance_check'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_importance_check CHECK (importance IN ('low', 'normal', 'high'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
