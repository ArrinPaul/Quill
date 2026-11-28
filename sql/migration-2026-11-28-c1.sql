-- C1: Remove Telegram leftover tables, function, and column.
-- Destructive migration: ask the owner before running on Supabase.

DROP TABLE IF EXISTS public.reminders CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.telegram_groups CASCADE;

DROP FUNCTION IF EXISTS public.create_event_reminders() CASCADE;

ALTER TABLE public.students DROP COLUMN IF EXISTS telegram_chat_id;

NOTIFY pgrst, 'reload schema';
