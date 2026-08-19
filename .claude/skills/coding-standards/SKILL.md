---
name: coding-standards
description: Project's coding standards for this codebase. Use whenever implementing or editing code in this repo, whenever reviewing code or a PR, and whenever coding standards or conventions are referenced or in question.
---

# Coding Standards

This repo's coding standards, split by area. Always check these before writing or reviewing code — don't rely on guessing conventions from surrounding code alone, since some rules (ids, timestamps, booleans, soft deletes) aren't obvious from a quick read.

## How to use this skill

1. Always read [typescript.md](typescript.md) — it applies to every file.
2. Read the file(s) matching what you're touching:
   - Touching `app/db/` schema, migrations, or any query/table shape → [database.md](database.md)
   - Touching `app/components/`, styling, or price display → [frontend-and-ui.md](frontend-and-ui.md)
   - Touching `app/routes/`, loaders/actions, forms, or auth checks → [routes-and-forms.md](routes-and-forms.md)
   - Writing/editing a `*Service.ts` file or any `.test.ts` file → [services-and-testing.md](services-and-testing.md)
3. During a **code review**, read all five files — a review should check standards across the whole diff, not just one area.
4. During **implementation**, read only the file(s) relevant to the code you're writing, plus typescript.md.

## Buckets at a glance

| File | Covers |
|---|---|
| [typescript.md](typescript.md) | Object params, `~/*` import alias, no `any` |
| [database.md](database.md) | DB connection, ids, timestamps, booleans, soft deletes, price storage |
| [frontend-and-ui.md](frontend-and-ui.md) | Component placement, styling (`cn()`), price display (`formatPrice()`) |
| [routes-and-forms.md](routes-and-forms.md) | React Router v7 routing, form validation, multi-intent actions, auth |
| [services-and-testing.md](services-and-testing.md) | Which files need tests, tagged result pattern, vitest + db-mocking setup |

If a rule seems to be missing or you're unsure which bucket it belongs in, ask before inventing a new convention.
