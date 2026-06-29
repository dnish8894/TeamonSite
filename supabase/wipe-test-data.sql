-- Wipe transactional/test data while KEEPING the setup (org, users, clients,
-- sites, devices, engineers, projects). Run with:
--   Get-Content supabase/wipe-test-data.sql -Raw | docker exec -i supabase_db_elv-app psql -U postgres -d postgres
-- (or against a cloud DB connection string with psql).
--
-- CASCADE also clears: job_reports, ticket_activities, ticket_groups, qr_scan_logs,
-- equipment_log, equipment_bookings.
TRUNCATE TABLE
  tickets,
  attendance_checkins,
  claims,
  leave_requests,
  company_equipment,
  part_requests
RESTART IDENTITY CASCADE;

-- Optional: also clear settings change log
-- TRUNCATE TABLE settings_audit_log;
