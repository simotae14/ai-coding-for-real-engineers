# Plan: Instructor Revenue Analytics Dashboard

Source PRD: `prd/instructor-analytics-dashboard.md`

## Phase 1 — analyticsService (core logic + tests)

The deep module everything else depends on. Build and test it in isolation before any route or UI exists.

- Add `analyticsService` with a single entry point that takes `instructorId` + `period` (`7d | 30d | 12m | all`) and returns:
  - Summary totals: total revenue (cents, from `purchases.pricePaid`), total enrollments (from `enrollments.enrolledAt`), average rating + rating count (from `courseRatings.rating`/`createdAt`)
  - Revenue time series (daily buckets for `7d`/`30d`, monthly buckets for `12m`/`all`), zero-filled for periods with no purchases
  - Per-course breakdown: title, list price, revenue, sales count, enrollment count, average rating, rating count — all scoped to the period
- Enforce instructor isolation inside the service (only courses owned by `instructorId`).
- For `all`, derive the earliest bucket from the instructor's first purchase.
- Write `analyticsService.test.ts` following the `purchaseService.test.ts` / `couponService.test.ts` pattern (`createTestDb()`, `seedBaseData()`).
- Cover: summary totals per period, time series bucketing (daily vs monthly), per-course attribution, period-boundary filtering, instructor isolation, and edge cases (no courses, no purchases, no ratings, zero-revenue periods).

**Exit criteria:** service fully tested and correct with no consumers yet.

## Phase 2 — Shared AnalyticsDashboard component

Build the presentational component against fixture/mock data so it can be developed independent of routing.

- Period selector tabs (7d / 30d / 12mo / All) — navigation-based (updates URL search params), no internal state for the period.
- Three summary cards: Total Revenue (via `formatPrice()`), Total Enrollments, Average Rating.
- Revenue line chart via `recharts` (add as a new dependency), used directly — no shadcn chart wrapper.
- Sortable per-course table (client-side sort, every column sortable, default sort revenue descending).
- Empty state: single friendly message when no courses or no data in period, replacing the KPI/chart/table entirely.
- Component receives all data as props — no data fetching inside it.

**Exit criteria:** dashboard renders correctly against representative mock data, including empty state.

## Phase 3 — Instructor route

- Add `/instructor/analytics` route with a loader that:
  - Authenticates via `getCurrentUserId(request)`, requires `UserRole.Instructor`
  - Reads `?period=` (default `30d`)
  - Calls `analyticsService` with the authenticated user's own id (never client-supplied)
  - Returns data to the component
- Route component renders `AnalyticsDashboard` with loader data.
- Verify: student and unauthenticated access are blocked/redirected per existing auth conventions.

**Exit criteria:** instructor can load their own dashboard end-to-end with real data.

## Phase 4 — Admin route

- Add `/admin/instructor/:instructorId/analytics` route with a loader that:
  - Authenticates via `getCurrentUserId(request)`, requires `UserRole.Admin`
  - Reads `instructorId` from URL params, `?period=` from search params
  - Calls the same `analyticsService`
- Route component renders the same `AnalyticsDashboard`.
- Verify: non-admin access is blocked; route is fully separate from the instructor path.

**Exit criteria:** admin can view any instructor's dashboard via the admin-only route.

## Phase 5 — Navigation wiring

- Instructor sidebar: add "Analytics" entry linking to `/instructor/analytics`, following the existing role-based nav pattern.
- Admin users page: add a "View Analytics" link next to instructor-role users, linking to `/admin/instructor/:id/analytics`.

**Exit criteria:** both entry points are reachable from the UI, no direct-URL-only access required.

## Phase 6 — End-to-end verification

- Manually walk through: instructor with multiple courses across all four periods, an instructor with no courses/data (empty state), admin viewing an instructor, student/unauthenticated blocked access.
- Confirm URL is bookmarkable (`?period=` persists and drives the loader on direct navigation).
- Confirm table sort and chart granularity switch correctly across periods.

---

## Out of scope (explicitly deferred per PRD)

PPP impact analysis, team-vs-individual breakdown, geographic breakdown, platform-wide admin analytics, custom date ranges, period-over-period comparison, export, real-time updates, refunds, revenue sharing, enrollment-over-time chart, student-level purchase details, quiz/video engagement metrics, course completion rate, table status filtering, sales-count KPI card, course title linking.

## Schema changes

None — Phase 1 reads existing tables only (`purchases`, `enrollments`, `courseRatings`, `courses`).
