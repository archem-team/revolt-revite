# Restoring Lost Components & Hallmark Design Implementation

**Status**: Implementation Complete & Verified  
**Date**: 2026-07-30  
**Target Branch**: `feat/promos-improve-ui/ux`  
**Primary Source File**: [`src/pages/home/Promos.tsx`](file:///Users/sakshivishwakarma/Desktop/Archem/revolt-revite/src/pages/home/Promos.tsx)

---

## 1. Overview

This document tracks the restoration of the three core Promos page features previously lost due to a merge conflict, updated with Hallmark Design System aesthetics extracted from reference mockups:

1. **Filter Chips Rail**: Single horizontal scroll rail under search bar with active state pills and numeric count badges.
2. **Trending Peptides Carousel**: Sparkline trend graphs, tabular numeric prices, vendor counts, and circular avatar stacks.
3. **Compare Vendors Sidebar Drawer**: Persistent right-side drawer (desktop) and expandable bottom sheet (mobile) with vendor table rows, checkboxes, detailed spec cards, and a multi-compare tray.

---

## 2. Restored Feature Specifications

### 2A. Filter Chips Rail
* **Position**: Directly below the sticky search bar.
* **Layout**: Horizontal scroll container (`FilterChipsRow`).
* **Design**:
  - Compact rounded pills (`border-radius: 20px`).
  - Active selection state with accent background (`var(--accent)`).
  - Numeric count badges inside chips (`<span className="chip-count">...</span>`).

### 2B. Trending Peptides Section
* **Position**: Placed between Active Filters notice bar and Hot Promos Today.
* **Header**: `🔥 Trending Peptides` + `Top compounds this week` + right-aligned `View all →` action link.
* **Card Anatomy**:
  - Compound Title (`Retatrutide`) + active promo count (`52 active promos`).
  - Price per unit/kit (`From $0.88 / mg`) formatted with `font-variant-numeric: tabular-nums`.
  - SVG Sparkline line chart with gradient fill path (`<svg viewBox="0 0 100 24">`).
  - Vendor total (`52 vendors`) + overlapping circular monogram stack (`WP`, `SP`, `AP`, `+20`).
  - Entire card is clickable to open the Comparison Drawer for that compound.

### 2C. Fixed Promo Card Footer
* **Flexbox Layout**: Cards use `display: flex; flex-direction: column; height: 100%` and `CardFooter { margin-top: auto; }` so footers remain locked to the bottom regardless of card text height.
* **Single-Status Logic**: Left side of the card footer strictly evaluates one status pill in order of priority:
  1. `🔴 Ends in 18h` (if expiring within 72h).
  2. `↻ Updated 2d ago` (if updated recently).
  3. `✓ Active` (default fallback).
* **Compare Vendors Action**: Secondary un-filled text link (`Compare Vendors →`) on the right side of the footer.

### 2D. Compare Vendors Sidebar Drawer
* **Responsive Architecture**:
  - **Desktop (≥721px)**: Persistent right panel (`width: 400px`), non-blocking backdrop, background page remains fully scrollable.
  - **Mobile (≤720px)**: Bottom sheet with top drag handle (`SheetHandle`) and body scroll lock.
* **Drawer Content**:
  - Header: `Compare` title, compound subtitle (`Retatrutide 10mg`), vendor total (`52 vendors found`), and `Sort by: Lowest Price ⌄` selector.
  - Vendor Table Rows: Checkbox for multi-select comparison, vendor monogram, flag (`🇺🇸`, `🇪🇺`, `🇨🇳`), price, discount pill (`30% OFF`, `Lowest`, `Popular`), and accordion chevron.
  - Expanded Active Card: Highlighted border (`var(--accent)`), complete spec grid (Price, Discount, Shipping, Customs, Purity, Stock), and action buttons (`View Promo` outline + `Join Community` filled purple).
  - Floating Multi-Compare Tray: Bottom bar appearing when items are checked (`4 selected` | `Clear all`, vendor chips, and full-width `Compare (4)` CTA button).

---

## 3. Verification

- **Production Build**: Verified clean TypeScript compilation (`yarn build`).
- **Dev Server**: Active and running on `http://local.revolt.chat:3000`.
