# Bug Report

Found by writing tests against the documented API contract (README/ASSIGNMENT task shape and endpoint table) and comparing expected vs. actual behavior. Each bug below is backed by a test in `tests/` — search for the bug number in test titles/comments to see the exact repro.

---

## Bug #1 — `getByStatus` matches on substring instead of exact status

**Where:** `src/services/taskService.js`, line 9

```js
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
```

**Expected:** `GET /tasks?status=X` returns only tasks whose status is *exactly* `X`.

**Actual:** Because it uses `String.prototype.includes`, any query string that happens to be a *substring* of a valid status value matches too. For example, filtering by `status=progress` incorrectly returns every `in_progress` task, even though `"progress"` isn't a valid status on its own. `status=o` would match `todo`, `in_progress`, and `done` all at once (each contains the letter "o").

**How I found it:** Writing a unit test that filtered by a status-like-but-not-quite string and asserting an empty result — the test failed because the API happily returned matches.

**Suggested fix:**
```js
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```
One-line fix. Not fixed in this submission (see Bug #2 for the one I did fix) — this one is included for the reviewer to pick up, and `tests/unit/taskService.test.js` has a test (`'BUG: incorrectly matches on partial/substring status queries'`) that documents the current behavior so it's easy to flip once the fix lands.

---

## Bug #2 — Pagination offset is off by one page — **FIXED in this submission**

**Where:** `src/services/taskService.js`, `getPaginated`

```js
// before
const getPaginated = (page, limit) => {
  const offset = page * limit;
  return tasks.slice(offset, offset + limit);
};
```

**Expected:** `GET /tasks?page=1&limit=10` returns the *first* 10 tasks (offset 0).

**Actual:** `offset = page * limit` means page 1 with limit 10 computes `offset = 10`, skipping the entire first page. Page 1 shows what should be page 2's results, page 2 shows page 3's results, and so on — the true first page of data is unreachable through the API. Compounding this, `routes/tasks.js` defaults `page` via `parseInt(page) || 1`, so `page=0` (which would coincidentally have produced the correct offset of 0) gets rewritten to `page=1` before it ever reaches the service — there's no way to hit offset 0 through the HTTP API at all.

**How I found it:** Unit test creating 5 tasks and asserting `getPaginated(1, 2)` returns the first two — it returned items 3 and 4 instead.

**Fix applied:**
```js
const getPaginated = (page, limit) => {
  const safePage = page > 0 ? page : 1;
  const offset = (safePage - 1) * limit;
  return tasks.slice(offset, offset + limit);
};
```
Also guards against a `page` of `0` or negative being passed directly to the service (defensive — the route layer already normalizes this, but the service shouldn't rely on that). Tests in both `tests/unit/taskService.test.js` and `tests/integration/tasks.routes.test.js` were written against the *correct* behavior and pass now that the fix is in.

---

## Bug #3 — `update` (`PUT /tasks/:id`) allows overwriting protected fields

**Where:** `src/services/taskService.js`, `update`

```js
const update = (id, fields) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const updated = { ...tasks[index], ...fields };
  tasks[index] = updated;
  return updated;
};
```

**Expected:** `PUT /tasks/:id` updates editable fields (title, description, status, priority, dueDate). Fields like `id`, `createdAt`, and `completedAt` should be server-controlled and not client-writable.

**Actual:** `validateUpdateTask` never restricts which keys are present in the body, and `update()` spreads the *entire* incoming `fields` object onto the stored task. A `PUT /tasks/:id` body of `{ "id": "whatever" }` silently changes the task's id, making the original task unreachable by its old id (essentially an orphaned record). The same applies to `createdAt`/`completedAt` — a client can fabricate history. There's a related consistency issue too: if a task is completed (`status: 'done'`, `completedAt` set) and then a `PUT` sets `status` back to `todo`, `completedAt` is never cleared, leaving a task that's simultaneously "not done" and "has a completion timestamp."

**How I found it:** Unit test calling `update(id, { id: 'hijacked-id' })` and asserting the id shouldn't change — it changed.

**Suggested fix:** Whitelist the fields `update` will accept, e.g.:
```js
const EDITABLE_FIELDS = ['title', 'description', 'status', 'priority', 'dueDate'];

const update = (id, fields) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const patch = {};
  for (const key of EDITABLE_FIELDS) {
    if (fields[key] !== undefined) patch[key] = fields[key];
  }
  // if status is being cleared away from 'done', also clear completedAt
  if (patch.status && patch.status !== 'done') patch.completedAt = null;

  const updated = { ...tasks[index], ...patch };
  tasks[index] = updated;
  return updated;
};
```
Not fixed in this submission — kept the fix I did make (Bug #2) narrowly scoped. `tests/unit/taskService.test.js` has a test (`'BUG: allows overwriting protected fields such as id'`) documenting the current behavior.

---

## Bug #4 — `completeTask` silently resets priority to `medium`

**Where:** `src/services/taskService.js`, `completeTask`

```js
const completeTask = (id) => {
  const task = findById(id);
  if (!task) return null;

  const updated = {
    ...task,
    priority: 'medium',
    status: 'done',
    completedAt: new Date().toISOString(),
  };
  ...
};
```

**Expected:** `PATCH /tasks/:id/complete` should only touch `status` and `completedAt`. Nothing in the API docs or task shape suggests completing a task should change its priority.

**Actual:** Every completed task has its priority forcibly overwritten to `'medium'`, regardless of what it was set to before (e.g. a `high` priority task loses that information permanently the moment it's completed). This looks like a copy/paste artifact rather than intentional behavior — there's no product reason given anywhere for "priority resets on completion."

**How I found it:** Unit test creating a task with `priority: 'high'`, completing it, and asserting priority is still `'high'` — it came back `'medium'`.

**Suggested fix:** Drop the `priority: 'medium'` line entirely:
```js
const updated = {
  ...task,
  status: 'done',
  completedAt: new Date().toISOString(),
};
```
Not fixed in this submission. `tests/unit/taskService.test.js` has a test (`'BUG: resets priority to medium regardless of the original value'`) documenting the current behavior.

---

## Summary

| # | Bug | Location | Severity | Status |
|---|-----|----------|----------|--------|
| 1 | `getByStatus` substring matching | `taskService.js` | Medium — wrong filter results | Documented, not fixed |
| 2 | Pagination offset off-by-one | `taskService.js` | High — first page of data is unreachable | **Fixed** |
| 3 | `update` mass-assignment of protected fields | `taskService.js` | High — data integrity / id hijack | Documented, not fixed |
| 4 | `completeTask` resets priority | `taskService.js` | Low/Medium — silent data loss | Documented, not fixed |

I picked Bug #2 to fix because it's the highest-impact, most clearly unintentional, and most self-contained: it breaks a documented, actively-used feature (pagination) for every caller, and the fix doesn't ripple into validation rules or API contracts the way #3 does.
