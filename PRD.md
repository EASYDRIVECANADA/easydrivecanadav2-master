# Product Requirements Document (PRD)
## EasyDrive Canada v2 — Online Used Car Marketplace & Dealership Management System

| Field | Value |
|---|---|
| **Product Name** | EasyDrive Canada v2 |
| **Version** | 2.0 |
| **Audit Date** | 2026-04-01 |
| **Platform** | Web (Next.js 14, deployed on Netlify) |
| **Database** | Supabase (PostgreSQL + Storage + Auth) |
| **Payments** | Stripe (subscriptions, e-sign credits, user seat charges) |
| **Domain** | https://easydrivecanada.com |

---

## 1. System Overview

### 1.1 Purpose
EasyDrive Canada is a B2B2C SaaS platform enabling Canadian used-car dealerships (and private sellers) to manage vehicle inventory, create sales deals, generate disclosures, collect e-signatures, and publicly list vehicles for consumer purchase — all from a single web application.

### 1.2 Target Users

| Role | Description |
|---|---|
| **Public Visitor (Guest)** | End consumer browsing inventory, applying for financing, or contacting the dealership. |
| **Registered Customer** | Authenticated user who can place vehicle holds, initiate purchases, and complete identity verification. |
| **Admin / Dealer Staff** | Dealership employee managing inventory, deals, customers, reports, and settings. |
| **Admin Owner / Premier** | Dealership owner with full access including billing, user management, and subscription control. |

### 1.3 Core Value Proposition
- 100% online car-buying experience for consumers with transparent pricing
- Full dealership management suite: inventory, sales deals, disclosures, costs, warranty, e-signatures
- Multi-tier subscription model (Private Seller, Small/Medium/Large Dealership, Premier)
- Public marketplace with rich vehicle detail pages and social media link previews

---

## 2. Architecture Summary

### 2.1 Technology Stack

| Layer | Technology |
|---|---|
| Frontend Framework | Next.js 14.2 (App Router) |
| UI Framework | Tailwind CSS 3.4 + custom design system |
| Language | TypeScript 5 |
| Auth | Supabase Auth (Google OAuth + email/password) |
| Database | Supabase PostgreSQL |
| File Storage | Supabase Storage (vehicle-photos, Carfax, Files buckets) |
| Payments | Stripe (subscriptions, one-time charges, webhooks) |
| PDF Generation | jsPDF, pdfjs-dist |
| Animations | Framer Motion |
| Excel Export | xlsx-js-style |
| Image Processing | heic2any (HEIC/iPhone support) |
| Hosting | Netlify (with serverless functions for API routes) |
| External Integrations | VinCario (VIN decode), N8N webhooks (license scanning, validation, forgot-password) |

### 2.2 Project Structure (182 source files)

```
client/src/
  app/
    (root)            — Home page, layout, globals.css
    account/          — Login, verification, reset-password
    inventory/        — Public vehicle listing + detail pages
    contact/          — Contact form
    financing/        — Financing application form
    purchase/[vehicleId]/ — Vehicle purchase flow (deposit, hold)
    sign/[id]/        — E-signature signing page
    forgot-password/  — Password reset request
    admin/
      (dashboard)     — Admin home with analytics charts
      inventory/      — Vehicle list, detail (8 tabs), photos, add new
      marketplace/    — Cross-dealership marketplace browser
      sales/          — Deals list, new deal, deal adjustor, showroom, signatures
      customers/      — Customer management alias
      costumer/       — Customer CRM (info, credit app, history)
      leads/          — Lead management
      vendors/        — Vendor/import management
      users/          — Staff user management
      esignature/     — E-signature management + prepare
      billing/        — Billing shortcut
      reports/        — Sales + Inventory reports (7 report types)
      settings/       — Dealership, billing, users, integrations, presets, reports
      import/         — Data import (vendor alias)
    api/              — 74 API routes (see Section 2.3)
  components/         — Shared: Header, Footer, VehicleCard, HomeGate, home/ sections
  lib/                — supabaseClient, apiAuth (admin session guard), phase3Mock (purchase hold system), animations
  types/              — TypeScript type definitions
  middleware.ts       — Social bot detection for OG tag serving
```

### 2.3 API Routes (74 total)

| Category | Routes | Purpose |
|---|---|---|
| **Vehicles** | `/api/vehicles`, `/api/vehicles/[id]`, `/api/inventory-add`, `/api/delete`, `/api/vincode` | CRUD, VIN decode |
| **Deals** | `/api/deals`, `/api/deals/[id]`, `/api/deals/insert`, `/api/deals/update`, `/api/deals/delete`, `/api/deals-disclosures`, `/api/deals_disclosures`, `/api/vehicles-deals` | Full deal lifecycle |
| **E-Signature** | `/api/esignature`, `/api/esignature/fields`, `/api/esignature/signature/[id]/*`, `/api/esignature/signatures`, `/api/esignature/signature-by-email` | Document signing workflow |
| **E-Sign Wallet** | `/api/esign/wallet`, `/api/esign/buy-with-balance`, `/api/esign/deduct-credit`, `/api/esign/unlimited/buy-with-balance` | Credit-based e-sign billing |
| **Stripe** | `/api/stripe/checkout`, `/api/stripe/webhook`, `/api/stripe/subscription-status`, `/api/stripe/invoices`, `/api/stripe/payment-methods`, `/api/stripe/setup-payment-method`, `/api/stripe/add-user-checkout`, `/api/stripe/topup-checkout`, `/api/stripe/topup-confirm`, `/api/stripe/esignature-checkout` | Full Stripe integration |
| **Users/Auth** | `/api/users-login`, `/api/users/get-role`, `/api/users/balance`, `/api/users/check-limit`, `/api/users/charge-add-user`, `/api/forgot-password`, `/api/reset-password` | Auth, role management, password reset |
| **Public Forms** | `/api/leads` | Contact form + financing application submissions → `edc_leads` table |
| **Inventory Tabs** | `/api/disclosures`, `/api/updatedisclosures`, `/api/purchase`, `/api/updatepurchase`, `/api/costs`, `/api/costs-save`, `/api/warranty`, `/api/save-idinfo` | Tab data persistence |
| **Reports** | `/api/reports/inventory/*` (5), `/api/reports/sales/*` (2) | Report data endpoints |
| **Other** | `/api/email`, `/api/delivery`, `/api/generate`, `/api/image`, `/api/import`, `/api/addvendor`, `/api/vendors-webhook`, `/api/worksheet`, `/api/validation`, `/api/proxy/*`, `/api/og/[id]` | Misc functions |
| **Subscription** | `/api/simple-expiry`, `/api/subscription/check-expiry`, `/api/debug-expiry`, `/api/test-expiry`, `/api/webhook/add` | Subscription lifecycle |

---

## 3. Feature Specifications

### 3.1 Public Website (Guest / Consumer)

| ID | Feature | Description | Status |
|---|---|---|---|
| PUB-01 | **Home Page** | Hero banner, featured vehicles, features grid, how-it-works, benefits, FAQ, CTA. SEO structured data (LocalBusiness). | Done |
| PUB-02 | **Vehicle Inventory (Shop Cars)** | Full inventory grid with search, sort (6 options), filters (make, body style, color, features, price range, year range, collection). Pagination (12/page). Bucket-based image loading. | Done |
| PUB-03 | **Vehicle Detail Page** | Full-screen image gallery with thumbnails, complete specs grid, "On Hold" badge, category badges, CARFAX badge (dynamic), trust badges, financing CTA, disclosure viewer. | Done |
| PUB-04 | **Contact Page** | Contact form (name, email, phone, subject, message), map embed, quick contact cards (location, phone, email, hours). | Done |
| PUB-05 | **Financing Application** | Multi-field credit application: personal info, financial info, address. Submissions go to leads API. Postal code auto-uppercase, money-field input guards. | Done |
| PUB-06 | **Vehicle Purchase Flow** | Deposit-based hold system (72-hour timer), on-hold states (DEPOSIT_REQUIRED, ON_HOLD, CANCELLED, AWAITING_BALANCE), Stripe payment integration. Requires verified account. | Done |
| PUB-07 | **E-Signature Signing** | Public signing page for recipients. PDF rendering, signature pad (draw/type/upload), field placement, multi-page support. | Done |
| PUB-08 | **Account / Login** | Google OAuth + email/password login, admin redirect for verified dealers. | Done |
| PUB-09 | **Account Verification** | Driver license upload + AI scanning (N8N webhook), identity info form, admin verification status. | Done |
| PUB-10 | **Password Reset** | Forgot password flow via N8N webhook. | Done |
| PUB-11 | **OG Link Previews** | Dynamic Open Graph tags for vehicle pages shared on social media (Discord, Facebook, iMessage, WhatsApp, etc.) via middleware + API route. | Done |
| PUB-12 | **SEO** | Schema.org structured data, metadataBase, dynamic per-vehicle metadata via generateMetadata. | Done |

### 3.2 Admin Panel — Core Modules

| ID | Feature | Description | Status |
|---|---|---|---|
| ADM-01 | **Dashboard** | Weekly vehicle registration chart (bar chart with drill-down), Google OAuth login with admin role detection, subscription expiry check on load. | Done |
| ADM-02 | **Admin Layout / Sidebar** | Collapsible sidebar, nested navigation (Sales, Reports sub-menus), profile image, sign-out modal, role-based session from localStorage. | Done |
| ADM-03 | **Inventory List** | Full vehicle table with search, status filter (8 statuses), pagination, items-per-page selector, category tabs (Premier/Fleet), bulk select, bulk delete, Excel export, add vehicle modal with VIN decode. Role-based vehicle limits. | Done |
| ADM-04 | **Inventory Detail (8 tabs)** | Tabbed vehicle editor: Vehicle Details, Disclosures, Purchase, Costs, Warranty, Images, Files, CARFAX. | Done |
| ADM-04a | — Vehicle Details Tab | 50+ fields: make, model, year, VIN, price, odometer, transmission, drivetrain, body style, colors, features (multi-select), condition, feeds (Autotrader/Carpages/CarGurus), and more. | Done |
| ADM-04b | — Disclosures Tab | Multi-category disclosure form (vehicle history, mechanical, structural, financial). PDF generation. | Done |
| ADM-04c | — Purchase Tab | Purchase record management (~1769 lines). | Done |
| ADM-04d | — Costs Tab | Cost tracking for vehicle reconditioning, transport, fees (~1051 lines). | Done |
| ADM-04e | — Warranty Tab | Warranty information management. | Done |
| ADM-04f | — Images Tab | Drag-drop image upload, reorder, delete. HEIC/iPhone support via heic2any conversion. Bucket-based storage. | Done |
| ADM-04g | — Files Tab | General file upload/management per vehicle. | Done |
| ADM-04h | — CARFAX Tab | CARFAX report upload per vehicle. Dynamic badge on public pages. | Done |
| ADM-05 | **Vehicle Photos Page** | Dedicated full-page photo manager (upload → auto-redirect to disclosures). | Done |
| ADM-06 | **Marketplace** | Cross-dealership vehicle browser. Vehicle detail modal with image gallery, specs, disclosure viewer, CARFAX badge. | Done |

### 3.3 Admin Panel — Sales Module

| ID | Feature | Description | Status |
|---|---|---|---|
| SAL-01 | **Deals List** | Full deals table with search, state filter, show/hide closed deals, pagination, drill-down detail panel (customer info, profit). Admin-only delete. | Done |
| SAL-02 | **New Deal** | Multi-step deal creation wizard (~1137 lines). | Done |
| SAL-03 | **Deal Adjustor** | Post-sale deal adjustment tool (~847 lines). | Done |
| SAL-04 | **Showroom** | Showroom management interface (~988 lines). | Done |
| SAL-05 | **Deal Signature** | Deal-specific signature workflow (~1158 lines). | Done |
| SAL-06 | **Sales Landing** | Redirect to deals list (31 lines). | Done |

### 3.4 Admin Panel — E-Signature Module

| ID | Feature | Description | Status |
|---|---|---|---|
| SIG-01 | **E-Signature Dashboard** | Signature request management, document upload, recipient management, status tracking, credit/wallet system. | Done |
| SIG-02 | **Prepare Document** | Drag-and-drop field placement on PDF documents for signing. | Done |
| SIG-03 | **E-Sign Wallet** | Credit-based system: per-use, bundle, or unlimited plans. Stripe integration for purchasing credits. | Done |

### 3.5 Admin Panel — CRM & Leads

| ID | Feature | Description | Status |
|---|---|---|---|
| CRM-01 | **Customer Management** | Customer list with tabs: Customer Information, Credit Application, History. PDF consent generation. | Done |
| CRM-02 | **Leads** | Lead management from contact forms and financing applications (~657 lines). | Done |

### 3.6 Admin Panel — Reports (7 report types)

| ID | Feature | Description | Status |
|---|---|---|---|
| RPT-01 | **Reports Hub** | Landing page with links to all report categories. | Done |
| RPT-02 | **Garage Register** | Inventory registration report. | Done |
| RPT-03 | **Inventory Costs** | Cost analysis by vehicle. | Done |
| RPT-04 | **Inventory Value** | Portfolio valuation report. | Done |
| RPT-05 | **Key List** | Key tracking report. | Done |
| RPT-06 | **Purchase Summary** | Purchase history report. | Done |
| RPT-07 | **Sales Report** | Sales performance report (~452 lines). | Done |
| RPT-08 | **Transaction Fee Report** | Fee tracking report. | Done |

### 3.7 Admin Panel — Settings

| ID | Feature | Description | Status |
|---|---|---|---|
| SET-01 | **Dealership Settings** | Business information, logo, contact details (~904 lines). | Done |
| SET-02 | **Billing** | Stripe subscription management, invoices, payment methods, plan switching, add user charges (~1364 lines). | Done |
| SET-03 | **Users** | Staff user management, add/edit/disable users, role assignment (~1314 lines). | Done |
| SET-04 | **Integrations** | Third-party integrations (Lubrico, CarGurus, Carpages, AutoTrader, Kijiji, eDealer, SiriusXM). Displays "Coming Soon" placeholder — not yet functional. | Coming Soon |
| SET-05 | **Presets** | Configurable presets for deal forms and workflows (~3098 lines). | Done |
| SET-06 | **Reports Settings** | Report configuration and customization (~978 lines). | Done |

### 3.8 Admin Panel — Other Modules

| ID | Feature | Description | Status |
|---|---|---|---|
| OTH-01 | **Vendors** | Vendor/import source management with VendorsList component. | Done |
| OTH-02 | **Import** | Data import (aliases to VendorsList). | Done |
| OTH-03 | **Users (standalone)** | Standalone user management page (~402 lines). | Done |
| OTH-04 | **Admin Account** | Admin account settings page. | Done |

---

## 4. User Flows

### 4.1 Guest → Vehicle Purchase
```
Home → Shop Cars → Vehicle Detail → Create Account → Verify Identity →
  Place Hold (Deposit $1,000) → 72h Hold Timer → Pay Balance → Purchase Complete
```

### 4.2 Guest → Financing
```
Home → Get Pre-Approved → Fill Application → Submit → Lead Created → Dealer Follow-up
```

### 4.3 Dealer → Inventory Management
```
Login (Google/Email) → Admin Dashboard → Inventory → Add Vehicle (VIN decode) →
  Fill Details → Upload Photos → Add Disclosures → Set Costs → Publish (status: In Stock)
```

### 4.4 Dealer → Sales Deal
```
Admin → Sales → Deals → New Deal → Select Vehicle + Customer →
  Fill Worksheet → Generate Disclosures → E-Sign Documents → Complete Deal
```

### 4.5 Dealer → E-Signature Flow
```
Admin → E-Signature → Upload Document → Add Fields (drag-drop) →
  Add Recipients → Send for Signing → Recipients Sign (public /sign/[id]) → Completed
```

---

## 5. Acceptance Criteria (Key Features)

| Feature | Criteria | Pass/Fail |
|---|---|---|
| Vehicle listing | Vehicles with status "In Stock" appear on /inventory with images from Supabase bucket | PASS |
| Search & filter | Search by year/make/model returns correct results; filters narrow correctly | PASS |
| Vehicle detail | All specs displayed, image gallery functional, CARFAX badge dynamic | PASS |
| OG link preview | Sharing vehicle URL on Discord/Facebook shows car image + title + price | PASS (pending deployment) |
| VIN decode | Entering VIN in add-vehicle modal populates year, make, model, trim | PASS |
| Image upload | JPEG, PNG, WEBP, HEIC files upload; HEIC auto-converted to JPEG | PASS |
| E-signature | PDF renders, fields placeable, signature pad works, multi-party signing | PASS |
| Stripe subscription | Plan selection → Stripe checkout → webhook updates role | PASS |
| Reports export | All 7 report types fetch data and render tables | PASS |
| Admin auth | Google OAuth + email/password login; role-based access; subscription expiry check | PASS |
| Customer CRM | Create/edit/delete customers; credit app; consent PDF generation | PASS |
| Deal lifecycle | Create → adjust → sign → close deals with full data persistence | PASS |
| Contact form | Contact form submissions saved to `edc_leads` via `/api/leads` | PASS |
| Financing form | Financing applications saved to `edc_leads` via `/api/leads` | PASS |
| Password reset | Reset-password flow uses `/api/reset-password` with SHA-256 hashed storage | PASS |
| Password security | Admin login stores/validates SHA-256 hashed passwords; on-the-fly migration from plaintext | PASS |
| API auth guard | Destructive API routes (`/api/delete`, `/api/deals/delete`) require valid admin session headers | PASS |

---

## 6. Priority & Roadmap (MoSCoW)

### Must Have (Implemented)
- Vehicle inventory CRUD with multi-tab detail editor
- Public vehicle listing with search/filter/sort
- Stripe subscription billing (multi-tier)
- Sales deals with full lifecycle
- E-signature system with wallet/credits
- Reports (7 types)
- Customer CRM with credit application
- Admin dashboard with analytics

### Should Have (Implemented / Partial)
- OG link previews for social sharing (implemented, needs deployment verification)
- HEIC image upload support (implemented)
- Dynamic CARFAX badge (implemented)

### Could Have (Not Yet Implemented)
- Third-party inventory feed integrations (AutoTrader, CarGurus, Carpages, Kijiji, eDealer, Lubrico, SiriusXM) — currently "Coming Soon"
- Real-time notifications (in-app, email)
- Customer-facing purchase portal with full Stripe checkout
- Mobile app or PWA wrapper
- Automated feed export to AutoTrader/CarGurus/Carpages
- Multi-language support (French)
- Advanced analytics dashboard with charts for sales/revenue

### Won't Have (This Version)
- Vehicle trade-in estimator
- AI-powered pricing suggestions
- Chat/messaging system
- Auction functionality

---

## Appendix A: Database Tables Referenced

| Table | Purpose |
|---|---|
| `edc_vehicles` | Core vehicle inventory |
| `edc_admin_users` | Admin user accounts |
| `edc_account_verifications` | Customer identity verification |
| `users` | User accounts (login, roles, e-sign credits) |
| `edc_deals_customers` | Deal customer records |
| `edc_deals_vehicles` | Deal vehicle records |
| `edc_deals_worksheets` | Deal financial worksheets |
| `edc_deals_disclosures` | Deal disclosure records |
| `edc_deals_delivery` | Deal delivery records |
| `edc_customers` | CRM customer records |
| `edc_esignatures` | E-signature envelope records |
| `edc_esignature_recipients` | Signing recipients |
| `edc_esignature_fields` | Document field placements |
| `edc_vendors` | Vendor records |
| `edc_leads` | Contact form and financing application submissions |

## Appendix B: Supabase Storage Buckets

| Bucket | Purpose |
|---|---|
| `vehicle-photos` | Vehicle images (prefix: `{vehicle_db_id}/`) |
| `Carfax` | CARFAX reports (prefix: `{vehicleId}/`) |
| `vehicle-files` | General vehicle documents |
| `profile-pictures` | User profile images |
| `esign-documents` | E-signature source documents |

---

*Document generated by automated system audit on 2026-04-01.*
