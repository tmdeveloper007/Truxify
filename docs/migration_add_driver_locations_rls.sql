-- Migration: Add driver_locations table with Row Level Security
-- ============================================================================
-- This migration creates the driver_locations table for storing real-time driver
-- GPS coordinates and enables strict RLS policies to prevent cross-driver location
-- data access vulnerabilities (issue #1010).
--
-- SECURITY: Each driver can only access their own location data, and only admins
-- can access all location data for dispatch operations.
--
-- APPLYING:
--   psql -f docs/migration_add_driver_locations_rls.sql
--   Or paste into Supabase SQL Editor.
--
-- Prerequisites:
--   The get_profile_id() helper function must exist (defined in supabase_setup.sql).
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. CREATE DRIVER_LOCATIONS TABLE (if not exists)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists driver_locations (
  id                uuid primary key default gen_random_uuid(),
  driver_id         uuid not null,                           -- profiles.id reference
  latitude          numeric(10, 8) not null,                 -- Decimal degrees (-90 to 90)
  longitude         numeric(11, 8) not null,                 -- Decimal degrees (-180 to 180)
  accuracy          numeric(10, 2),                          -- meters (GPS accuracy)
  speed            numeric(6, 2),                            -- km/h
  heading          numeric(6, 2),                            -- degrees (0-360)
  altitude         numeric(8, 2),                            -- meters
  is_active        boolean not null default true,            -- driver active/online status
  last_updated_at  timestamptz not null default now(),      -- UTC timestamp
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Create indexes for efficient querying
create index if not exists idx_driver_locations_driver_id on driver_locations (driver_id);
create index if not exists idx_driver_locations_is_active on driver_locations (is_active);
create index if not exists idx_driver_locations_updated_at on driver_locations (last_updated_at DESC);

-- Geo-spatial index for proximity searches (driver near customer)
create index if not exists idx_driver_locations_geo on driver_locations
  using gist(ll_to_earth(latitude, longitude));


-- ────────────────────────────────────────────────────────────────────────────
-- 2. ENABLE ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────────────────────
alter table driver_locations enable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY POLICIES
-- ────────────────────────────────────────────────────────────────────────────

-- 3.1 Service role bypass (backend services have full access)
drop policy if exists "Service role full access on driver_locations" on driver_locations;
create policy "Service role full access on driver_locations"
  on driver_locations
  for all
  to service_role
  using (true)
  with check (true);

-- 3.2 Drivers can only access their own location (read their own data)
drop policy if exists "Drivers select own location" on driver_locations;
create policy "Drivers select own location"
  on driver_locations
  for select
  to authenticated
  using (driver_id = get_profile_id());

-- 3.3 Drivers can only update their own location
drop policy if exists "Drivers update own location" on driver_locations;
create policy "Drivers update own location"
  on driver_locations
  for update
  to authenticated
  using (driver_id = get_profile_id())
  with check (driver_id = get_profile_id());

-- 3.4 Drivers can only insert their own location
drop policy if exists "Drivers insert own location" on driver_locations;
create policy "Drivers insert own location"
  on driver_locations
  for insert
  to authenticated
  with check (driver_id = get_profile_id());

-- 3.5 Admins can read all driver locations (for dispatch operations)
drop policy if exists "Admins select all driver locations" on driver_locations;
create policy "Admins select all driver locations"
  on driver_locations
  for select
  to authenticated
  using ((select role from profiles where id = get_profile_id()) = 'admin');

-- 3.6 Admins can update driver locations if needed
drop policy if exists "Admins can update driver locations" on driver_locations;
create policy "Admins can update driver locations"
  on driver_locations
  for update
  to authenticated
  using ((select role from profiles where id = get_profile_id()) = 'admin');


-- ────────────────────────────────────────────────────────────────────────────
-- 4. AUTO-UPDATE TIMESTAMPS (on every modification)
-- ────────────────────────────────────────────────────────────────────────────
drop trigger if exists set_driver_locations_updated_at on driver_locations;
create trigger set_driver_locations_updated_at
  before update on driver_locations
  for each row
  execute function set_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 5. VERIFICATION QUERIES (run after applying the migration)
-- ────────────────────────────────────────────────────────────────────────────
-- Verify RLS is enabled:
--   select tablename, rowsecurity from pg_tables
--   where tablename = 'driver_locations';
--
-- Verify policies are in place:
--   select policyname, cmd, USING, WITH CHECK from pg_policies
--   where tablename = 'driver_locations'
--   order by policyname;
--
-- Test driver access isolation (should see only their own location):
--   set jwt.claims.sub = 'driver-1-uuid';
--   select driver_id, latitude, longitude from driver_locations;
--
-- Test admin access (should see all locations):
--   set jwt.claims.sub = 'admin-uuid';
--   select driver_id, latitude, longitude from driver_locations;
