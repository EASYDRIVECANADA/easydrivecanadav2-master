# Appointment E2E Testing

This repo has a focused Playwright smoke test for the admin appointment workflow.

## Required Credentials

Do not commit credentials. Set them only in your local shell:

```powershell
$env:EDC_ADMIN_EMAIL="info@easydrivecanada.com"
$env:EDC_ADMIN_PASSWORD="your-admin-password"
```

## Read-Only Smoke Test

This logs in, opens `/admin/appointments`, and verifies the new appointment drawer renders.

```powershell
npm run test:e2e:appointments
```

## Write Smoke Test

This creates a real appointment through the admin UI, finds it, and marks it cancelled.

```powershell
$env:EDC_APPOINTMENTS_E2E_WRITE="1"
npm run test:e2e:appointments
```

Leave `EDC_APPOINTMENTS_E2E_WRITE` unset unless you intentionally want the test to write to the connected Supabase project.
