# Driver Locations Security Hardening - Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying the Row Level Security (RLS) policies for the `driver_locations` table to fix issue #1010: "Supabase Row Level Security policies not enforced for driver location data".

## Issue #1010 Summary
**Vulnerability**: Any authenticated driver could query the real-time location data of every other driver via direct Supabase queries, bypassing app-level access controls.

**Impact**:
- Driver privacy violations
- Location stalking and safety risks
- Competitive intelligence leakage

**Solution**: Enable RLS on `driver_locations` table with policies restricting driver access to their own data only.

## Deployment Steps

### Step 1: Apply the Database Migration

Choose one of the following methods:

#### Option A: Apply the Dedicated Migration (Recommended for Safety)
```bash
# Test in staging environment first
psql -U postgres -d truxify_staging -f docs/migration_add_driver_locations_rls.sql

# Then apply to production
psql -U postgres -d truxify_production -f docs/migration_add_driver_locations_rls.sql
```

#### Option B: Apply via Supabase Dashboard
1. Go to Supabase Dashboard → Project → SQL Editor
2. Create a new query
3. Copy the contents of `docs/migration_add_driver_locations_rls.sql`
4. Run the query
5. Verify success in the results pane

#### Option C: Apply Incrementally (if driver_locations table already exists)
1. Copy just the RLS policy section from `docs/migration_add_driver_locations_rls.sql`
2. Run in Supabase SQL Editor
3. Existing location data is preserved

### Step 2: Verify RLS Policies Are Enabled

Run the verification queries:

```sql
-- 1. Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'driver_locations';
-- Expected result: driver_locations | t

-- 2. List all RLS policies
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'driver_locations' 
ORDER BY policyname;
-- Expected: 6 policies (service role, drivers SELECT/UPDATE/INSERT, admin SELECT/UPDATE)

-- 3. Count total policies
SELECT COUNT(*) as policy_count 
FROM pg_policies 
WHERE tablename = 'driver_locations';
-- Expected result: 6
```

### Step 3: Test Policy Enforcement

Run the test suite to verify policies work correctly:

```bash
# Option A: Manual Testing in Supabase SQL Editor
# 1. Open docs/test_driver_locations_rls.sql
# 2. Run tests one by one, following comments
# 3. Verify expected results

# Option B: Automated Testing (if integrated into CI/CD)
# Run integration tests that verify RLS behavior
npm run test:rls:driver-locations
```

### Step 4: Verify No Breaking Changes

#### 1. Backend API Still Works
```bash
# Test location update endpoint
curl -X POST http://localhost:8000/api/locations \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 28.6139,
    "longitude": 77.2090,
    "accuracy": 5.0,
    "speed": 45.0
  }'
# Expected: 200 OK (backend service_role bypasses RLS)
```

#### 2. Driver App Can Access Own Locations
```dart
// In Flutter app
final locations = await supabase
  .from('driver_locations')
  .select()
  .order('created_at', descending: true)
  .limit(10)
  .execute();
// Expected: Returns only this driver's locations
```

#### 3. Cross-Driver Queries Are Blocked
```dart
// This query should return 0 rows
final otherLocations = await supabase
  .from('driver_locations')
  .select()
  .neq('driver_id', currentDriverId)
  .execute();
// Expected: Empty array (RLS blocks access)
```

#### 4. Admin Access Works
```dart
// Admin can see all locations
final allLocations = await supabase
  .from('driver_locations')
  .select()
  .execute();
// Expected: Returns locations for all drivers (if user role = 'admin')
```

### Step 5: Monitor for Issues

#### Logging & Monitoring
- Monitor Supabase query logs for RLS violations (403 Forbidden errors)
- Check driver app logs for location update failures
- Track RLS policy performance (policies should have minimal overhead)

#### Error Handling in App Code
The app should already handle RLS errors gracefully:
```dart
try {
  final result = await supabase
    .from('driver_locations')
    .select()
    .execute();
} catch (e) {
  if (e.toString().contains('403') || e.toString().contains('policy')) {
    // RLS policy denied access
    logger.error('Location access denied', error: e);
  }
}
```

## Rollback Plan (If Issues Arise)

If the RLS policies cause problems, you can temporarily disable them:

```sql
-- TEMPORARY: Disable RLS on driver_locations
ALTER TABLE driver_locations DISABLE ROW LEVEL SECURITY;

-- When ready to re-enable:
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
```

**Note**: Disabling RLS should only be temporary while diagnosing issues. Re-enable as soon as possible.

## Post-Deployment Checklist

- [ ] RLS enabled on `driver_locations` table
- [ ] All 6 policies created successfully
- [ ] Verification queries return expected results
- [ ] Backend API can still update locations (service_role bypass works)
- [ ] Driver app can fetch own locations
- [ ] Cross-driver queries return no data
- [ ] Admin queries return all locations
- [ ] No error spikes in app logging
- [ ] Performance metrics normal (no query slowdown)
- [ ] Documentation updated in code comments

## Related Files & Documentation

- **Migration File**: `docs/migration_add_driver_locations_rls.sql`
- **Test Suite**: `docs/test_driver_locations_rls.sql`
- **Schema Updates**: `docs/supabase_setup.sql` (updated with driver_locations table)
- **RLS Policies**: `docs/migration_rls_policies.sql` (updated with driver_locations policies)
- **PR**: Issue #1010 fix PR
- **Related**: Issue #1011 (Driver ID compile-time constant audit)

## Quick Reference: RLS Policy Design

The `driver_locations` table uses this policy architecture:

| Policy | Role | Operation | Access |
|--------|------|-----------|--------|
| Service role bypass | `service_role` | ALL | Full access (backend operations) |
| Driver own select | `authenticated` | SELECT | Own location only |
| Driver own update | `authenticated` | UPDATE | Own location only |
| Driver own insert | `authenticated` | INSERT | Own location only |
| Admin read | `authenticated` | SELECT | All locations (if role='admin') |
| Admin update | `authenticated` | UPDATE | All locations (if role='admin') |

## Frequently Asked Questions

**Q: Will existing location data be deleted?**
A: No. RLS only affects access to existing data. All historical locations are preserved.

**Q: Do drivers need to re-authenticate?**
A: No. RLS is enforced transparently. Drivers may see fewer results if querying all locations, but this is the intended security behavior.

**Q: What about dispatch/admin operations?**
A: Admins retain full access via the `admins select/update driver_locations` policies. Backend APIs using service_role key also have unrestricted access.

**Q: Can we test RLS without deploying to production?**
A: Yes. Apply to staging environment first using `truxify_staging` database.

**Q: What if a driver's profile doesn't have a role set?**
A: Admin policies use role='admin' check. Drivers without explicit admin role cannot see all locations.

## Support & Escalation

For issues or questions:
1. Check logs for RLS policy violation messages
2. Run verification queries to confirm policy status
3. Test in staging environment first
4. Review related PR: Issue #1010
5. Escalate to database administrator if needed

---

**Issue**: #1010
**PR**: [Link to PR]
**Last Updated**: 2026-06-27
