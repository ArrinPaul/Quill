-- B9: AI daily usage quota table and atomic bump/refund functions

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

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ai_usage TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_ai_usage(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_ai_usage(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
