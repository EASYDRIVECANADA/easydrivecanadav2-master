# Private Seller Sell Flow Design

## Goal

Let a customer who wants to sell their car start from `/sell`, create a private seller account record, create a draft private-seller vehicle, and continue into existing ID verification before the listing is managed in admin.

## Design

The existing `/sell` form remains the public entry point. On submit, `/api/sell` validates the seller details, sends the existing email notification, then uses the server Supabase key to find or create a `users` owner row with `role: private`, `title: Owner`, and `status: enable`. It then enforces the private seller limit by counting non-closed vehicles for that `user_id`; if the seller already has one active/private draft vehicle, it returns a clear limit error.

When allowed, the API creates an `edc_vehicles` draft row with the VIN, asking price, `user_id`, `categories: Private Seller`, `inventory_type: PRIVATE`, and `status: DRAFT`. The API returns `userId`, `vehicleId`, and a verification URL: `/account/verification?returnUrl=/admin/inventory/<vehicleId>`.

The `/sell` page success state changes from a passive email confirmation to an actionable next step. After submit, it shows that a draft private seller listing was created and provides a button to continue to ID verification. The existing verification page already creates/updates the private owner record and redirects to the provided return URL.

## Error Handling

Validation errors remain on the form. Email notification failures should not block account/listing creation; they are returned as a warning so the seller can still continue. Database failures return a clear form error. If the seller already has one active private listing, the API returns HTTP 409 with an explanation.

## Testing

Add a focused unit test for the sell-flow helper that builds private owner and draft vehicle payloads and enforces the one-active-listing limit. Keep the API route thin and use the helper for deterministic behavior.
