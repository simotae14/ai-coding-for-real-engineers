# Database Conventions

Database is SQLite via better-sqlite3 + Drizzle. The db instance is initialized in `app/db/index.ts` with WAL mode and foreign keys enabled. Don't create new `Database` connections in service code unless you have a really good reason.

## IDs

DB ids are always `integer().primaryKey({ autoIncrement: true })`. Don't use UUIDs.

## Timestamps

Timestamps are stored as ISO strings in `text` columns, not as unix timestamps or integers. Use `$defaultFn(() => new Date().toISOString())` for defaults.

## Booleans

Booleans in SQLite are stored as integers with Drizzle's `mode: "boolean"`, e.g. `integer("ppp_enabled", { mode: "boolean" })`.

## Soft deletes

For soft deletes, use a nullable `text("deleted_at")` column. Don't actually delete rows. See `lessonComments` in the schema for an example.

## Price storage

Price values are stored in cents (integers). See [frontend-and-ui.md](frontend-and-ui.md) for how to display them with `formatPrice()`.
