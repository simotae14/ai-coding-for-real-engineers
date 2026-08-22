---
name: do-work
description: Carry a single unit of work from plan to committed code — plan it, implement it, verify it with pnpm typecheck and pnpm run test, then commit. Use when the user hands you one discrete task, phase, or ticket to complete end-to-end (e.g. "do this phase", "implement X", a plan phase from prd-to-plan).
---

# Do Work

Take one discrete unit of work (a task description, plan phase, or ticket) from plan to committed code, autonomously.

## Process

### 1. Plan (optional)

If the task has not already been planned, create a plan for it.


### 2. Implement

Make the change following the plan and this repo's coding standards. Keep the diff scoped to the unit of work — no unrelated cleanup or drive-by refactors.

### 3. Feedback loop

Run, in order:

```
pnpm typecheck
pnpm run test
```

If either fails:
1. Read the failure output.
2. Fix the root cause (not the check).
3. Re-run both commands.

Repeat until both pass. Do not proceed to commit with a red loop.

### 4. Commit

Once typecheck and tests are both green:

- `git status` and `git diff` to review exactly what changed.
- Stage only the files touched by this unit of work.
- Commit with a message describing why the change was made, not just what changed.
- Do not push.

## Notes

- This skill assumes an existing git repository and a working `pnpm` setup. If `pnpm` is missing, use the `pnpm-not-found` skill first.
- If the unit of work is one phase of a larger plan (e.g. from `prd-to-plan`), treat only that phase as in scope — later phases are out of scope even if related code is nearby.
