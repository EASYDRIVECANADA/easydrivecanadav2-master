# Dealership Onboarding Design

## Goal

Add a public dealership registration path that captures dealer interest, creates a pending owner account, stores initial dealership profile details, and routes the owner through verification and Billing.

## Design

Create a new `/dealers` page for dealership onboarding. The form collects company name, owner/contact name, email, phone, province, estimated inventory size, and optional website. Submitting posts to `/api/dealers/register`.

The API validates the required fields, finds or creates a `users` owner row with `role: private`, `title: Owner`, and `status: enable`, then upserts a lightweight `dealership` row for that `user_id` using existing company profile columns. The account stays private until Stripe Billing upgrades it to Small, Medium, or Large Dealership through the existing `/api/stripe/checkout` and webhook flow.

The API returns `/account/verification?returnUrl=/admin/billing`, so the dealer verifies identity first and lands on Billing to choose a paid dealership plan. The public header and footer add a dealer onboarding link.

## Error Handling

The API returns form-level validation errors for missing or invalid values. If the dealership profile insert fails due to deployment-specific schema differences, the owner account still remains created and the API returns a warning with the verification URL.

## Testing

Add a pure helper for normalizing dealer registration data and building owner/dealership payloads. Unit tests cover email normalization, pending owner account creation, dealership payload construction, and verification URL generation.
