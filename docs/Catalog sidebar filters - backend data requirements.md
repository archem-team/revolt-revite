# Catalog sidebar filters — backend data requirements

## Context

The catalog shopper page (`src/pages/home/Catalog.tsx` + `src/pages/home/catalog/`)
today shows only two left-sidebar filters:

- **Dosage** facet — from `GET /catalog/dosages` (`DosageInfo[]`)
- **Price** min/max — server-side via `/catalog?minPrice&maxPrice`

We want a marketplace-grade sidebar with vendor and vendor-attribute filters
(verified, rating, location, payment, free-ship, guarantees, category). The rich
vendor attributes already exist in the directory system (`GET /directory/communities`,
shaped as `VendorCommunity` in `src/pages/directory/types.ts:68`) but are **not**
exposed through the catalog API, and `/catalog` cannot filter by them.

**This note tells backend what data + params the catalog API must provide** so the
frontend can build the sidebar. Nothing here is implementable frontend-side until
backend ships these.

---

## What the frontend has today

`GET /catalog?q&dosage&minPrice&maxPrice&sort&page&pageSize` → paginated `CatalogItem[]`
```
CatalogItem { id, serverId, vendorName, product, normalized, compound,
              fromPrice, toPrice, currency, categories[], createdAt }
```
`GET /catalog/vendors` → lightweight facet:
```
VendorInfo { serverId, name, logo, inviteLink, productCount, categories[] }
```
`GET /catalog/dosages` → `DosageInfo { dosage, count, vendorCount }[]`

Products link to vendors by `serverId`. Rich vendor attributes are only in
`/directory/communities`, keyed by the same `serverId`.

---

## What backend needs to provide

### 1. New filter query params on `GET /catalog` (server-side filtering)

Add these params. Each filters the returned product list. Multi-value = repeated
param or comma-separated (state which you implement).

| Param | Type | Meaning | Source field |
|-------|------|---------|--------------|
| `vendor` / `serverId` | string (multi) | Only products from these vendors | product.serverId — **admin already uses `serverId`** |
| `category` | string (multi) | Products in these categories | product.categories[] |
| `verified` | bool | Vendor is verified | community.verified |
| `minRating` | number 0–5 | Vendor rating ≥ value | community.rating |
| `warehouse` | enum multi: `us,eu,aus,cn` | Vendor ships from location | community.warehouses |
| `payment` | enum multi: `cc,crypto` | Vendor accepts payment method | community.payment (cc, btc) |
| `freeShipping` | bool | Vendor offers free shipping | community.freeShipping |
| `guarantee` | enum multi: `purity,volume,reship` | Vendor offers guarantee | community.guarantees |

Notes:
- These must filter by the **vendor** attached to each product (join product.serverId
  → community). Frontend cannot do this efficiently across paginated results.
- `sort` already supports `newest,name,price_asc,price_desc`. Add `rating` (vendor
  rating desc) to match directory sort.

### 2. Enrich `GET /catalog/vendors` OR add `GET /catalog/facets`

The sidebar needs, per facet value, a **label + product count** to render rows like
"US (142)". Two options — backend picks one:

**Option A — enrich `/catalog/vendors`** (simplest): add vendor-quality attrs so
frontend derives facet counts client-side:
```
VendorInfo {
  serverId, name, logo, inviteLink, productCount, categories[],
  verified: bool,
  rating: number,          // 0–5
  warehouses: { us, eu, aus, cn: bool },
  payment:    { cc, btc: bool },
  freeShipping: bool,
  guarantees: { purity, volume, reship: bool }
}
```

**Option B — dedicated `GET /catalog/facets`** (better at scale): returns each facet
with pre-counted buckets reflecting the **current** query, e.g.
```
{ success: true, data: {
    vendors:    [{ serverId, name, count }],
    categories: [{ value, count }],
    warehouses: [{ value: "us", count }],
    payment:    [{ value: "cc", count }],
    guarantees: [{ value: "purity", count }],
    verifiedCount, freeShippingCount,
    ratingBuckets: [{ min: 4, count }]
}}
```

Preferred: **Option B** — counts stay correct as filters narrow. If time-boxed,
Option A unblocks the UI immediately.

### 3. Field additions summary (minimum viable)

If backend can only do one thing first: **add vendor attrs to `/catalog/vendors`
(Option A)** + accept the **query params in §1**. That unblocks the entire sidebar;
facet counts can be approximated frontend-side until §2 Option B lands.

---

## Frontend plan (once backend ships the above)

- Extend `VendorInfo` in `src/pages/home/catalog/utils.ts:47` with the new attrs.
- Add facet sections to `CatalogSidebar` / `MobileFilters`
  (`src/pages/home/catalog/Filters.tsx`), reusing the existing `Row`/`Chip`
  styled components and the `COMMERCE_FILTERS` label/emoji definitions from
  `src/pages/directory/types.ts:197`.
- Add state + query-param wiring in `Catalog.tsx` alongside existing
  `selectedDosage`/`minPrice`/`maxPrice` (`Catalog.tsx:50-53`, params built at
  `:120-127`), plus reset-to-page-1 effect (`:110-112`) and `clearFilters` (`:161`).
- Sort dropdown: add `rating` option (`Catalog.tsx:200`).

## Verification (post-implementation)

- `yarn dev` → open Home → `?tab=catalog`.
- Toggle each facet, confirm the `/catalog?…` request carries the param
  (network tab) and results narrow correctly.
- Confirm facet counts match narrowed results (if Option B).
- `yarn typecheck` + `yarn lint`.

---

## Open item for backend

Confirm which option (§2 A vs B) and whether §1 params are comma-separated or
repeated. Frontend blocks on the shape of `/catalog/vendors` (or `/catalog/facets`)
and the accepted `/catalog` params.
