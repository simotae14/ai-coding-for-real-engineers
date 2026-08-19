# Services & Testing Conventions

## Which files need tests

Anything marked as a "service" (by filename, e.g. `authTokenService.ts`) should have tests written for it in an accompanying `.test.ts` file.

## Tagged results

When returning tagged/discriminated results from services (not validation), use the `{ ok: true, ... } | { ok: false, error: string }` pattern. See `couponService` for reference.

## Test setup

Tests use vitest with globals. Every test file needs to mock the db module like this:

```ts
let testDb: ReturnType<typeof createTestDb>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));
```

The mock MUST come before importing the service under test. Use `createTestDb()` and `seedBaseData()` from `~/test/setup` in `beforeEach`.
