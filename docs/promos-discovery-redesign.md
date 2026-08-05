# Promos Page: Product Discovery, Filter Redesign & Hallmark Design Audit

**Status**: Implementation Complete & Verified  
**Last updated**: 2026-07-29  
**Target Branch**: `feat/promos-improve-ui/ux`  
**Hallmark Status**: Audit & Redesign Completed (`0 critical · 0 major · 0 minor`)  

---

## 1. Executive Overview & Product Strategy

PR #105 established the baseline Promos page architecture — deal cards, search, categorical filtering, and product discovery.

This iteration delivers:
1. A **lightweight, grouped browse experience** directly below the sticky search bar without heavy boxed containers.
2. A **resilient Vendor Comparison Drawer** that opens on clicking any compound card or "Compare vendors →" action.
3. **Hallmark Design Skill Integration** (`hallmark audit` & `hallmark redesign`), enforcing anti-AI-slop design discipline, high-contrast typography pairing, tabular numeric formatting, property-specific transitions, and mobile overflow masking.
4. **Top Navigation Header Integration**: Sidebar collapse chevron (`<ChevronLeft />` / `<ChevronRight />` / `<Menu />`) embedded into the top `TabRow` next to **Home**.

---

## 2. Hallmark Design System & Anti-Slop Audit

### 2A. Hallmark Audit Results
The page was audited against all 58 Hallmark slop-test gates (`references/anti-patterns.md` & `references/slop-test.md`):
* **Critical Findings**: `0` (No purple-gradient heroes, no card-in-card visual nesting, no fake redrawn OS browser chrome, no 2-line clickable button text wraps).
* **Major Findings**: `0` (Resolved display font pairing & label flex clipping).
* **Minor Findings**: `0` (Property-specific CSS transitions applied per Gate 43).
* **Pre-emit Score Stamp**: `/* Hallmark · redesign critique: P5 H5 E5 S5 R5 V5 */`
* **Project Memory File**: Created [`.hallmark/log.json`](file:///Users/sakshivishwakarma/Desktop/Archem/revolt-revite/.hallmark/log.json).

### 2B. Visual & Typography Discipline
* **Display Typography Pairing**:
  ```css
  font-family: var(--font-display, "Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  font-size: clamp(24px, 5vw, 34px);
  font-weight: 700;
  font-style: normal;
  letter-spacing: -0.025em;
  ```
* **Typography Purity**: Strictly Roman headers (`font-style: normal`) per Hallmark Discipline #6.
* **Tabular Numeric Figures**: Prices and metrics use `font-variant-numeric: tabular-nums` for precise vertical alignment across cards and rails.
* **Multilingual Label Flex (i18n)**: Inline labels (`Product`, `Location`, `Promotion`, `Active filters`) use `min-width: max-content` instead of fixed pixel widths, preventing text truncation in non-English localizations.
* **Mobile Scroll Mask**: Applied `mask-image: linear-gradient(to right, black 90%, transparent 100%)` on small viewports (<720px) to provide intuitive horizontal scroll cues.
* **Property-Specific Transitions**: Explicit CSS properties listed (`transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease, transform 0.15s ease`) to prevent unnecessary repaint cycles.

---

## 3. Layout Architecture & User Journey

```
Top Tab Navigation Bar (< Chevron | Home | Promos NEW | Compound Finder)
        ↓
Page Title ("Promos") & Subtitle
        ↓
Sticky Search + Sort Bar
        ↓ (16px gap)
Unboxed Grouped Filter Rows (Product / Location / Promotion)
        ↓ (12px gap)
Dedicated Active Filters Row (Displays active badges + Clear all 🗑)
        ↓ (20px gap)
🔥 Trending Peptides (Top Compounds → Card Click opens Comparison Drawer)
        ↓
🔥 Hot Promos Today
        ↓
All Promotions Grid (View Promo | Join Community ⭐ | Visit Website ↗)
```

---

## 4. Component Details & Behavior

### 4A. Filter Section (Unboxed & Grouped)
* **Product Filter**: Single-select (`Retatrutide`, `Tirzepatide`, `Semaglutide`, `GHK-Cu`, `+ More`).
* **Location Filter**: Single-select (`🇺🇸 US Warehouse`, `🇨🇳 China`, `🇮🇳 India`).
* **Promotion Filter**: Multi-select (`🚚 Free Shipping`, `⏰ Ending Soon`, `✨ Recently Updated`).
* **Active Filters Row**: Appears dynamically below Promotion row with removable badges and right-aligned `Clear all 🗑` button.

### 4B. Vendor Comparison Sidebar Drawer
* **Resilient Compound Lookup**: 3-stage fallback lookup (exact key $\rightarrow$ normalized compound match $\rightarrow$ dynamic promo metadata fallback) ensuring any card click opens the drawer reliably.
* **Direct Card Action**: Clicking any Trending Peptide card directly opens the Comparison Drawer for that compound without adding unnecessary active filters.

### 4C. Navigation Header Collapse Toggle
* Embedded `<SidebarToggle>` in `Home.tsx`'s `TabRow`:
  ```
  < Home   Promos NEW   Compound Finder
  ```
* Toggles the left channels/direct messages panel (`SIDEBAR_CHANNELS`) instantly across all home routes.

---

## 5. Session Context & State Preservation

- **Primary Source File**: [`src/pages/home/Promos.tsx`](file:///Users/sakshivishwakarma/Desktop/Archem/revolt-revite/src/pages/home/Promos.tsx)
- **Top Tab Bar File**: [`src/pages/home/Home.tsx`](file:///Users/sakshivishwakarma/Desktop/Archem/revolt-revite/src/pages/home/Home.tsx)
- **Hallmark System Log**: [`.hallmark/log.json`](file:///Users/sakshivishwakarma/Desktop/Archem/revolt-revite/.hallmark/log.json)
- **Production Build Status**: Verified clean compilation (`yarn build`).
- **Live Local URL**: `http://localhost:3001/promos`
