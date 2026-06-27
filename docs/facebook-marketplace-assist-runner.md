# Facebook Marketplace Assist Runner

This runner is used on the dealership computer for browser-assisted Facebook Marketplace posting.

It does not store Facebook credentials and it does not click the final Facebook Post button.

The runner uses a dedicated persistent browser profile at `.facebook-assist-profile` by default. Log into Facebook once in the browser window opened by the runner; future assist runs reuse that same profile and session.

The EasyDrive admin API must generate the assist token first. The local runner uses that signed, expiring token to fetch one posting payload and report whether fields were filled. Do not hand-edit or share the token.

The runner attempts to upload listing photos from the EasyDrive image URLs, then fills or selects the visible Facebook vehicle fields such as Location, Year, Make, Model, Price, Mileage, Description, VIN, colour, transmission, and fuel type. Facebook can still change field labels or require manual selections, so the final review step remains required.

## Start Runner

```bash
node scripts/facebook-marketplace-assist-runner.mjs --port 4777 --profile-dir ".facebook-assist-profile"
```

## Dry Run A Launch Token

```bash
node scripts/facebook-marketplace-assist-runner.mjs --token '<token json>' --dry-run --profile-dir ".facebook-assist-profile"
```

## Expected Workflow

1. Log into Facebook in the visible browser profile on the dealership computer.
2. Start this runner.
3. Open EasyDrive Admin > Marketplace > Facebook.
4. Pick a ready vehicle.
5. Click Assist Post.
6. Review the filled Facebook form.
7. Manually click Post in Facebook.
8. Paste the final Facebook listing URL into EasyDrive.

## Smoke Test

The admin page has a read-only Playwright smoke test. It requires local admin credentials in environment variables:

```powershell
$env:EDC_ADMIN_EMAIL="info@easydrivecanada.com"
$env:EDC_ADMIN_PASSWORD="your-admin-password"
npm run test:e2e:facebook-assist
```

The test opens EasyDrive Admin > Marketplace > Facebook and verifies the posting queue renders for an authenticated admin. It does not create or publish Facebook listings.
