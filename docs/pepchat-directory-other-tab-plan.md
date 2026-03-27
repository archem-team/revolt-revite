# PepChat Directory — Unified Community Model + "Other" Tab

## Corrected Mental Model

**All three tabs are PepChat communities.** The tab is just the community type:

| Tab | Community type | Commerce fields |
|-----|---------------|-----------------|
| Vendors | Manufacturer/seller communities | Full (payment, products, shipping, warehouses) |
| Resellers | Reseller communities | Full + order types |
| Other | General communities (no commercial focus) | Hidden |

This means:
- The current `Vendor` and `Reseller` interfaces are **replaced** by a single `Community` interface
- Community-specific fields (invite link, member count, online count, age, verified, logo) apply to **all three tabs**
- Commerce fields are conditionally shown/required based on `type`
- One MongoDB collection (`directory_communities`) with a `type` discriminator replaces the planned separate `directory_vendors` and `directory_resellers` collections

---

## Unified TypeScript Interface

```ts
// Discriminated union — TypeScript knows which fields exist per type
interface CommunityBase {
    id: string;
    name: string;
    logo?: string;             // optional image URL
    inviteLink: string;        // PepChat invite (e.g. https://rvlt.gg/xxx)
    serverId?: string;         // Revolt server ID for live stat lookup
    ageDays: number;           // computed from createdAt, not stored
    verified: boolean;
    memberCount: number;       // manual fallback (overridden by live API)
    onlineCount: number;       // manual fallback
    rating: number;            // aggregated from reviews
    notes: string;
}

interface VendorCommunity extends CommunityBase {
    type: "vendor";
    url?: string;
    payment: Payment;
    products: Products;        // includes aas
    warehouses: Warehouses;
    shippingTime: string;
    freeShipping: boolean;
    freeShippingThreshold: string;
}

interface ResellerCommunity extends VendorCommunity {
    type: "reseller";
    orderTypes: OrderTypes;
}

interface OtherCommunity extends CommunityBase {
    type: "other";
}

type Community = VendorCommunity | ResellerCommunity | OtherCommunity;
```

---

## AAS Product Class (affects Vendors + Resellers)

Add `aas: boolean` to `Products` interface:
```ts
interface Products {
    pep: boolean; oil: boolean; tabs: boolean;
    raw: boolean; amn: boolean; sup: boolean;
    aas: boolean;   // ← new
}
```
Add to: `PRODUCT_LABELS`, submit modal, filter chips, table columns, card badges, legend.

---

## Card Layout — All Tabs Share Top Section

```
┌──────────────────────────────────────────────────────────────────┐
│  [logo]  Community Name              ✓ Verified    ⭐ 4.8/5 (12) │
│          Age: 234d  Members: 1,204  Online: 87   [Join →]        │
│                                                                   │
│  ─── Shown for Vendor + Reseller only ───                        │
│  Payment:   BTC  CC  PP  ZL  VM                                  │
│  Products:  PEP  AAS  OIL  TABS  RAW  AMN  SUP                  │
│  Countries: US  EU  AUS                                          │
└──────────────────────────────────────────────────────────────────┘
         ▼ expand ▼
  [Vendor/Reseller]: Order Types | Shipping | Free Ship | Notes | [Reviews]
  [Other]:           Notes | [Reviews]
```

### Community fields present on every card (all tabs)
- Logo (thumbnail, optional)
- Community name
- Verified badge (teal ✓ or grey "Unverified")
- Star rating + review count
- Age in days
- Member count (live if `serverId` available, else stored fallback)
- Online count (same logic)
- "Join →" button → opens `inviteLink`

### Commerce section (Vendors + Resellers only)
- Payment methods
- Products (including AAS)
- Countries served

### Expanded section
- Vendors + Resellers: Order Types (resellers only), Shipping time, Free shipping threshold
- All: Notes, Reviews button

---

## Desktop Table Columns

**All tabs:** Rating | Name + Join | Verified | Age | Members | Online

**Vendors + Resellers additionally:** Payment | Products | Countries | Free Ship | Ship Time

**Resellers additionally:** Order Types

**All tabs:** Reviews

---

## Filter Bar

**All tabs:** search by name
**Vendors + Resellers:** warehouse (US/EU/AUS), payment (CC/crypto), product (raw/oil/aas/amn/sup), free shipping
**Other tab:** no commerce filters (show empty filter bar or hide it)

---

## Submit Form

```ts
interface SubmitForm {
    type: "vendor" | "reseller" | "other";
    name: string;
    inviteLink: string;       // required for all
    serverId?: string;        // optional — "Revolt Server ID for live stats"
    url?: string;             // optional website URL (vendor/reseller)
    payment?: Payment;        // vendor + reseller
    warehouses?: Warehouses;  // vendor + reseller
    products?: Products;      // vendor + reseller
    orderTypes?: OrderTypes;  // reseller only
    shippingTime?: string;    // vendor + reseller
    freeShipping?: boolean;   // vendor + reseller
    freeShippingThreshold?: string;
    notes: string;
}
```

Form shows/hides commerce sections based on selected `type`.

---

## Tab State

```ts
const [tab, setTab] = useState<"vendors" | "resellers" | "other">("vendors");
```

Add "Other" to: hero TabToggle, mobile BottomNav, filter reset on tab switch.

---

## Live Stats Strategy

```
Card mounts
    → has serverId?
        YES → revolt.js client: api.get('/servers/{serverId}')
              success → show live memberCount + onlineCount
              error   → show stored fallback
        NO  → show stored fallback
```

Revolt API returns server info on `GET /servers/{id}`. Online count via `GET /servers/{id}/members` — use with caution on large servers; consider caching per-session.

---

## Backend — Single `directory_communities` Collection

```ts
{
    _id: string               // ulid()
    type: "vendor" | "reseller" | "other"
    name: string
    logo?: string
    inviteLink: string
    serverId?: string
    verified: boolean
    memberCount: number       // manual fallback
    onlineCount: number       // manual fallback
    rating: number
    url?: string
    payment?: { cc, btc, pp, zelle, venmo, bt, chk: boolean }
    products?: { pep, oil, tabs, raw, amn, sup, aas: boolean }
    orderTypes?: { single, halfkit, fullkit: boolean }
    warehouses?: { us, eu, aus: boolean }
    shippingTime?: string
    freeShipping?: boolean
    freeShippingThreshold?: string
    notes: string
    active: boolean
    createdAt: Date           // ageDays computed from this on read
    updatedAt: Date
    createdBy: string
}
```

`ageDays` is computed on read: `Math.floor((Date.now() - doc.createdAt.getTime()) / 86400000)` — never stored.

### API endpoints (replaces separate vendors/resellers endpoints)

| Method | Path | Query | Auth | Purpose |
|--------|------|-------|------|---------|
| GET | `/api/directory/communities` | `?type=vendor\|reseller\|other` | none | List by tab |
| POST | `/api/directory/communities` | — | privileged | Create listing |
| PUT | `/api/directory/communities/:id` | — | privileged | Update listing |
| DELETE | `/api/directory/communities/:id` | — | privileged | Soft-delete |

Reviews: `GET/POST /api/directory/reviews?vendorId=&vendorType=community`
Submissions: `POST /api/directory/submissions` with `type: "vendor" | "reseller" | "other"`

---

## "Warehouses" → "Countries" Label

Display label only change (interface field stays `warehouses`):
- Card section header: `Countries`
- Table column: `Countries`
- Legend category: `Countries Served`
- Filter chips (US / EU / AUS): unchanged

---

## data.json Migration

Replace `vendors[]` and `resellers[]` arrays with a single `communities[]` array:
- Existing vendors → `type: "vendor"`, add community fields (`inviteLink`, `serverId`, `verified`, `memberCount`, `onlineCount`)
- Existing resellers → `type: "reseller"`, same additions
- Add 2–3 `type: "other"` entries (no commerce fields)
- Add `aas: false` to all existing `products` objects

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/directory/Directory.tsx` | Replace Vendor/Reseller interfaces with unified Community discriminated union; add AAS; add "Other" tab; community card (all tabs share top section); live stats fetch; tab state; submit form |
| `src/pages/directory/data.json` | Merge vendors/resellers into `communities[]`; add community fields; add `aas`; add "other" samples |
| `legacy-admin/api-server/src/schemas/directory.ts` | Single Community schema with `type` discriminator; AAS in Products |
| `legacy-admin/api-server/src/services/directory.service.ts` | `directory_communities` collection; `ageDays` computed on read |
| `legacy-admin/api-server/src/controllers/directory.controller.ts` | Unified community handlers |
| `legacy-admin/api-server/src/routes/directory.ts` | `/communities` routes (replaces separate /vendors, /resellers) |
| `legacy-admin/api-server/src/scripts/seed-directory.ts` | Seed from unified `communities[]` |

---

## Implementation Order

1. Update `data.json` — merge into `communities[]`, add community fields + AAS
2. Replace interfaces in `Directory.tsx` — unified `Community` discriminated union
3. Add AAS everywhere (labels, submit modal, filters, legend)
4. Refactor card component — community top section on all tabs, conditional commerce section
5. Add "Other" tab (tab state, TabToggle, BottomNav)
6. Community desktop table (unified columns, show/hide commerce per tab)
7. Live stats fetch on card mount
8. Submit form — add `inviteLink`, `serverId`; conditional commerce fields by type
9. Backend: unified community schema + service + controller + routes
10. Seed script

---

## Verification

- All 3 tabs render; each shows communities of that type
- Every card (all tabs) shows: logo, name, verified, stars, age, members, online, Join button
- Vendor + Reseller cards additionally show payment, products (with AAS), countries
- "Other" tab cards show community info only — no commerce section
- Live member/online count replaces fallback when Revolt API responds
- AAS appears in product badges on vendor and reseller cards
- "Countries" label shows everywhere instead of "Warehouses"
- Submit modal adapts fields based on type selection
- Admin can CRUD all three community types via privileged token
