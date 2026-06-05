# DriveTown Dealer Select Sync Design

## Goal

Create DriveTown Ottawa as a dealership account and run a repeatable inventory sync that imports its scraped vehicles into EasyDrive Canada as editable Dealer Select inventory.

## Scope

This phase builds the first dealer feed source only: DriveTown Ottawa. The result should prove the marketplace workflow end to end without building a full multi-dealer comparison UI yet. All imported vehicles must land in the same `edc_vehicles` inventory used by the admin tools so admins and the DriveTown dealership account can edit them normally.

## Current Context

The active admin inventory flow stores vehicles in Supabase `edc_vehicles` and scopes dealership/private inventory with `user_id`. Existing admin screens already create and edit these rows directly. There is also an older Express/Prisma `Vehicle` model, but it is not the main path used by the current Next admin inventory screens.

The existing spreadsheet import endpoint at `client/src/app/api/import/route.ts` already demonstrates the right pattern for user-scoped feed imports: parse external data, resolve an importing user, insert into `edc_vehicles`, and avoid touching unrelated users. The DriveTown sync should reuse that shape but scrape DriveTown directly and sync by source identity rather than replacing all feed rows blindly.

## DriveTown Dealership Account

Before importing inventory, the system must create or find a DriveTown Ottawa account.

The account setup should:

- Create or update a `users` row for DriveTown Ottawa with a stable `user_id`.
- Set the account role to `Medium dealership` for the first DriveTown account because the source currently has more than 100 vehicles.
- Create or update a matching `dealership` row using `user_id`.
- Store company name as `DriveTown Ottawa`.
- Store website as `https://drivetownottawa.com/`.
- Store available public contact/location data when the source provides it.

The DriveTown `user_id` becomes the owner scope for all scraped vehicles. Admin users can see and edit those rows globally. DriveTown dealership users can see and edit only rows where `edc_vehicles.user_id` equals the DriveTown account `user_id`.

## Dealer Select Inventory

Every DriveTown scraped vehicle should be created as editable Dealer Select inventory.

The preferred representation is:

- `user_id`: DriveTown account `user_id`
- `inventory_type`: `DEALER_SELECT`
- `categories`: `dealer_select`
- `status`: `In Stock` for currently scraped vehicles

If the deployed Supabase schema does not currently accept `DEALER_SELECT`, the initial implementation can use:

- `inventory_type`: `FLEET`
- `categories`: `dealer_select`

The UI can then display `Dealer Select` from `categories` until a schema migration formalizes `DEALER_SELECT`.

## Scraper

The scraper should target `https://drivetownottawa.com/vehicles/` and collect all current DriveTown vehicle detail URLs. The listing page currently advertises 148 vehicles and renders a large first batch server-side, so the scraper must handle pagination or load-more behavior rather than assuming the first HTML response contains every unit.

For each vehicle, the scraper should normalize:

- Source detail URL
- Year
- Make
- Model
- Trim/title
- Stock number
- VIN
- Mileage in kilometers
- Dealer price
- Finance price when available
- Transmission
- Drivetrain
- Fuel type
- Body style
- Exterior color
- Interior color when available
- Description and feature text
- Image URLs

The scraper should make low-frequency requests, use timeouts, and fail individual vehicles without aborting the whole run when possible.

## Sync Behavior

The sync must be repeatable and idempotent.

Each scraped vehicle should match an existing `edc_vehicles` row in this order:

1. Source URL or source vehicle id for DriveTown
2. VIN scoped to DriveTown `user_id`
3. Stock number scoped to DriveTown `user_id`

Current scraped vehicles are inserted or updated. Previously synced DriveTown vehicles that are missing from the latest complete scrape are marked `Sold` or `Inactive`; they are not deleted.

The sync must not touch:

- Manually created DriveTown vehicles that do not have the DriveTown sync marker.
- Vehicles owned by other dealerships or users.
- Existing EasyDrive fleet or premiere inventory.

## Edit Preservation

Scraped rows must remain editable by admins and by the DriveTown account. Later sync runs must not wipe meaningful manual edits.

The implementation should treat source identity fields as source-owned:

- Source URL
- Source name
- Source vehicle id
- VIN
- Stock number
- Last seen timestamp
- Last synced timestamp

Editable marketplace fields should be preserved after manual edits:

- Price
- Description and ad description
- Features
- Images
- Body style
- Fuel type
- Transmission
- Drivetrain
- Status
- Notes
- Feed toggles

The preferred approach is to add lightweight sync metadata or override flags, such as `source_name`, `source_url`, `source_last_seen_at`, `source_last_synced_at`, `source_sync_status`, and field-level override flags. If schema changes need to be minimized, the first implementation can store a sync marker in an existing text field and use a conservative rule: once an imported row has been edited after its last sync timestamp, later scraper runs only refresh source identity and last-seen fields.

## Kamatera Runtime

The repeatable sync should run from the Kamatera server as a scheduled Node worker.

Runtime:

- Command: `node scripts/sync-drivetown.js`
- Schedule: every 6 hours through cron
- Environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DRIVETOWN_DEALER_USER_ID`
  - `DRIVETOWN_SYNC_DRY_RUN`

The first worker writes directly to Supabase with the service role key. A secured internal API can be added later when multiple feed sources need shared auth, rate limiting, and observability.

## Logging And Operations

Every sync run should log:

- Start and end time
- Source name
- Total listing URLs found
- Vehicle details scraped
- Inserted count
- Updated count
- Preserved/manual-edit count
- Marked sold/inactive count
- Failed URL count with short error messages

The first implementation can log to stdout for Kamatera cron logs. A future admin "Dealer Feeds" screen can surface last-run status, counts, and failed URLs.

## Error Handling

If DriveTown listing discovery fails, the sync should stop without marking any existing vehicles sold or inactive. Missing-vehicle marking should only happen after a complete listing scrape.

If individual detail pages fail, the sync should import/update the successful vehicles and report failed URLs, but it should not mark missing vehicles sold unless the run had complete listing discovery and the failure count is below a safe threshold.

If the DriveTown account cannot be resolved, the sync should fail before writing any vehicles.

If Supabase rejects `DEALER_SELECT`, the implementation should use the compatibility representation: `inventory_type = FLEET` and `categories = dealer_select`.

## Testing

Add pure tests for scraper parsing and sync mapping before writing database code.

Test coverage should include:

- Parsing a DriveTown listing fixture into detail URLs.
- Parsing a DriveTown detail fixture into normalized vehicle data.
- Mapping normalized data to an `edc_vehicles` insert row.
- Matching priority by source URL, then VIN, then stock number.
- Preserving manual edits when override metadata indicates the row was edited.
- Marking missing previously-synced rows as sold only after a complete scrape.
- Refusing to mark vehicles sold when listing discovery fails.

Integration verification should include a dry run against the live DriveTown site that prints counts without writing to Supabase, followed by a controlled write to a test or known DriveTown account.

## Future Work

After DriveTown proves the source-adapter model, add a generic dealer feed registry so admins can onboard additional dealership websites. The marketplace UI can then show which dealership owns each Dealer Select vehicle and support dealer-level filtering, comparison, and sync health.
