# Routes & Forms Conventions

## Routing

We use React Router v7 (file-based routing). Routes go in `app/routes/`. Each route file can export `loader`, `action`, `default` (component), `meta`, and `ErrorBoundary`. Don't put business logic directly in routes — call into services instead. See [services-and-testing.md](services-and-testing.md) for service conventions.

## Form validation

For form validation in route actions, use `parseFormData(formData, zodSchema)` from `~/lib/validation`. It returns `{ success, data, errors }`. For route params use `parseParams`. For JSON request bodies use `parseJsonBody`.

## Multi-intent actions

When a single route action needs to handle multiple different form submissions (like a page with both a "mark complete" button and a "delete comment" button), use Zod discriminated unions on an `intent` field:

```ts
const schema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("mark-complete") }),
  z.object({
    intent: z.literal("delete-comment"),
    commentId: z.coerce.number(),
  }),
]);
```

## Auth

Auth is cookie-based via `~/lib/session`. Use `getCurrentUserId(request)` in loaders/actions. Returns `number | null`. Redirect to `/login` if null.
