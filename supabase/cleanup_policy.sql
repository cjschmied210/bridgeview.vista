-- 1. Enable the pg_cron extension (pre-installed in Supabase)
create extension if not exists pg_cron;

-- 2. Create the cleanup function
create or replace function cleanup_old_snapshots()
returns void as $$
begin
  -- Delete analysis logs older than 7 days
  delete from analysis_logs
  where created_at < now() - interval '7 days';

  -- Delete snapshots older than 7 days (cascading deletes handle related records if foreign keys are set to cascade,
  -- but we manually delete snapshots since analysis_logs references snapshots)
  delete from snapshots
  where created_at < now() - interval '7 days';
end;
$$ language plpgsql security definer;

-- 3. Schedule the cleanup job to run every day at midnight (UTC)
select cron.schedule(
  'cleanup-snapshots-daily', -- Job name
  '0 0 * * *',               -- Daily cron expression (midnight)
  'select cleanup_old_snapshots()'
);
