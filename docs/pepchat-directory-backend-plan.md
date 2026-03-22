# PepChat Directory — Live Data Backend + Admin CRUD

## Context

The Directory page (`src/pages/directory/Directory.tsx`) currently serves data from a hardcoded `data.json` file. Reviews are in-memory, submissions go to `localStorage`, and there is no admin interface. The goal is to wire the page to a real backend with full CRUD for admins and live reads for all users.

**Admin identification:** The Revolt/PepChat platform marks privileged users with `privileged: true` on the user document in MongoDB (`revolt` db, `users` collection). The frontend can access the current session token via `clientController.clients.values().next().value.session.token`. We will use this token to authenticate backend requests — the API middleware will look it up in the `sessions` collection to get `user_id`, then check `users.privileged`.

**Where the backend lives:** `legacy-admin/` — an Express.js + MongoDB server already connected to the same `revolt` database. Adding the directory routes here reuses all existing infrastructure (connection pooling, Zod validation, error handling, CORS).

---

## Architecture

```
Directory.tsx (Preact frontend)
    │ fetch with optional X-Revolt-Token header
    ▼
legacy-admin API server (Express, port 3001)
    ├── Public routes       → no auth
    ├── User write routes   → optional Revolt token (rate-limit by IP if anon)
    └── Admin routes        → Revolt token required, privileged:true required
              │
              ▼
        MongoDB (revolt db)
        ├── directory_vendors
        ├── directory_resellers
        ├── directory_reviews
        └── directory_submissions
```

---

## Phase 1 — Backend (legacy-admin)

### 1.1 New middleware

**`api-server/src/middleware/revolt-auth.ts`**
- `requireRevoltAuth` — extracts `X-Revolt-Token` header, queries MongoDB:
  1. `revolt.sessions` → get `user_id` for that token
  2. `revolt.users` → check `privileged: true`
  - Attaches `req.revoltUserId` and `req.isPrivileged` to request
- `requirePrivileged` — calls `requireRevoltAuth` then rejects if not privileged (403)
- `optionalRevoltAuth` — same lookup but does not reject; used for user-write routes so we can store `submittedBy`

### 1.2 MongoDB collections (in `revolt` db)

**`directory_vendors`**
```ts
{
  _id: string          // ulid()
  name: string
  url: string
  rating: number       // auto-recalculated on review write
  payment: { cc, btc, pp, zelle, venmo, bt, chk: boolean }
  warehouses: { us, eu, aus: boolean }
  products: { pep, oil, tabs, raw, amn, sup: boolean }
  shippingRoutes: string
  shippingTime: string
  freeShipping: boolean
  freeShippingThreshold: string
  notes: string
  active: boolean      // soft delete
  createdAt: Date
  updatedAt: Date
  createdBy: string    // privileged user_id
}
```

**`directory_resellers`** — same as vendors plus `orderTypes: { single, halfkit, fullkit: boolean }`

**`directory_reviews`**
```ts
{
  _id: string
  vendorId: string
  vendorType: "vendor" | "reseller"
  reviewerName: string
  reviewerUserId?: string   // Revolt user_id if logged in
  rating: number            // 1–5
  text: string
  date: string              // YYYY-MM-DD
  status: "pending" | "approved" | "rejected"
  createdAt: Date
}
```

**`directory_submissions`**
```ts
{
  _id: string
  type: "vendor" | "reseller"
  name: string
  url: string
  payment: { cc, btc, pp, zelle, venmo, bt, chk: boolean }
  warehouses: { us, eu, aus: boolean }
  products: { pep, oil, tabs, raw, amn, sup: boolean }
  orderTypes: { single, halfkit, fullkit: boolean }
  notes: string
  submittedAt: Date
  submittedBy?: string      // Revolt user_id if logged in
  status: "pending" | "approved" | "rejected"
  rejectionReason?: string
}
```

### 1.3 New files

Follow existing patterns from `routes/reports.ts`, `controllers/reports.controller.ts`, `lib/db.ts`.

```
api-server/src/
├── middleware/revolt-auth.ts           (new)
├── schemas/directory.ts                (new — Zod schemas)
├── routes/directory.ts                 (new)
├── controllers/directory.controller.ts (new)
└── services/directory.service.ts       (new)
```

### 1.4 API routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/directory/vendors` | none | List active vendors (filters, sort, pagination) |
| GET | `/api/directory/resellers` | none | List active resellers |
| GET | `/api/directory/reviews` | none | Reviews for one listing (`?vendorId=&vendorType=`) |
| POST | `/api/directory/reviews` | optional | Submit review → status: pending |
| POST | `/api/directory/submissions` | optional | Submit listing → status: pending |
| POST | `/api/directory/vendors` | privileged | Create vendor directly |
| PUT | `/api/directory/vendors/:id` | privileged | Update vendor |
| DELETE | `/api/directory/vendors/:id` | privileged | Soft-delete (set active: false) |
| POST | `/api/directory/resellers` | privileged | Create reseller |
| PUT | `/api/directory/resellers/:id` | privileged | Update reseller |
| DELETE | `/api/directory/resellers/:id` | privileged | Soft-delete |
| GET | `/api/directory/admin/submissions` | privileged | Queue (`?status=pending`) |
| PATCH | `/api/directory/admin/submissions/:id` | privileged | Approve (creates listing) or reject |
| GET | `/api/directory/admin/reviews` | privileged | Review moderation queue |
| PATCH | `/api/directory/admin/reviews/:id` | privileged | Approve / reject review |

Register in `api-server/src/app.ts`:
```ts
import directoryRoutes from './routes/directory';
app.use('/api/directory', directoryRoutes);
```

### 1.5 Seed script

**`api-server/src/scripts/seed-directory.ts`** — reads `revolt-revite/src/pages/directory/data.json` and `insertMany` into `directory_vendors`, `directory_resellers`, `directory_reviews`. Reviews are seeded as `status: "approved"` and rating is computed from seed reviews.

### 1.6 Rating recalculation

On every review approval or new approved review, recompute:
```ts
avgRating = avg of approved reviews for that vendorId/vendorType
update directory_vendors/resellers set rating = avgRating
```

---

## Phase 2 — Frontend (Directory.tsx)

### 2.1 Replace static data with API fetches

- Remove `import rawData from "./data.json"`
- Add `const DIRECTORY_API = import.meta.env.VITE_DIRECTORY_API_URL || "http://localhost:3001"`
- Add `useState` for `vendors`, `resellers`, `reviews` (lazy loaded per vendor), `loading`, `error`
- `useEffect` on `tab` change: fetch `/api/directory/vendors` or `/api/directory/resellers` with current filters/sort params

### 2.2 Auth helper

```ts
function getRevoltToken(): string | undefined {
  const session = clientController.clients.values().next().value?.session;
  return typeof session === "object" ? session?.token : session;
}
```
Pass as `X-Revolt-Token` header on review/submission POSTs.

### 2.3 Admin UI (shown when `user?.privileged`)

- Edit button on each card/row → opens pre-filled SubmitModal in edit mode
- Delete button → soft-delete with confirmation
- In the filter bar: "Pending Submissions (N)" badge linking to admin queue (simple modal or separate tab)
- Reviews modal: approve/reject buttons on each review for admins

### 2.4 Review submission

Replace the in-memory `setReviews(prev => [...prev, ...])` with a `POST /api/directory/reviews`, then refetch reviews for that vendor.

### 2.5 Listing submission

Replace `localStorage.setItem(...)` with `POST /api/directory/submissions`.

---

## Critical files

| File | Change |
|------|--------|
| `legacy-admin/api-server/src/app.ts` | Register `/api/directory` routes |
| `legacy-admin/api-server/src/middleware/revolt-auth.ts` | New — Revolt token verification |
| `legacy-admin/api-server/src/routes/directory.ts` | New — all routes |
| `legacy-admin/api-server/src/controllers/directory.controller.ts` | New |
| `legacy-admin/api-server/src/services/directory.service.ts` | New |
| `legacy-admin/api-server/src/schemas/directory.ts` | New — Zod schemas |
| `revolt-revite/src/pages/directory/Directory.tsx` | Replace static data, add API calls, admin UI |
| `revolt-revite/.env.local` | Add `VITE_DIRECTORY_API_URL` |

### Reuse from existing codebase

| Utility | Path | Use |
|---------|------|-----|
| `withMongoConnection()` | `legacy-admin/lib/db.ts` | All DB operations |
| `validateRequest()` | `legacy-admin/api-server/src/middleware/validation.ts` | Route validation |
| Response helpers | `legacy-admin/api-server/src/utils/response.ts` | Consistent response format |
| Auth middleware pattern | `legacy-admin/api-server/src/middleware/auth.ts` | Template for revolt-auth.ts |
| Route structure template | `legacy-admin/api-server/src/routes/reports.ts` | Route file structure |
| `ulid` | already in package.json | Generate `_id` values |

---

## Implementation order

1. `revolt-auth.ts` middleware — blocking dependency for all admin routes
2. Zod schemas (`schemas/directory.ts`)
3. Service layer (`directory.service.ts`) — MongoDB CRUD + rating recalc
4. Controller (`directory.controller.ts`)
5. Routes (`routes/directory.ts`) + register in `app.ts`
6. Seed script — migrate `data.json` → MongoDB
7. Frontend: replace static data with fetches + loading/error states
8. Frontend: admin UI controls (edit/delete/moderate)

---

## Verification

1. **Backend**: `npm run test` in legacy-admin (Jest already configured)
2. **API smoke tests**:
   ```bash
   # Public read
   curl http://localhost:3001/api/directory/vendors

   # User submit review
   curl -X POST http://localhost:3001/api/directory/reviews \
     -H "Content-Type: application/json" \
     -d '{"vendorId":"v1","vendorType":"vendor","reviewerName":"Alice","rating":5,"text":"Great!"}'

   # Admin create (privileged token)
   curl -X POST http://localhost:3001/api/directory/vendors \
     -H "X-Revolt-Token: <privileged-token>" \
     -H "Content-Type: application/json" \
     -d '{...}'

   # Admin create (non-privileged → 403)
   curl -X POST http://localhost:3001/api/directory/vendors \
     -H "X-Revolt-Token: <regular-token>"
   ```
3. **Frontend**: Run `yarn dev`, visit `/directory` — vendors load from API, not bundled JSON
4. **Admin flow**: Log in as privileged user, verify edit/delete/moderate buttons appear
5. **Submission flow**: Submit via FAB → appears in `GET /api/directory/admin/submissions?status=pending` → approve → appears in vendor list
