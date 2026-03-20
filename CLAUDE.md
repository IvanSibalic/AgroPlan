# CLAUDE.md — AgroPlan Codebase Guide

This file provides guidance for AI assistants working in this repository.

---

## Project Overview

**AgroPlan** is a mobile-first agricultural farm management application built with React Native/Expo and Supabase. It targets Croatian family farms (OPG — *Obiteljsko Poljoprivredno Gospodarstvo*), providing parcel management, activity logging, inventory tracking, team collaboration, and integration with Croatian government cadastral services (ARKOD).

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Mobile Framework | React Native 0.81.4 + Expo 54 |
| Navigation | Expo Router 6 (file-based routing) |
| Language | TypeScript 5.9.2 (strict mode) |
| Styling | NativeWind 4.2 (Tailwind CSS for RN) |
| UI Icons | Lucide React Native |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| Geospatial | PostGIS extension |
| Edge Functions | Deno (TypeScript) |
| Local Cache | AsyncStorage |

---

## Repository Structure

```
AgroPlan/
├── app/                        # Expo Router screens (file-based routing)
│   ├── (auth)/                 # Unauthenticated routes
│   │   ├── _layout.tsx         # Auth stack layout
│   │   ├── login.tsx           # Email/password login
│   │   └── register.tsx        # User registration
│   ├── (tabs)/                 # Main app (bottom tabs)
│   │   ├── _layout.tsx         # 5-tab layout definition
│   │   ├── index.tsx           # Dashboard (summary cards, alerts)
│   │   ├── parcels.tsx         # Land parcel management
│   │   ├── diary.tsx           # Activity/work log
│   │   ├── warehouse.tsx       # Inventory management
│   │   └── team.tsx            # Team members management
│   ├── _layout.tsx             # Root layout (auth state, fonts)
│   ├── opg-setup.tsx           # OPG onboarding (create/join)
│   └── +not-found.tsx
├── services/
│   ├── api.ts                  # Main API service layer (~724 lines)
│   └── cadastre.ts             # Croatian cadastre API integration
├── lib/
│   └── supabase.ts             # Supabase client configuration
├── hooks/
│   └── useFrameworkReady.ts    # Expo framework readiness hook
├── supabase/
│   ├── migrations/             # Ordered SQL migration files
│   │   ├── 0001_*.sql          # Core schema (opg, profiles, parcele, etc.)
│   │   ├── 0002_*.sql          # Additional tables (dnevnik, skladiste)
│   │   ├── 0003_*.sql          # RPC functions
│   │   └── 0004_*.sql          # Trigger for inventory deduction
│   └── functions/
│       └── katastar-proxy/     # Deno Edge Function (cadastre proxy)
│           └── index.ts
└── assets/                     # Static images (icon, favicon)
```

---

## Database Schema

All tables live in a Supabase (PostgreSQL) project with RLS enabled.

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `opg_profili` | OPG (farm) profiles | `id`, `naziv`, `oib`, `vlasnik_id`, `kod_pristupa` (8-char) |
| `profiles` | User profiles | `id`, `opg_id`, `puno_ime`, `uloga` (vlasnik/clan/radnik) |
| `parcele` | Land parcels | `id`, `opg_id`, `naziv`, `arkod_id`, `kultura`, `povrsina`, `geometrija` (PostGIS) |
| `skladiste` | Inventory | `id`, `opg_id`, `tip`, `naziv`, `kolicina`, `mjerna_jedinica`, `min_kolicina` |
| `dnevnik_rada` | Activity log | `id`, `opg_id`, `parcela_id`, `korisnik_id`, `aktivnost`, `datum`, `materijali` (JSONB) |
| `zahtjevi_pristupa` | Join requests | `id`, `opg_id`, `korisnik_id`, `puno_ime`, `status` |

### Views

- `v_parcele` — converts PostGIS `geometrija` to GeoJSON for frontend use

### PostgreSQL RPC Functions

Call via `supabase.rpc('function_name', params)`:

| Function | Purpose |
|----------|---------|
| `create_opg(naziv, oib)` | Creates OPG, returns unique 8-char `kod_pristupa` |
| `get_opg_by_code(kod)` | Looks up OPG by access code |
| `request_join_opg(kod)` | User requests membership |
| `approve_join_request(zahtjev_id)` | Owner approves join request |
| `reject_join_request(zahtjev_id)` | Owner rejects join request |
| `insert_parcela(naziv, arkod_id, kultura, povrsina, geojson)` | Creates parcel with PostGIS geometry |
| `update_team_member(id, puno_ime, uloga)` | Updates member profile |
| `get_user_opg_id()` | Helper — returns current user's OPG ID |

### Triggers

- `on_auth_user_created` → auto-creates `profiles` row on Supabase signup
- `trigger_deduct_skladiste` → auto-deducts inventory when an activity is logged in `dnevnik_rada`

---

## Service Layer (`services/api.ts`)

All backend calls go through this file. Always use existing functions before adding new ones.

### Auth
- `signIn(email, password)`, `signUp(email, password, puno_ime)`, `signOut()`, `getCurrentUser()`

### OPG Management
- `getOPGProfile()`, `createOPG(naziv, oib)`, `getOPGByCode(kod)`, `requestJoinOPG(kod)`
- `getJoinRequests()`, `approveJoinRequest(id)`, `rejectJoinRequest(id)`

### Parcels
- `getParcels()`, `createParcel(parcel)`, `updateParcel(id, updates)`, `deleteParcel(id)`, `getTotalArea()`

### Activity Log (Dnevnik Rada)
- `getActivities(limit?)`, `createActivity(activity)`, `deleteActivity(id)`

### Inventory (Skladište)
- `getInventory()`, `getInventoryByCategory(category)`, `getLowStockItems()`
- `createInventoryItem(item)`, `updateInventoryQuantity(id, qty)`, `deleteInventoryItem(id)`

### Team
- `getTeamMembers()`, `updateTeamMember(id, {name, role})`, `deleteTeamMember(id)`

### Offline / Caching Pattern
The service layer caches responses to AsyncStorage keys:
- `cache_parcele`, `cache_dnevnik_rada`, `cache_skladiste`, `cache_profiles`

If an API call fails, cached data is returned as fallback. Always maintain this pattern when adding new data fetching functions.

---

## Cadastre Integration (`services/cadastre.ts`)

Proxied via Supabase Edge Function (`supabase/functions/katastar-proxy/index.ts`) to:
- **ARKOD** — Croatian agricultural parcel registry
- **DGU OSS** — State Geodetic Administration (legacy)
- **DGU INSPIRE WFS** — Modern INSPIRE standard
- **DGU ArcGIS REST API** — Fallback

The edge function bypasses CORS restrictions for government APIs. Any new government API integrations should be added here rather than called directly from the app.

---

## Environment Variables

Create a `.env.local` file (never commit it):

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

These are accessed in `lib/supabase.ts`. The `EXPO_PUBLIC_` prefix is required for Expo to expose variables to the client bundle.

---

## Development Workflow

### Initial Setup

```bash
npm install
# Create .env.local with Supabase credentials
npm run dev          # Start Expo dev server
```

### Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Expo dev server (telemetry disabled) |
| `npm run build:web` | Export for web platform |
| `npm run lint` | Run Expo ESLint |
| `npm run typecheck` | Run TypeScript compiler (no emit) |

### Database Migrations

Migrations are in `supabase/migrations/`. To apply:

```bash
npx supabase db push
# or apply individually via Supabase dashboard SQL editor
```

Name new migrations: `NNNN_short_description.sql` (increment the prefix).

### Edge Function Deployment

```bash
npx supabase functions deploy katastar-proxy
```

---

## Code Conventions

### Language & Naming

- **UI code**: English variable names and comments where possible, but Croatian domain terms are preserved exactly as they appear in the database schema (e.g., `puno_ime`, `vlasnik`, `dnevnik_rada`, `skladiste`, `kultura`)
- **Database identifiers**: Croatian only — never translate or alias these in migrations
- **User-facing strings**: Croatian (the app targets Croatian users)

### TypeScript

- Strict mode is enabled — no `any` types without explicit justification
- All API responses should be typed; add interfaces to `services/api.ts` near the relevant functions
- Use `async/await` with `try/catch` — not `.then().catch()` chains

### Styling

- Use **NativeWind** (Tailwind) classes exclusively — no StyleSheet objects unless unavoidable
- Color palette is defined in `tailwind.config.js`:
  - `primary-*` — green shades (main accent)
  - `earth-*` — brown/tan shades (secondary)
- Use `primary-600` for interactive elements (buttons, links)

### Component Structure

- Screens live in `app/` (Expo Router file-based routing)
- No separate `components/` directory yet — keep screen logic in the screen file unless a component is reused in 3+ places
- Follow existing patterns: fetch on mount with `useEffect`, loading state with boolean, error state displayed inline

### File Organization

- Route groups use parentheses: `(auth)`, `(tabs)`
- Layout files are `_layout.tsx`
- Do not create new route groups without understanding Expo Router's layout nesting

---

## Role & Access Control

| Role | Croatian | Permissions |
|------|----------|------------|
| Owner | `vlasnik` | Full access, approve/reject join requests, manage team |
| Member | `clan` | View and log activities, view inventory |
| Worker | `radnik` | Log activities only |

RLS policies enforce this at the database level. Always verify that new Supabase queries work under the correct RLS context.

---

## OPG Onboarding Flow

1. User registers → `profiles` row created via trigger (no `opg_id` yet)
2. App shows `opg-setup.tsx`:
   - **Create**: calls `createOPG()` → sets `opg_id` on profile, role = `vlasnik`
   - **Join**: calls `requestJoinOPG(kod)` → pending state until owner approves
3. After join approval, `profiles.opg_id` is set → app navigates to main tabs

---

## Key Domain Terms (Glossary)

| Croatian | English |
|----------|---------|
| OPG | Family Agricultural Farm |
| parcela | land parcel/plot |
| kultura | crop type |
| povrsina | area (hectares) |
| dnevnik rada | activity/work log |
| skladiste | warehouse/inventory |
| gnojidba | fertilization |
| sjetva | sowing/planting |
| zaštita | crop protection (pesticides) |
| žetva | harvesting |
| mehanizacija | machinery/equipment |
| vlasnik | owner |
| clan | member |
| radnik | worker |
| arkod_id | ARKOD parcel identifier (Croatian gov registry) |
| kod_pristupa | OPG access/join code |
| zahtjev | request |

---

## Common Pitfalls

1. **PostGIS geometry**: The `geometrija` column stores raw PostGIS data. Always use the `v_parcele` view or the `insert_parcela` RPC (which handles GeoJSON conversion) — never insert geometry directly from the app.

2. **RLS context**: All Supabase queries run as the authenticated user. If data isn't returning, check RLS policies first before debugging the query.

3. **Inventory deduction**: Creating a `dnevnik_rada` record with `materijali` (JSONB) automatically triggers inventory deduction. Do not manually deduct inventory after logging an activity.

4. **Offline cache**: `getParcels()` and similar functions write to AsyncStorage. When testing, stale cache can mask API errors — clear AsyncStorage or use a fresh simulator if data looks wrong.

5. **Edge Function CORS**: The `katastar-proxy` edge function handles CORS for government APIs. Do not call cadastre endpoints directly from the app.

6. **Expo Router nesting**: Route groups `(auth)` and `(tabs)` share the root `_layout.tsx` which handles auth state. Do not add authentication logic inside individual screens.
