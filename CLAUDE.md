# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Revite is the web client for Revolt (a chat platform), branded as "PepChat" in this fork. Built with Preact and Vite, it uses MobX for state management and styled-components for styling.

## Common Commands

```bash
# Development
yarn dev                    # Start dev server (runs on http://local.revolt.chat:3000)

# Build
yarn build:deps             # Build external dependencies (components + revolt.js) - run first
yarn build                  # Production build

# Quality
yarn lint                   # ESLint
yarn fmt                    # Prettier formatting
yarn typecheck              # TypeScript type checking

# Scan for untranslated strings
yarn lint | egrep "no-literals" -B 1
```

## Git Submodules

This project uses three submodules in `external/`:
- `external/lang` - Translations (archem-team/translations)
- `external/components` - UI components (@revoltchat/ui)
- `external/revolt.js` - API client library

After cloning: `git submodule init && git submodule update`
After pulling: `git submodule update`

The submodules are linked via `package.json` resolutions to use local versions.

## Architecture

### Entry Flow
`src/main.tsx` → `src/pages/app.tsx` → Context providers → Route handling

### State Management (MobX)
- **`src/mobx/State.ts`**: Central state orchestrator managing all stores
- **`src/mobx/stores/`**: Individual stores (Auth, Settings, Layout, Draft, Notifications, etc.)
- Stores implement `Persistent<T>` interface for local storage via localforage
- Settings sync to Revolt server via `Sync` store

### Controllers (`src/controllers/`)
- **`client/ClientController.tsx`**: Manages Revolt.js client lifecycle, authentication sessions, and multi-account support
- **`client/Session.ts`**: Individual session state machine
- **`modals/ModalController.ts`**: Modal dialog management

### Context Providers (`src/context/`)
- **`index.tsx`**: Root context wrapper (Router, UIProvider, Locale, Theme)
- **`Theme.tsx`**: Dynamic theming with CSS variables injection
- **`Locale.tsx`**: i18n using preact-i18n

### Page Structure (`src/pages/`)
- **`RevoltApp.tsx`**: Main authenticated app with OverlappingPanels layout
- **`channels/`**: Channel view and messaging
- **`settings/`**: User, server, and channel settings
- **`login/`**: Authentication flows

### UI Components
- **`src/components/`**: App-specific components (navigation, settings panels)
- **`external/components/`**: Shared @revoltchat/ui component library

### Key Patterns
- React Router v5 for routing with `history` package
- styled-components with `/macro` for CSS-in-JS
- Preact used as React drop-in (`jsxImportSource: "preact"`)
- Environment variables prefixed with `VITE_` (e.g., `VITE_API_URL`)

## ESLint Rules
- `react/jsx-no-literals`: Warns on untranslated strings - use preact-i18n `<Text>` component
- Unused vars prefixed with `_` are ignored
