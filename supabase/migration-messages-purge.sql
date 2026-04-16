-- Migration: auto-purge messages older than 7 days
-- Run manually or schedule via Supabase pg_cron

-- Manual purge (run anytime):
DELETE FROM messages WHERE created_at < NOW() - INTERVAL '7 days';

-- To schedule automatic daily purge at 3am UTC via pg_cron:
-- SELECT cron.schedule('purge-old-messages', '0 3 * * *', $$DELETE FROM messages WHERE created_at < NOW() - INTERVAL '7 days'$$);

-- To check scheduled jobs:
-- SELECT * FROM cron.job;

-- To remove the scheduled job:
-- SELECT cron.unschedule('purge-old-messages');
