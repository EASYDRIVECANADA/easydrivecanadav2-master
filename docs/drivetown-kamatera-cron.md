# DriveTown Ottawa Dealer Select Sync On Kamatera

## Environment

Create `/etc/easydrive/drivetown-sync.env` on the Kamatera server with these variable names and real values:

```bash
EDC_APP_DIR=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DRIVETOWN_DEALER_USER_ID=
DRIVETOWN_SYNC_DRY_RUN=0
```

`DRIVETOWN_DEALER_USER_ID` can stay empty after the first run because the worker can resolve the account by `inventory@drivetownottawa.com`.

## Manual Dry Run

```bash
set -a
. /etc/easydrive/drivetown-sync.env
set +a
cd "$EDC_APP_DIR"
DRIVETOWN_SYNC_DRY_RUN=1 node scripts/sync-drivetown.js
```

## Manual Write Run

```bash
set -a
. /etc/easydrive/drivetown-sync.env
set +a
cd "$EDC_APP_DIR"
DRIVETOWN_SYNC_DRY_RUN=0 node scripts/sync-drivetown.js
```

## Cron

Run every 48 hours at 3:00 AM server time:

```cron
0 3 */2 * * set -a && . /etc/easydrive/drivetown-sync.env && set +a && cd "$EDC_APP_DIR" && DRIVETOWN_SYNC_DRY_RUN=0 node scripts/sync-drivetown.js >> /var/log/easydrive-drivetown-sync.log 2>&1
```

## Monitoring

Check:

```bash
tail -n 200 /var/log/easydrive-drivetown-sync.log
```

The log should contain JSON with `inserted`, `updated`, `preserved`, `markedSold`, and `failed` counts.
