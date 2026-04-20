# 🌱 SmartSeason — Field Monitoring System

A clean coordination layer for agricultural coordinators and field agents to track crop progress across fields and growing seasons.

Built as a technical assessment — focused on **clean architecture, working business logic, and an intuitive UI**.

---

## ✨ Features

- **Role-based access** — Admin (Coordinator) and Field Agent, enforced server-side via PostgreSQL Row Level Security.
- **Field management** — Admins create, assign, and oversee fields. Each field has name, crop, location, size, planting date, current stage, and assigned agent.
- **Field updates** — Field agents update stage and log notes/observations on their assigned fields. Every change is captured in an audit trail with author and timestamp.
- **Computed status** — Each field's status (`Active`, `At Risk`, `Completed`) is derived from its data. Logic runs both client-side (for instant UI) and server-side (`public.field_status` SQL function — single source of truth).
- **Dashboards** — Role-aware: Admins see everything across all agents; Agents see only their assigned fields. Includes totals, status breakdown chart, recent activity, and a "fields at risk by agent" insight for admins.
- **Modern UI** — Tailwind v4 + shadcn/ui, agriculture-inspired green palette, fully responsive, semantic design tokens, accessible.

---

## 🧱 Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **TanStack Start** (React 19 + Vite 7, SSR) | Type-safe file-based routing, server functions/routes out of the box. |
| Language | **TypeScript** (strict) | Safety end-to-end. |
| Database | **PostgreSQL** (Lovable Cloud / Supabase) | Real relational DB, RLS, triggers, SQL functions. |
| Auth | **Supabase Auth** (email + password) | Battle-tested, JWT-based, integrates with RLS. |
| Authorization | **Postgres RLS + `has_role()` SECURITY DEFINER function** | Roles in a separate `user_roles` table — prevents privilege escalation. |
| Styling | **Tailwind v4 + shadcn/ui** | Semantic tokens defined in `src/styles.css`. |
| Charts | **Recharts** | Lightweight, declarative. |
| Forms / state | React + native forms + sonner toasts | Minimal, no heavy form lib needed. |

---

## 🧠 Design decisions

### 1. Roles in a separate table (security)
Roles live in `public.user_roles`, **never** on the `profiles` table. Access checks go through a `SECURITY DEFINER` function `public.has_role(uid, role)` referenced by every RLS policy. This avoids the classic "user updates their own role to admin" privilege escalation, and prevents recursive RLS errors.

### 2. RLS as the authorization layer (not app code)
The app trusts the database. No `if (user.role === 'admin')` business logic is required to filter rows — RLS does it.

- `Admins view all fields` — `has_role(auth.uid(), 'admin')`
- `Agents view assigned fields` — `assigned_to = auth.uid()`
- Inserting a `field_update` requires you to either be an admin OR be the assigned agent of that field.

### 3. Field status logic
Computed both in SQL (`public.field_status(stage, planting_date, last_updated_at)`) and mirrored in TypeScript (`src/lib/status.ts`) so the client can render instantly without round-trips.

```
Completed  → stage = 'Harvested'
At Risk    → stage IN ('Growing','Ready')
              AND ( days_since_planting > 100
                  OR days_since_last_update > 10 )
Active     → otherwise
```

The "no update in 10 days" rule operationalizes neglect: a field that nobody has touched recently is something a coordinator should look at. The "100-day" rule catches fields that should have moved past the growing stage by now.

### 4. Audit trail
Every stage change or note creates a row in `field_updates`. This gives admins an honest, append-only log of what each agent has done.

### 5. SSR-safe Supabase client
A tiny lazy-Proxy wrapper around `createClient` so that build-time bundling never trips on missing env vars. Three clients exist: browser (`client.ts`), authenticated server middleware (`auth-middleware.ts`), and admin/service-role (`client.server.ts` — used only by the seed endpoint).

---

## 🚀 Getting started (local)

This project runs on Lovable Cloud — there's nothing to install or configure. The preview is live in the editor.

### First-time seeding
The database is empty until you seed it. Hit this URL **once**:

```
<your-preview-url>/api/seed
```

It will create:
- 1 admin user
- 2 field agent users
- 6 realistic Kenyan-context sample fields (maize, beans, coffee, tomatoes, tea, rice)

The endpoint is **idempotent** — safe to call multiple times.

### Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin (Coordinator) | `admin@smartseason.app` | `Admin123!` |
| Field Agent 1 | `agent1@smartseason.app` | `Agent123!` |
| Field Agent 2 | `agent2@smartseason.app` | `Agent123!` |

The login page also shows these — click any to auto-fill.

---

## 📁 Project structure

```
src/
├── routes/
│   ├── __root.tsx              # Root layout — wraps Outlet in AuthProvider + Toaster
│   ├── index.tsx               # Redirects to /dashboard
│   ├── login.tsx               # Public login page
│   ├── _app.tsx                # Protected layout (sidebar + auth guard)
│   ├── _app.dashboard.tsx      # Role-aware dashboard
│   ├── _app.fields.tsx         # Searchable/filterable field list
│   ├── _app.fields.$id.tsx     # Field detail + update form + history
│   └── api.seed.ts             # Idempotent demo seeder (server route)
├── components/
│   ├── AppSidebar.tsx
│   ├── NewFieldDialog.tsx
│   ├── StageBadge.tsx
│   ├── StatusBadge.tsx
│   └── ui/                     # shadcn primitives
├── lib/
│   ├── auth.tsx                # Auth provider + useAuth hook
│   ├── status.ts               # Status logic (mirror of SQL function)
│   └── utils.ts
├── integrations/supabase/
│   ├── client.ts               # Browser client (anon key, RLS applies)
│   ├── client.server.ts        # Service-role client (server-only)
│   ├── auth-middleware.ts      # Protect server functions
│   └── types.ts                # Generated DB types
└── styles.css                  # Design tokens (oklch) + Tailwind v4 setup
```

---

## 📐 Data model

```
auth.users                      ← managed by Supabase Auth
  ↑
profiles (id PK→users, full_name, email)
user_roles (user_id, role: 'admin' | 'field_agent')

fields
  id, name, crop_type, location, size_hectares,
  planting_date, stage, assigned_to→users,
  created_by→users, last_updated_at, created_at

field_updates                   ← append-only audit log
  id, field_id→fields, author_id→users,
  previous_stage, new_stage, note, created_at
```

A trigger on `fields` updates `last_updated_at` on every UPDATE — feeding the status logic.

---

## 🤔 Assumptions

- A field has exactly one assigned agent at a time (admins can re-assign).
- Stage transitions are not strictly enforced (an agent could go from `Planted` → `Ready`); in practice this almost never happens but we don't block it. The audit trail captures intent.
- Anonymous signup is disabled — only the admin (via the seed endpoint or the Supabase dashboard) can create new users.
- "Last updated" uses the `fields.last_updated_at` column, which is touched by both stage changes and explicit note saves. This is what drives the "no update in 10 days → at risk" rule.
- All times are stored UTC; the UI renders them in the user's locale.

---

## 🧪 Trying it out

1. Visit the preview URL.
2. Hit `/api/seed` (once) to provision demo data.
3. Sign in as **admin** — see all 6 fields, status breakdown, "at risk by agent" insight.
4. Sign out, sign in as **agent1** — see only fields assigned to that agent.
5. Open a field, change its stage, add a note — watch the history grow.
6. Sign back in as admin — see the new update appear in "Recent updates" on the dashboard.

---

## 📝 Notes for the reviewer

- The status logic is implemented **twice on purpose**: once in SQL (the source of truth, never bypassable) and once in TypeScript (so the dashboard renders instantly without an extra round-trip). They are kept in sync — see `src/lib/status.ts` and the `public.field_status` function in the migration.
- All authorization is **enforced in the database via RLS**, not in client code. You could hit the Postgres API directly with an agent's JWT and you still couldn't see another agent's fields.
- I deliberately kept the surface area small (no dark-mode toggle, no rich-text notes, no notifications) to honor the "do not over-engineer" guidance. The architecture is ready for those additions.
