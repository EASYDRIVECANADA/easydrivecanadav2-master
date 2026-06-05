# Superadmin Dealer Profile Editing Design

## Goal

Allow the EasyDrive superadmin account, `info@easydrivecanada.com`, to edit any dealership business profile from the existing company profile screen. This makes marketplace dealer setup easier, including logos and Bill of Sale branding for DriveTown Ottawa and future dealer sources.

## Current Behavior

Dealer business profiles are stored in the `dealership` table and edited through `/admin/configuration?tab=company`. The company profile screen scopes reads and writes to the current dealership `user_id`. The Bill of Sale generator already reads from the same `dealership` row and uses `company_logo`, `company_name`, MVDA, address, phone, email, tax number, and RIN.

## Proposed Behavior

Normal dealers continue to edit only their own dealership profile.

When the current admin session email is `info@easydrivecanada.com`, the company profile screen shows a dealership selector above the form. Selecting a dealership changes the edit scope to that dealership row. All form fields, including logo, load from the selected dealer and save back to that dealer's `dealership` row.

## Data Model

No schema change is required for the first implementation. We will use the existing `dealership` table and `company_logo` payload shape already produced by the company profile screen:

```json
{
  "file_name": "dealer-logo.png",
  "mime_type": "image/png",
  "data_url": "data:image/png;base64,..."
}
```

The dealer row remains owned by the dealer's `user_id`. Superadmin editing changes profile fields only; it does not transfer vehicle ownership or account ownership.

## Authorization

Create a small shared helper that normalizes the admin email and returns true only for `info@easydrivecanada.com`.

The client uses this helper to show the dealership selector and to choose the editable `user_id`. Save operations must still include an explicit `user_id` scope. If a user is not superadmin, the selected scope must always remain their own account scope.

For server/API flows added later, the same helper should be reused server-side before allowing cross-dealer edits.

## UI

The selector appears only on `/admin/configuration?tab=company` for the superadmin. It lists dealerships by company name, with email or website as secondary context where available. Choosing one reloads the form with that dealership profile. The save success/error states remain the existing ones.

Normal dealer UI does not change.

## Bill of Sale Impact

No PDF rendering change is required. Once superadmin updates a dealer's company profile/logo, Bill of Sale generation will pick up that dealer branding through the existing `fetchBillOfSaleDealerInfo` path.

## Testing

Add focused tests for the helper:

- `info@easydrivecanada.com` is superadmin regardless of casing or surrounding whitespace.
- Other emails are not superadmin.

Add a small profile-scope helper if needed so tests can verify:

- superadmin may select another dealership `user_id`.
- non-superadmin falls back to their own `user_id`.

Run the relevant unit tests and `npm run build`.
