# Marketplace Inventory Schema

## Apply Migration

Run `supabase/marketplace_inventory_schema.sql` in the deployed Supabase SQL editor.

The migration is idempotent. Re-run it after pricing updates to add:

- `retail_price`
- `finance_price`
- `source_price_payload`

## Backfill DriveTown

```powershell
Get-Content client\.env | ForEach-Object { if ($_ -match '^\s*([^#=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process') } }
node scripts/backfill-drivetown-marketplace.js
```

Expected output includes the DriveTown `userId` and `updated: 148`.

## Run DriveTown Sync

Dry run:

```powershell
$env:DRIVETOWN_SYNC_DRY_RUN='1'
node scripts/sync-drivetown.js
```

Write run:

```powershell
$env:DRIVETOWN_SYNC_DRY_RUN='0'
node scripts/sync-drivetown.js
```

## Verify

```sql
select count(*)
from public.edc_vehicles
where marketplace_source = 'DriveTown Ottawa';

select status, counts
from public.dealer_inventory_sync_runs
where source_name = 'DriveTown Ottawa'
order by started_at desc
limit 5;
```
