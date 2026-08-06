# 📱 Mobile Responsive Redesign & Technical Handover Document

## 1. Project Overview & Context

- **Repository**: Revolt Web Client (`revolt-revite`, branded as **PepChat**).
- **Tech Stack**: Preact + Vite, MobX state management, `styled-components/macro`.
- **Target Branch**: `feat/promos-improve-ui/ux`
- **Primary Task**: Mobile Responsive Redesign for the Promos Page (`src/pages/home/Promos.tsx`) and Home Page Shell (`src/pages/home/Home.tsx`).

---

## 2. Summary of Completed Work

### A. Mobile Navigation & Shell (`src/pages/home/Home.tsx`)
- Added a touchscreen-friendly **hamburger menu toggle** button in the Home tab header row.
- Connected the hamburger button to `OverlappingPanels` scroll container (`#app > div > div > div`) so mobile users can toggle the slide-out navigation sidebar in and out.

### B. Promos Page Mobile Responsiveness (`src/pages/home/Promos.tsx`)
1. **Prevented Page-Level Horizontal Overflow**:
   - Set `overflow-x: clip;` on `Wrapper` at mobile viewports (`≤720px`).
   - Set horizontal page padding to `16px` (`padding-left: 16px; padding-right: 16px`).
   - Added iOS safe-area inset support: `padding-bottom: max(64px, calc(env(safe-area-inset-bottom, 0px) + 32px))`.
2. **Fixed Horizontal Carousel Touch Scrolling**:
   - Added `onTouchStart={(e) => e.stopPropagation()}` and `onTouchMove={(e) => e.stopPropagation()}` to `TrendingRail`, `HotPromosGrid`, and `FilterChipsRow`.
   - **Root Cause & Solution**: On mobile touchscreens, horizontal swipe gestures were previously intercepted by `react-overlapping-panels` (the app's slide-out sidebar container). Halting touch event propagation allows native, smooth horizontal carousel scrolling.
3. **Fluid Viewport Sizing for Carousels**:
   - Replaced fixed pixel widths (`268px` / `300px`) with fluid viewport sizing: `flex: 0 0 calc(86vw - 24px); width: calc(86vw - 24px); max-width: 320px; scroll-snap-align: start;`.
   - Each carousel card now occupies ~85–88% of the viewport width with an 8–12px peek of the next card across 320px–430px screens.
4. **Badge & Button Wrap Protection**:
   - Replaced `flex-wrap: nowrap` with `flex-wrap: wrap` on `BadgeRow` & `FeaturedLogisticsLine` so badges wrap gracefully to the next line without clipping.
   - Updated action buttons in `.action-row` and `CardFooter` to use `flex: 1 1 auto; min-width: 110px; flex-wrap: wrap; min-height: 44px;` so buttons remain 100% visible and stack vertically when horizontal width is insufficient.
5. **Search + Sort Vertical Stacking**:
   - Updated `SearchSortRow` to stack vertically (`flex-direction: column`) on viewports `≤720px`, giving Search input and `Newest First` sort dropdown 100% full width.
6. **Container & Text Overflow Containment**:
   - Added `width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; overflow-wrap: anywhere; word-break: break-word;` to `NoteBlock` and card sub-components.

---

## 3. Core Architecture & Key File References

| File | Purpose | Key Responsibilities |
| --- | --- | --- |
| [`src/pages/home/Promos.tsx`](../src/pages/home/Promos.tsx) | Main Promos Dashboard | `Wrapper`, `StickySearchBar`, `TrendingPeptides`, `HotPromosGrid`, `Grid`, `PromoCard`, `VendorCompareCard`, `ComparisonDrawer` |
| [`src/pages/home/Home.tsx`](../src/pages/home/Home.tsx) | Home Shell & Navigation | `TabRow`, `TabBar`, Hamburger toggle button & `OverlappingPanels` drawer scroll trigger |

---

## 4. Handover & Immediate Next Steps

1. **Commit Working Tree Changes**:
   - Stage and commit modified `src/pages/home/Promos.tsx`:
     ```bash
     git add src/pages/home/Promos.tsx
     git commit -m "feat(mobile): fix carousel touch scroll, badge wrapping, and fluid layout"
     ```
2. **Viewport Verification**:
   - Verify `http://local.revolt.chat:3000/promos` on Chrome DevTools mobile viewports (**320px, 375px, 390px, 412px, 430px**):
     - Zero page-level horizontal overflow.
     - Smooth horizontal touch swipe on Trending Peptides and Hot Promos carousels.
     - Badges wrap cleanly; action buttons stack vertically when tight.
     - Search & Sort stack vertically full-width.
3. **Compare Drawer Guarantees (Optional User Follow-up)**:
   - If the user requests further updates regarding comparison drawer guarantees (*Fill Guarantee, Purity Guarantee, Shipping Guarantee*) or field definitions (*Shipping | Standard, Discount | Standard, Stock | In Stock*), update `VendorCompareCard` in `Promos.tsx`.
