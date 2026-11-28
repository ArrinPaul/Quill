-- C3: Study groups, members, roles, and 75-member join function.

CREATE TABLE IF NOT EXISTS public.study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 60),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  owner_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  realtime_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_groups_owner_id
  ON public.study_groups(owner_id);

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

CREATE INDEX IF NOT EXISTS idx_study_group_members_group_id
  ON public.study_group_members(group_id);

CREATE INDEX IF NOT EXISTS idx_study_group_members_student_id
  ON public.study_group_members(student_id);

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

NOTIFY pgrst, 'reload schema';
