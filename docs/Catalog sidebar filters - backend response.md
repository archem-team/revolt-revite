# Catalog sidebar filters — backend response to FE

**Status: shipped to staging** (`https://a-pep.peptide.chat/api`) on 2026-07-13.
This answers the open items in *Catalog sidebar filters - backend data requirements.md*.

## TL;DR — answers to your open questions

- **Multi-value params:** **comma-separated** (e.g. `?warehouse=us,eu`), not repeated. One
  convention everywhere.
- **§2 shape:** **Option A** — `GET /catalog/vendors` is enriched with vendor attributes
  (including `verified`). No dedicated `/catalog/facets` endpoint yet (Option B deferred; ask
  if you need query-aware counts at scale).
- **Almost all of your §1 already existed** (shipped in earlier catalog commits). This round
  added the two missing pieces: **`verified`** and **multi-value `serverId`**.

---

## `GET /catalog` — filter params

All optional. Multi-value = comma-separated. Every param filters the returned product list.
Vendor-attribute params (warehouse/payment/guarantee/rating/freeShipping/verified) filter by
the **vendor** attached to each product (backend joins `product.serverId` → directory/servers).

| Param | Type | Meaning |
|-------|------|---------|
| `q` | string | Text search over product name |
| `serverId` | string (multi, comma) | Only products from these vendors. Single value = exact match; multiple = union |
| `category` | string (multi, comma) | Products in these categories |
| `compound` | string | Exact compound name (case-insensitive) |
| `dosage` | string | Variation dosage, e.g. `10mg` (whitespace-insensitive) |
| `minPrice` / `maxPrice` | number | Price range on `fromPrice` |
| `verified` | bool | **NEW** — only verified vendors |
| `minRating` | number 0–5 | Vendor rating ≥ value |
| `warehouse` | enum multi: `us,eu,aus,cn` | Vendor ships from any of these |
| `payment` | enum multi: `cc,btc,pp,zelle,venmo,bt,chk` | Vendor accepts any of these |
| `guarantee` | enum multi: `purity,volume,reship` | Vendor offers any of these |
| `vendorProduct` | enum multi: `pep,oil,tabs,raw,amn,sup,aas` | Vendor sells these product types |
| `minPurityPct` | number | Vendor purity guarantee ≥ value |
| `freeShipping` | bool | Vendor offers free shipping |
| `sort` | enum: `newest`(default)`,name,price_asc,price_desc` | Sort order |
| `page` / `pageSize` | number | Pagination (pageSize default 50, max 200) |

Notes:
- Combining `serverId` with vendor-attribute filters **intersects** (AND). Example: a serverId
  whose vendor is not verified + `verified=true` → 0 results.
- Multi-value groups are OR within a param, AND across params (matches directory behaviour).
- Invalid enum token → HTTP **400** `FailedValidation`.
- `sort=rating` (vendor rating) is **not yet supported** — only the four values above. Flag if
  you need it for launch.

### Sample — `GET /catalog?verified=true&pageSize=1`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "C7F5E13D48AB4BBF8DFC164DBA",
        "serverId": "01J8GZYC66E5T7PZNYVHD4DC6V",
        "vendorName": "GYC",
        "product": "T-20 (US)",
        "normalized": "t-20 (us)",
        "compound": "T-20",
        "fromPrice": 110.0,
        "toPrice": null,
        "currency": "USD",
        "categories": ["Peptides"],
        "createdAt": "2026-07-09T18:02:24.509086Z"
      }
    ],
    "pagination": { "page": 1, "pageSize": 1, "total": 822, "totalPages": 822 }
  }
}
```

`toPrice` is omitted when the product has a single variation (single price).

---

## `GET /catalog/vendors` — facet source (Option A)

Returns every vendor with a product in the catalog, enriched with directory + server
attributes. Derive your sidebar facet counts client-side from this list. Accepts the same
vendor-attribute filter params as `/catalog` (`warehouse`, `payment`, `guarantee`, `minRating`,
`freeShipping`, `verified`, `vendorProduct`, `minPurityPct`) plus `q` (vendor name search).

Per-vendor fields:
- `serverId`, `name`, `logo?`, `inviteLink?`, `productCount`, `categories[]`
- `verified` — **NEW**, bool (`servers.flags == 2`); absent if vendor has no server record
- `rating` — 0–5
- `warehouses { us, eu, aus, cn }` — bools
- `payment { cc, btc, pp, zelle, venmo, bt, chk }` — bools
- `guarantee { purity, purityPct?, volume, volumePct?, reship, reshipDesc }`
- `shippingTime?`, `freeShipping?`, `freeShippingThreshold?`

Any directory-sourced field (`warehouses`, `payment`, `guarantee`, `shippingTime`,
`freeShipping`, `rating`, …) is **absent when the vendor has no directory listing** — treat as
unknown, not false.

### Sample — one row of `GET /catalog/vendors`

```json
{
  "serverId": "01KTXBNQS74WVEYE0FR57P6G7Y",
  "name": "BO-Peptide",
  "inviteLink": "https://peptide.chat/invite/qA14Ef6W",
  "productCount": 79,
  "categories": ["GLP-1", "Peptides"],
  "warehouses": { "us": false, "eu": false, "aus": false, "cn": true },
  "payment": { "cc": false, "btc": true, "pp": false, "zelle": false, "venmo": false, "bt": true, "chk": false },
  "guarantee": {
    "purity": true, "purityPct": 99.0,
    "volume": true, "volumePct": 90.0,
    "reship": true, "reshipDesc": "Re-ship/Replacement or refund if seized by customs"
  },
  "shippingTime": "7-12 days",
  "freeShipping": true,
  "freeShippingThreshold": 400.0,
  "rating": 0.0,
  "verified": true
}
```

Wrapped as `{ "success": true, "data": [ …vendors… ] }`.

Note the shape differs from the flat bools in your original note request: `payment`/`guarantee`
carry the full directory sub-objects (more fields than `cc,btc` / `purity,volume,reship`). Map
what you need.

---

## Other facet endpoints (unchanged, already live)

- `GET /catalog/categories` → `[{ category, count, vendorCount }]`
- `GET /catalog/compounds` → `[{ compound, count, vendorCount }]`
- `GET /catalog/dosages` → `[{ dosage, count, vendorCount }]`

These are global counts (not narrowed by the current filter set). Query-aware bucket counts
(your §2 Option B) would need the deferred `/catalog/facets` endpoint.

---

## Auth

All catalog endpoints require the `x-session-token` header (standard session auth).

## Not yet available (deferred — request if needed)
- `sort=rating` (vendor rating sort)
- `GET /catalog/facets` (query-aware per-facet counts, your §2 Option B)
