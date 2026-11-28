-- Postgres lets everyone execute a new function. These two run as the table owner,
-- so anyone with the public key could use up or reset another user's AI quota.
REVOKE EXECUTE ON FUNCTION public.bump_ai_usage(uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_ai_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_ai_usage(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_ai_usage(uuid) TO service_role;
ALTER FUNCTION public.bump_ai_usage(uuid, int) SET search_path = public, pg_temp;
ALTER FUNCTION public.refund_ai_usage(uuid) SET search_path = public, pg_temp;

NOTIFY pgrst, 'reload schema';
