# Dealer Price Display Design

## Goal

Show DriveTown marketplace cash pricing as **Dealer Price** in the public frontend, while also preserving and displaying the original retail and finance prices when DriveTown exposes them.

## Data Terms

- `price`: the active public cash price. For DriveTown this is the dealer/cash price and remains the compatibility field used for filters, sorting, checkout, and payment calculator math.
- `retail_price`: DriveTown `Retail` price. Show as a secondary comparison when it is higher than Dealer Price.
- `finance_price`: DriveTown `Financed Price` when present, otherwise `adjusted_finance_price`.
- `source_price_payload`: raw source price data for audit/debugging, including DriveTown price types and source price fields.

Do not expose DriveTown `Cost` as public pricing.

## Frontend Behavior

Inventory cards and list rows show Dealer Price as the primary price. If `retail_price > price`, show Retail Price as muted secondary text. The vehicle detail page shows a clear price block with Dealer Price primary and a compact breakdown for Retail Price and Finance Price when available. The payment calculator continues to use `price`.

## Sync Behavior

DriveTown scraper extracts structured price fields from the inventory payload. The sync worker writes those fields into `edc_vehicles` marketplace price columns. Existing editable-field preservation remains intact, so admin/dealership manual edits are not overwritten when the row was edited after the last sync.

## Migration

Add nullable columns to `public.edc_vehicles`:

- `retail_price numeric`
- `finance_price numeric`
- `source_price_payload jsonb not null default '{}'::jsonb`

The SQL migration is idempotent and must be applied before deploying frontend selects that request the new columns.
