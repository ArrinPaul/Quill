-- C5: Safety tables (blocks, reports, audit_log, study_group_bans) and ban checks on group joins.

CREATE TABLE IF NOT EXISTS public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker_id
  ON public.blocks(blocker_id);

CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id
  ON public.blocks(blocked_id);

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('member', 'message', 'note', 'deck', 'board', 'quiz', 'other')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES public.students(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter_id
  ON public.reports(reporter_id);

CREATE INDEX IF NOT EXISTS idx_reports_group_id
  ON public.reports(group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_resolved_by
  ON public.reports(resolved_by);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_group_created
  ON public.audit_log(group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id
  ON public.audit_log(actor_id);

CREATE TABLE IF NOT EXISTS public.study_group_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  banned_by UUID REFERENCES public.students(id) ON DELETE SET NULL,
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_study_group_bans_group_id
  ON public.study_group_bans(group_id);

CREATE INDEX IF NOT EXISTS idx_study_group_bans_student_id
  ON public.study_group_bans(student_id);

CREATE INDEX IF NOT EXISTS idx_study_group_bans_banned_by
  ON public.study_group_bans(banned_by);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_bans ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.blocks, public.reports, public.audit_log, public.study_group_bans TO service_role;

CREATE OR REPLACE FUNCTION public.join_study_group(p_group uuid, p_student uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int;
  v_exists boolean;
  v_banned boolean;
BEGIN
  PERFORM 1 FROM public.study_groups WHERE id = p_group FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.study_group_bans
    WHERE group_id = p_group AND student_id = p_student
  ) INTO v_banned;

  IF v_banned THEN
    RETURN 'banned';
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
  v_banned boolean;
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
    SELECT 1 FROM public.study_group_bans
    WHERE group_id = v_invite.group_id AND student_id = p_student
  ) INTO v_banned;

  IF v_banned THEN
    RETURN jsonb_build_object('status', 'banned', 'group_id', v_invite.group_id);
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
