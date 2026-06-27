# Facebook Marketplace Assist Runner

This runner is used on the dealership computer for browser-assisted Facebook Marketplace posting.

It does not store Facebook credentials and it does not click the final Facebook Post button.

The runner uses a dedicated persistent browser profile at `.facebook-assist-profile` by default. Log into Facebook once in the browser window opened by the runner; future assist runs reuse that same profile and session.

The EasyDrive admin API must generate the assist token first. The local runner uses that signed, expiring token to fetch one posting payload and report whether fields were filled. Do not hand-edit or share the token.

The runner attempts to upload listing photos from the EasyDrive image URLs, then fills or selects the visible Facebook vehicle fields such as Location, Year, Make, Model, Price, Mileage, Description, VIN, colour, transmission, and fuel type. Facebook can still change field labels or require manual selections, so the final review step remains required.

## One-Time Dealership Setup

Use the setup card in EasyDrive Admin > Marketplace > Facebook.

1. Click `Download Facebook Assistant`.
2. Run the downloaded `install.ps1` file with PowerShell on the dealership Windows computer.
3. Return to EasyDrive Admin and click `Check Again`.

The downloaded installer does not require the EasyDrive source code repo. It downloads the runner and package metadata from:

```text
https://easydrivecanada.com/downloads/facebook-assistant/
```

For local developer installs from this repo, this command still works:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-facebook-assistant-startup.ps1
```

Both installers create a Windows scheduled task named `EasyDrive Facebook Assistant`, start the local runner immediately, and start it again whenever that Windows user logs in.

The admin dashboard checks `http://127.0.0.1:4777/health` and shows either `Facebook Assistant Online` or `Facebook Assistant Offline`.

## Manual Start For Developers

```bash
node scripts/facebook-marketplace-assist-runner.mjs --port 4777 --profile-dir ".facebook-assist-profile"
```

## Dry Run A Launch Token

```bash
node scripts/facebook-marketplace-assist-runner.mjs --token '<token json>' --dry-run --profile-dir ".facebook-assist-profile"
```

## Expected Workflow

1. Log into Facebook in the visible browser profile on the dealership computer.
2. Download and run the one-time installer if the dashboard says `Facebook Assistant Offline`.
3. Open EasyDrive Admin > Marketplace > Facebook.
4. Confirm the dashboard says `Facebook Assistant Online`.
5. Pick a ready vehicle.
6. Click Assist Post.
7. Review the filled Facebook form.
8. Manually click Post in Facebook.
9. Paste the final Facebook listing URL into EasyDrive.

## Smoke Test

The admin page has a read-only Playwright smoke test. It requires local admin credentials in environment variables:

```powershell
$env:EDC_ADMIN_EMAIL="info@easydrivecanada.com"
$env:EDC_ADMIN_PASSWORD="your-admin-password"
npm run test:e2e:facebook-assist
```

The test opens EasyDrive Admin > Marketplace > Facebook and verifies the posting queue renders for an authenticated admin. It does not create or publish Facebook listings.
