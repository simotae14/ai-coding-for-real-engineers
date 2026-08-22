# Plan: Instructor Revenue Analytics Dashboard

> Source PRD: `prd/instructor-analytics-dashboard.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**:
  - `/instructor/analytics` — instructor-only, registered in `app/routes.ts` alongside existing `instructor/*` routes.
  - `/admin/instructor/:instructorId/analytics` — admin-only, separate namespace from instructor routes, registered alongside existing `admin/*` routes.
  - Both routes are thin loaders that authenticate/authorize via `getCurrentUserId(request)` + role check against `UserRole.Instructor` / `UserRole.Admin` (same pattern as `app/routes/instructor.tsx` and `app/routes/admin.users.tsx`), then delegate all data fetching to `analyticsService`. The instructor route always passes the current user's own ID to the service (never a client-supplied ID); the admin route reads `instructorId` from URL params.
  - Both routes render a shared, presentational `AnalyticsDashboard` component.
- **URL search param**: `?period=7d|30d|12m|all`, defaulting to `30d`. Drives the loader query and all sections of the dashboard (summary cards, chart, table) — one period, one page, no mixed scopes. The period selector navigates (not client-side state) so the page stays bookmailable and loader-driven.
- **Schema**: no changes. Data sources are the existing `purchases` (`pricePaid`, cents), `enrollments` (`enrolledAt`), `courseRatings` (`rating`, `createdAt`), and `courses` (`instructorId`) tables.
- **Key model — `analyticsService`**: new deep module in `app/services/analyticsService.ts`, following the existing service-layer convention (positional params, plain functions over `db`, paired `.test.ts`). Given an instructor ID and a period, returns in one call:
  - summary totals (total revenue, total enrollments, average rating + rating count)
  - revenue time-series data points (daily granularity for 7d/30d, monthly for 12mo/all; zero-revenue points included, no gaps)
  - per-course breakdown (title, list price, revenue, sales count, enrollment count, average rating, rating count)
  - Return type is additive/extensible so later metrics (PPP impact, geographic breakdown, etc.) can be added without breaking the interface.
- **New dependency**: `recharts`, used directly (no shadcn chart wrapper) for the revenue line chart.
- **Formatting**: revenue in cents converted to dollars via the existing `formatPrice()` util (`app/lib/utils.ts`).
- **Instructor isolation**: enforced entirely at the loader layer — the instructor route never accepts an instructor ID from the client; the service itself doesn't re-check identity.
- **Table sorting**: client-side only (all data already loaded per period), every column sortable, default sort revenue descending.

---

## Phase 1: Instructor summary view with period filter

**User stories**: 1, 2, 3, 5, 6, 12, 16, 17, 18, 19, 20

### What to build

The first end-to-end slice: `analyticsService` computing summary totals (total revenue, total enrollments, average rating + count) for a given instructor and period; the `/instructor/analytics` route with a loader that authenticates the user as an instructor (redirecting unauthenticated users to login, blocking students with a 403), reads `?period=` from the URL (defaulting to `30d`), and calls the service with the instructor's own user ID; and a dashboard UI showing three summary cards plus a period selector (7d / 30d / 12mo / All) that navigates via URL search params, updating all shown data. Revenue is displayed in dollars via `formatPrice()`.

### Acceptance criteria

- [ ] `analyticsService` exposes a function that returns summary totals (revenue, enrollments, avg rating + rating count) scoped to an instructor and a period
- [ ] Visiting `/instructor/analytics` with no `?period=` defaults to 30 days
- [ ] Switching the period tab updates the URL and the summary cards reflect the new period
- [ ] An unauthenticated request is redirected to login
- [ ] A student user is blocked (403) from the route
- [ ] An instructor only ever sees totals for their own courses, never another instructor's
- [ ] Revenue is rendered in dollars, formatted from cents

---

## Phase 2: Revenue trend chart and per-course table

**User stories**: 4, 7, 8, 9, 21, 22

### What to build

Extend `analyticsService`'s return value with a revenue time-series (auto-scaling granularity: daily for 7d/30d, monthly for 12mo/All, zero-revenue periods rendered as $0 points so the line is continuous) and a per-course breakdown (list price, revenue, sales count, enrollment count, average rating, rating count — all scoped to the selected period). Add `recharts` as a dependency and render a revenue-over-time line chart. Add a per-course table below the chart, sortable by clicking any column header (ascending/descending), defaulting to revenue descending. Both the chart and table react to the same period selector built in Phase 1.

### Acceptance criteria

- [ ] `analyticsService` returns correctly bucketed time-series points (daily vs. monthly) for a given period
- [ ] `analyticsService` returns a per-course breakdown correctly attributing revenue, sales, enrollments, and ratings to the right courses
- [ ] The line chart renders using `recharts`, updates with the period selector, and shows $0 points instead of gaps for periods with no revenue
- [ ] The per-course table shows all required columns and defaults to sorting by revenue descending
- [ ] Clicking any column header toggles ascending/descending client-side sort
- [ ] Switching periods updates the chart and table together with the summary cards from Phase 1

---

## Phase 3: Empty state and admin access

**User stories**: 10, 13, 14, 15

### What to build

Add a friendly empty-state message (e.g. "No revenue data yet. Publish a course to start tracking analytics.") shown in place of the full dashboard when the instructor has no courses or no data in the selected period. Add the admin-only `/admin/instructor/:instructorId/analytics` route, whose loader authenticates the user as an admin, reads the instructor ID from URL params and the period from search params, and renders the same shared `AnalyticsDashboard` component. Add a "View Analytics" link next to instructor rows on the admin users page, and an "Analytics" entry in the instructor sidebar nav pointing at `/instructor/analytics`.

### Acceptance criteria

- [ ] An instructor with no courses, or no data in the selected period, sees the single empty-state message instead of a zeros-everywhere dashboard
- [ ] `/admin/instructor/:instructorId/analytics` requires admin role and renders the same dashboard layout/data an instructor would see for that instructor
- [ ] The admin route is authorization-checked independently of the instructor route (no shared bypass)
- [ ] The admin users page shows a "View Analytics" link for instructor-role users, linking to their analytics route
- [ ] The instructor sidebar shows an "Analytics" nav entry linking to `/instructor/analytics`
