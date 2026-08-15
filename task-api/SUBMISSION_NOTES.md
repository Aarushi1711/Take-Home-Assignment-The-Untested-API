# Submission Notes

## What I'd test next with more time

- **Concurrency / data races.** The store is a plain in-memory array with no locking. Two simultaneous `PUT`s to the same task, or a `DELETE` racing a `PATCH .../complete`, could interleave in surprising ways. Worth writing tests that fire concurrent requests and assert the final state is one of the two writes, not a corrupted merge.
- **Input shape edge cases beyond what validators check.** e.g. extremely long `title`/`description` strings, unicode/emoji in `assignee`, `dueDate` values that parse but are nonsensical (like year 0 or far future), and non-object JSON bodies (arrays, plain strings) hitting `POST`/`PUT`.
- **`getPaginated` with `limit=0` or a negative `limit`.** Right now nothing guards against that — `limit <= 0` would produce an empty or nonsensical slice. I only guarded `page`, not `limit`.
- **The interaction between `PUT` and `completedAt`/`status`** more thoroughly — see Bug #3 in BUGS.md. I'd want tests (and a fix) for what happens when a done task is edited back to `todo`.
- **Load/perf** — `getAll()`, `getByStatus()`, etc. all do full-array scans/copies. Fine at this scale, but if this ever backs a real dataset it's worth knowing the complexity characteristics before they surprise someone in production.
- **Trailing-slash / case-sensitivity / unknown-route behavior** — e.g. what does `GET /Tasks` or `GET /tasks/` do? Express defaults may not match what's documented.

## What surprised me in the codebase

- The **pagination bug (Bug #2)** was the most surprising because it's not an edge case — it breaks the *primary* use of pagination for every single caller. `page=1` (the natural first thing anyone would try) returns page 2's data. It's the kind of bug that's invisible in casual manual testing (if you only have a handful of tasks, `page=1&limit=10` still returns everything and looks correct) but breaks immediately with more data.
- `completeTask` quietly resetting `priority` to `medium` (Bug #4) stood out because it's unrelated to what the function name promises — it reads like a leftover from an earlier version where "complete" implied "de-prioritize," or a copy/paste mistake.
- The **README/ASSIGNMENT.md status enum mismatch** — ASSIGNMENT.md's task shape lists `pending | in_progress | completed`-style values in one doc and `todo | in_progress | done` in another, while the actual code uses `todo | in_progress | done`. Not a code bug, but worth flagging: it's the kind of doc drift that causes an API consumer to write a client against the wrong enum.
- How permissive `update()` is (Bug #3) — nothing stops a client-supplied `id` from being written straight into the store. It's a small function but has an outsized blast radius since every `PUT` goes through it.

## Questions I'd ask before shipping this to production

- Is the in-memory store intentional for this stage (e.g., prototype/demo), or is persistence (Postgres, etc.) already planned? That changes how much effort is worth investing in the current data-layer bugs versus just replacing the layer.
- What should happen to `assignee` when a task is deleted or reset — is there a notion of "unassign" (`assignee: null`), or is reassignment (overwrite) the only supported flow? I implemented straightforward overwrite-on-reassign since nothing in the spec suggested blocking it, but a real product might want an explicit `DELETE /tasks/:id/assign` or an audit trail of past assignees.
- Should `assignee` be validated against a known set of users (like `status`/`priority` are validated against enums), or is free-text intentional for now?
- Is there an auth/authorization layer coming? Right now anyone can hit any endpoint for any task — worth knowing before this is public-facing.
- For Bug #3 (mass assignment on `PUT`): is a full whitelist-based rewrite acceptable, or is there a reason the current "spread everything" behavior exists (e.g., some internal caller relies on it)? I'd want to confirm before changing the contract.
