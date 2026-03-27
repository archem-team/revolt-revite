# PepChat Directory — backend APIs

This document lists APIs needed to serve the **PepChat Directory** home page (public landing at `/` for guests, and `/directory` for everyone). The UI is implemented in `src/pages/directory/Directory.tsx` with seed data in `src/pages/directory/data.json`.

Today the page uses **bundled JSON** for listings and reviews, **client-side** search/sort/filter, **in-memory** review submissions, and **localStorage** for listing submissions. A production backend would replace those with the endpoints below.

---

## 1. Related client behavior (not Directory-specific)

| Concern | Source today | Notes |
|--------|----------------|-------|
| “Open Chat” vs “Log In / Register” | `clientController.isLoggedIn()` | Uses the existing Revolt/PepChat **session** (no new Directory API). |

---

## 2. Data shapes (for request/response contracts)

Align with the TypeScript interfaces in `Directory.tsx` and fields in `data.json`.

### 2.1 Vendor (manufacturer)

- `id` (string)
- `name` (string)
- `url` (string, host or full URL — UI prepends `https://` when linking)
- `rating` (number, e.g. 0–5, typically aggregated from reviews)
- `payment`: `{ cc, btc, pp, zelle, venmo, bt, chk }` (booleans)
- `warehouses`: `{ us, eu, aus }` (booleans)
- `products`: `{ pep, oil, tabs, raw, amn, sup }` (booleans)
- `shippingRoutes` (string)
- `shippingTime` (string)
- `freeShipping` (boolean)
- `freeShippingThreshold` (string, may be empty when no free shipping)
- `notes` (string, optional)

### 2.2 Reseller

Same as vendor plus:

- `orderTypes`: `{ single, halfkit, fullkit }` (booleans)

### 2.3 Review

- `id` (string)
- `vendorId` (string)
- `vendorType`: `"vendor"` | `"reseller"`
- `reviewerName` (string)
- `rating` (integer 1–5)
- `text` (string)
- `date` (ISO date string, e.g. `YYYY-MM-DD`)

### 2.4 Listing submission (user-submitted vendor/reseller)

Matches `SubmitForm` in the UI:

- `type`: `"vendor"` | `"reseller"`
- `name` (string, required)
- `url` (string, optional in UI validation)
- `payment`, `warehouses`, `products` (same boolean maps)
- `orderTypes` (for resellers; same shape as reseller)
- `notes` (string, optional)

Server should also store: submission id, `submittedAt`, and moderation state (`pending` | `approved` | `rejected`).

---

## 3. Public read APIs

### 3.1 List vendors

- **Purpose:** Populate the “Vendors” tab (table + cards).
- **Suggested:** `GET /api/directory/vendors`
- **Query parameters (optional):** mirror UI filters/search/sort so large lists can be server-paginated:
  - `q` — search `name` / `url`
  - `us`, `eu`, `aus` — warehouse flags (boolean)
  - `cc`, `crypto` (maps to `payment.btc`), `freeShipping`
  - `raw`, `oil`, `amn`, `sup` — product flags
  - `sort` — e.g. `rating` | `name`
  - `order` — `asc` | `desc`
  - `page`, `pageSize` or `cursor` — pagination
- **Response:** `{ items: Vendor[], total?: number, nextCursor?: string }`

### 3.2 List resellers

- **Purpose:** Populate the “Resellers” tab.
- **Suggested:** `GET /api/directory/resellers`
- **Query parameters:** same idea as vendors; include filters that apply to `orderTypes` if you add them server-side later.
- **Response:** `{ items: Reseller[], ... }`

### 3.3 List reviews for a listing

- **Purpose:** Reviews modal — list reviews for one `vendorId` + `vendorType`.
- **Suggested:** `GET /api/directory/reviews?vendorId={id}&vendorType={vendor|reseller}`
- **Optional:** `page`, `pageSize` for long threads.
- **Response:** `{ items: Review[], total?: number }`

### 3.4 Optional: single listing detail

Not required by the current UI (cards expand in place), but useful for deep links later:

- `GET /api/directory/vendors/:id`
- `GET /api/directory/resellers/:id`

---

## 4. Public write APIs (user-generated content)

### 4.1 Submit a review

- **Purpose:** “Leave a Review” in the reviews modal.
- **Suggested:** `POST /api/directory/reviews`
- **Body:** `{ vendorId, vendorType, reviewerName, rating, text }`
- **Response:** created `Review` (including server-assigned `id`, `date`) or validation error.
- **Server concerns:** rate limiting, spam/abuse, optional moderation queue, recalculate listing `rating` aggregate.

### 4.2 Submit a listing for moderation

- **Purpose:** FAB “Submit a Listing” modal (replaces `localStorage` key `pepchat_pending_submissions`).
- **Suggested:** `POST /api/directory/submissions`
- **Body:** listing submission payload (section 2.4).
- **Response:** `{ id, status: "pending", submittedAt }` or error.

---

## 5. Admin / moderation APIs (recommended for production)

The UI does not call these yet; they support operating the directory safely.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/directory/admin/submissions?status=pending` | Review queue for new listings |
| `PATCH /api/directory/admin/submissions/:id` | Approve → create vendor/reseller record; reject with reason |
| `GET /api/directory/admin/reviews?status=pending` | Optional review moderation queue |
| `PATCH /api/directory/admin/reviews/:id` | Approve / hide / delete |
| `PATCH /api/directory/admin/vendors/:id` (and resellers) | Edit curated fields, deactivate listing |

Protect with **staff/admin auth** (separate from public Directory reads).

---

## 6. Summary checklist

| # | Method | Path | Role |
|---|--------|------|------|
| 1 | GET | `/api/directory/vendors` | Published vendors (+ optional query/pagination) |
| 2 | GET | `/api/directory/resellers` | Published resellers (+ optional query/pagination) |
| 3 | GET | `/api/directory/reviews` | Reviews for one listing |
| 4 | POST | `/api/directory/reviews` | New review |
| 5 | POST | `/api/directory/submissions` | New listing submission |
| — | — | Existing auth/session APIs | Nav: logged-in vs guest (not Directory-specific) |
| 6+ | * | `/api/directory/admin/...` | Moderation and curation (recommended) |

Path prefix (`/api/directory`) is illustrative; use your gateway and versioning conventions.

---

## 7. Implementation notes

- **Aggregated `rating`:** Either maintain on write (when reviews change) or compute in read paths; the UI expects a single number per listing.
- **URL field:** Normalize to a canonical host or URL on the server; validate format and optionally block malicious URLs.
- **Caching:** Public GETs are good CDN/cache candidates; invalidate or short TTL when listings change.
- **i18n:** Copy in the hero, footer, and modals is static in the component today; API error messages may need localization if exposed to users.
