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

NOTIFY pgrst, 'reload schema';
