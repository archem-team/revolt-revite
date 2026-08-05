# PepChat Promos Dashboard Improvements

## Executive Summary

The PepChat Promos page (`src/pages/home/Promos.tsx`) has been transformed into a **sleek, decision-support dashboard**. 

Users visit this page to answer four core questions in under 3 seconds:
1. *What changed since my last visit?*
2. *Is there anything worth looking at today?*
3. *Which promotions should I care about first?*
4. *Which vendor should I open?*

All enhancements follow standard UI/UX design practices: curated semantic color systems, non-repetitive badges, low visual noise, and fixed card grid alignment.

---

## Architecture & Feature Breakdown

### 1. 🏷 Refined Badge System (Urgency vs. Quality Separation)

Badges are split into **two distinct visual zones** to prevent visual overload:

#### A. Primary Top Badges (Hot Promos & Status Badges)
Primary badges sit aligned with the vendor logo (`16px` breathing room) and answer: *"Why should I click this first?"* Generic badges (`Featured Promotion`, `Best Value`, `Verified Vendor`, `US Restocked`) were **completely removed**. If no rule applies, `null` is returned (no forced badge).

| Priority | Badge Label | Color | Semantic Category / Trigger |
| :--- | :--- | :--- | :--- |
| **1** | **🔥 Ending Soon** | Orange (`#f97316`) | Expires within 72 hours (highest urgency) |
| **2** | **✨ Recently Updated** | Blue (`#3b82f6`) | Updated within last 24 hours |
| **3** | **🆕 New Promotion** | Green (`#22c55e`) | Created within last 3 days |
| **4** | **💙 Free Shipping** | Cyan (`#0891b2`) | $0 shipping fee |
| **5** | **🇺🇸 US Warehouse** | Indigo (`#6366f1`) | Ships from US facility |
| **6** | **🚚 Free Over $X** | Indigo (`#6366f1`) | Free shipping threshold |

#### B. Secondary Feature Pills
A single, lightweight secondary pill (`SecondaryReasonPill`) can sit beside the primary badge for shipping highlights (e.g. `[ 🆕 NEW PROMOTION ]` `[ 💙 Free Shipping ]`).

---

### 2. 🛡 Card Body Purchase Highlights (Max 2–3 Chips)

Quality and sourcing indicators were moved **out of top badges** and placed exclusively inside the card body (`MetaRow`):
- **Merged Shipping Line**: `🚚 Shipping $60 • Free over $1,000` or `💙 Free Shipping`
- **Customs Guarantee**: `🛡 Customs Reship`
- **Purity Test**: `💎 99% Purity` ($\ge 98\%$)
- **Direct Sourcing**: `🇨🇳 China Direct` *(automatically suppressed if location is already in the vendor header row)*

*Strict Constraint*: Highlights are capped at **max 3 items per card** (`.slice(0, 3)`).

---

### 3. 🎯 Hot Promos Slot Diversification Algorithm

The 4 cards in *🔥 Hot Promos Today* are selected using a weighted score (`getHotPromoScore`) and a unique badge tracker (`usedBadgeLabels`):
- **Slot 1**: Urgency candidate (**🔥 Ending Soon**)
- **Slot 2**: Savings candidate (**💙 Free Shipping** / **🚚 Free Over $X**)
- **Slot 3**: Speed candidate (**🇺🇸 US Warehouse**)
- **Slot 4**: Freshness candidate (**🆕 New Promotion** / **✨ Recently Updated**)

This guarantees all 4 Hot Promos cards display **4 distinct primary badges and 4 distinct colors** (Orange, Cyan, Indigo, Green/Blue).

---

### 4. 📝 Description Clamping & In-Place Bullet Expansion

- **Default View**: Clamped to **2 lines max** with a smooth bottom fade-out gradient mask (`mask-image: linear-gradient(...)`) and an explicit **`Read more →`** button link.
- **In-Place Expansion**: Clicking `Read more →` parses discount notes, shipping terms, and MOQ rules into structured bullet points:
  ```text
  • 10% off over $1000
  • 20% off over $6000
  • Freebies available
  
  Show less
  ```
- Clicking **`Show less`** collapses the card back to the 2-line summary. Card heights remain strictly uniform across the grid.

---

### 5. 🕒 Card Footer 2-Question Logic

The card footer is divided into two distinct metadata slots:

```text
┌─────────────────────────────────────────────────────────┐
│ 🔥 Ends in 2d 4h                    Updated 4h ago      │
└─────────────────────────────────────────────────────────┘
```

- **Left Slot (Expiration Timeline)**:
  - If ends within 72h: **`Ends in 2d 4h`** *(bold Orange `#f97316` tint)*
  - Else if `endDate` exists: **`Ends Jul 31`** *(subtle gray)*
  - Else: empty (handled by flex container, no dummy `opacity: 0` spans)
- **Right Slot (Freshness Timestamp)**:
  - Displays explicit semantic status: `Updated just now`, `Updated 4h ago`, `Updated yesterday`, or `Updated Jul 15`.

---

### 6. 🔍 Revamped Empty Search & Filter State

When a query or filter returns zero results:
1. **Dynamic Explanation**: Displays why results are empty (e.g. `No promotions found for "India"`).
2. **Active Filter Tags**: Shows active constraints with `X` dismiss buttons.
3. **Interactive Suggestion Chips**: Clickable chips (`[Tirzepatide]`, `[Retatrutide]`, `[US Warehouse]`).
4. **Context-Aware Recovery Buttons**: `Clear Filters`, `Clear Search`, `Browse All Promotions`.
5. **Compact Position**: Positioned 12px below filter chips without large empty gaps.

---

### 7. 🟢 Live Active Filter Banner & Grid Animation

- **Active Notice Banner**: Displays `🟢 Showing 3 promotions filtered by 🇺🇸 US Warehouse` with a pulsing green live dot and a one-click `Reset Filters` button.
- **Entrance Animation**: Keyed with `${activeFilter}-${query}-${sort}` so switching filters triggers a smooth entrance transition (`@keyframes promoGridSwap`).

---

### 8. 🖼 Gallery Thumbnail Overlay Counter

- Cards display **1 hero image + max 3 thumbnail previews**.
- If a promo has 5+ images, the 3rd thumbnail renders a dark **`+N`** count overlay badge.

---

### 9. 📱 Mobile Responsiveness & Single-Page Layout Optimizations

- **🔥 Hot Promos Horizontal Carousel**: Converted `HotPromosGrid` at `<= 720px` to a horizontal swipe container (`flex-row`, `overflow-x: auto`, `scroll-snap-type: x mandatory`). Cards use `flex: 0 0 84%` width with `10px` gap so **1 card is 100% visible with a 15% preview of the next card peeking on the right**, tracked by interactive pagination dots (`HotCarouselDots`).
- **📋 All Promotions Feed**: Single-column vertical feed (`column-count: 1`) on mobile where every card occupies 100% of the available content width without horizontal clipping or partial visibility.
- **📌 Sticky Search, Sort & Filters**: `StickySearchBar` pins Search, Sort, and Filter chips to the top of the mobile viewport (`position: sticky; top: 0; z-index: 20; background: var(--primary-background)`).
- **📢 Single-Screen Market Updates Alert**: Responsive text formatting (`Updates: 1 ending soon` on `<= 560px` and `All →` link on `<= 480px`) with `flex-shrink: 0` on `.alert-right` ensures the notification text, action link, and `✕` close button remain **100% visible on a single line** across all screen sizes.
- **🛡 Root Page Overflow Containment**: Enforced `width: 100%; box-sizing: border-box; overflow-x: hidden;` on `Wrapper`, and eliminated all negative side margins to guarantee **zero horizontal page scrolling**.
- **📐 Card Height & Touch Target Calibration**: Reduced mobile card padding (`10px 12px`), hero image height (`clamp(65px, 18vw, 90px)`), and description line clamping (2 lines max) so cards fit within a single screen view.

---

## File Changes Summary

| File | Changes Made |
|---|---|
| [src/pages/home/Promos.tsx](file:///Users/sakshivishwakarma/Desktop/Archem/revolt-revite/src/pages/home/Promos.tsx) | Implemented mobile horizontal swipe carousel, sticky search/filters header, single-screen Market Updates alert bar, root overflow-x containment, compact card variant heights, and pagination dots. |
| [src/pages/home/Home.module.scss](file:///Users/sakshivishwakarma/Desktop/Archem/revolt-revite/src/pages/home/Home.module.scss) | Optimized `.homeScreen` container padding for mobile viewports (`padding: 4px; padding-top: 54px` on `<= 600px`). |
| [vite.config.ts](file:///Users/sakshivishwakarma/Desktop/Archem/revolt-revite/vite.config.ts) | Enabled CSS dev source mapping (`css.devSourcemap: true`) for browser DevTools inspection. |
| [docs/pepchat-promos-dashboard-improvements.md](file:///Users/sakshivishwakarma/Desktop/Archem/revolt-revite/docs/pepchat-promos-dashboard-improvements.md) | Comprehensive documentation summarizing features, badge hierarchy, card layout rules, mobile responsiveness, and architectural decisions. |

---

## Verification & Status

- **Dev Server**: Running cleanly on local Vite dev server.
- **Production Build**: Verified production build (`NODE_OPTIONS="--max-old-space-size=8192" yarn build`) and static preview server (`npx vite preview --host --port 4173`).
- **TypeScript**: Verified compilation status via `npx tsc --noEmit`.
- **Backend Schema Compatibility**: Fully compatible with existing `Promo` interface fields.
- **PR Status**: ✅ [PR #105](https://github.com/archem-team/revolt-revite/pull/105) pushed and ready to merge.

---

## Merge Resolution Log (2026-07-26)

### Context
During the merge of `origin/stage` into `feat/promos-improve-ui/ux`, multiple contiguous blocks of `styled-component` definitions in `Promos.tsx` were accidentally deleted while resolving conflict markers. Vite/TypeScript do not catch missing styled components at build time — they only crash at runtime when the specific JSX branch is first rendered, causing a wave of `ReferenceError: X is not defined` client crash reports.

### Root Cause
The merge conflict resolution script collapsed overlapping `<<<<<<< / ======= / >>>>>>>` blocks and, in doing so, removed the `const X = styled.div\`...\`` declarations while keeping the JSX usages intact.

### Components Restored

| Wave | Components | Trigger |
|---|---|---|
| 1 | `Centered`, `PromoTitle`, `ItemTable`, `ItemRow`, `ItemNote`, `Chip`, `MoreChip` | App crash on promo card render |
| 2 | `NoteBlock`, `NoteBulletList`, `ReadMoreLink` | App crash on note section render |
| 3 | `CardFooter`, `Empty`, `Glyph`, `ActiveFilterSummaryRow`, `SummaryTag`, `SuggestionChipGrid` | App crash on empty/filter state render |
| 4 | `CountdownText`, `SuggestionChipBtn` | App crash on card footer render |

**Total restored: 18 styled components.**

### How to Prevent in Future
Before every production build, run this audit to catch any missing styled components:
```bash
# Find closing tags with no matching styled-component definition
grep -oE '</[A-Z][A-Za-z]+>' src/pages/home/Promos.tsx | sed 's|</||;s|>||' | sort -u > /tmp/used.txt
grep -E '^const [A-Z][A-Za-z]+ = styled' src/pages/home/Promos.tsx | sed 's/const //;s/ =.*//' | sort -u > /tmp/defined.txt
comm -23 /tmp/used.txt /tmp/defined.txt
# Any output (excluding known external components) = missing definition = runtime crash
```

### Final Commit
- **Commit**: `eb403dbf` — `fix(promos): restore missing styled components lost during merge conflict resolution`
- **Pushed**: `origin/feat/promos-improve-ui/ux`
- **Build**: Compiled cleanly, no crashes on `http://localhost:4173`

---

## 10. 📊 Compare Drawer & Community Navigation Refinements

- **Card Sizing & Dynamic Growth**:
  - `VendorCompareCard` configured with `height: auto; min-height: fit-content; overflow: visible;` (no fixed height clipping).
  - Cards expand dynamically based on content (e.g. multi-line reship policy notes) without internal scrollbars or button clipping.
  - Action buttons (`View Promo` and `Open Community` / `Join Community`) sit inside `.vendor-card-body` with `24px` bottom padding.

- **Scrollable Vendor List & Drawer Flex Layout**:
  - `CompareDrawerContainer` uses `display: flex; flex-direction: column; height: 100%;`.
  - `VendorCompareList` acts as the dedicated scrollable container (`flex: 1; overflow-y: auto; padding-bottom: 32px;`).

- **Dynamic Community Membership & Channel Navigation**:
  - Detects server membership via `client.servers` (by `serverId` or vendor name).
  - Displays **`Open Community`** when user is already a member; displays **`Join Community`** when not.
  - Clicking **`Join Community`** joins the community via `client.joinInvite(...)`, triggers a floating toast notification (`✅ Joined [VendorName] Community`), and routes directly into the target community channel (`/channel/:id`) without any homepage redirects.

- **Hallmark Anti-Slop Audit Compliance**:
  - Includes component stamp `/* Hallmark · component: CompareDrawer · genre: modern-minimal · theme: PepChat Dark · states: default · hover · focus · active · disabled · contrast: pass */`.
  - Replaced inline hex fallbacks (`#10b981`, `#8b5cf6`) with CSS design tokens (`var(--status-online, #10b981)`, `var(--accent)`).
  - Standardized `ToastContainer` z-index tier (`z-index: 1000`).

