const taskService = require('../../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

describe('create', () => {
  it('creates a task with the provided title and sensible defaults', () => {
    const task = taskService.create({ title: 'Write tests' });

    expect(task.title).toBe('Write tests');
    expect(task.description).toBe('');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.dueDate).toBeNull();
    expect(task.completedAt).toBeNull();
    expect(task.id).toEqual(expect.any(String));
    expect(task.createdAt).toEqual(expect.any(String));
  });

  it('respects explicitly provided fields instead of defaulting them', () => {
    const task = taskService.create({
      title: 'Ship feature',
      description: 'Some detail',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-01-01T00:00:00.000Z',
    });

    expect(task).toMatchObject({
      title: 'Ship feature',
      description: 'Some detail',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-01-01T00:00:00.000Z',
    });
  });

  it('assigns each task a unique id', () => {
    const a = taskService.create({ title: 'A' });
    const b = taskService.create({ title: 'B' });

    expect(a.id).not.toBe(b.id);
  });
});

describe('getAll', () => {
  it('returns an empty array when there are no tasks', () => {
    expect(taskService.getAll()).toEqual([]);
  });

  it('returns a snapshot copy, not a live reference into the store', () => {
    taskService.create({ title: 'A' });

    const all = taskService.getAll();
    all.push({ id: 'not-real' });

    expect(taskService.getAll()).toHaveLength(1);
  });
});

describe('findById', () => {
  it('finds an existing task by id', () => {
    const created = taskService.create({ title: 'Find me' });

    expect(taskService.findById(created.id)).toEqual(created);
  });

  it('returns undefined for a non-existent id', () => {
    expect(taskService.findById('does-not-exist')).toBeUndefined();
  });
});

describe('getByStatus', () => {
  it('returns tasks matching a given status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'done' });

    const result = taskService.getByStatus('done');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('B');
  });

  it('returns an empty array when no tasks match', () => {
    taskService.create({ title: 'A', status: 'todo' });

    expect(taskService.getByStatus('done')).toEqual([]);
  });

  // BUG #1 (see BUGS.md): getByStatus matches with String.includes() rather
  // than an exact comparison, so a query that is merely a *substring* of a
  // valid status value incorrectly matches. This test documents the actual,
  // current (buggy) behavior — it is expected to keep passing until the bug
  // is fixed. Not fixed in this submission; see BUGS.md #1 for the reasoning
  // and suggested fix.
  it('BUG: incorrectly matches on partial/substring status queries', () => {
    taskService.create({ title: 'A', status: 'in_progress' });
    taskService.create({ title: 'B', status: 'todo' });

    const result = taskService.getByStatus('progress');

    // A correct implementation would return [] here, since "progress" is
    // not a valid status. The current implementation returns the
    // in_progress task because 'in_progress'.includes('progress') === true.
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('in_progress');
  });
});

describe('getPaginated', () => {
  // Fixed as part of this submission — see BUGS.md #2 / BUGS.md "Fixed" section.
  it('returns the first page starting from the very first item', () => {
    const created = [0, 1, 2, 3, 4].map((i) => taskService.create({ title: `Task ${i}` }));

    const page1 = taskService.getPaginated(1, 2);

    expect(page1).toEqual([created[0], created[1]]);
  });

  it('returns the second page correctly', () => {
    const created = [0, 1, 2, 3, 4].map((i) => taskService.create({ title: `Task ${i}` }));

    const page2 = taskService.getPaginated(2, 2);

    expect(page2).toEqual([created[2], created[3]]);
  });

  it('returns an empty array once pages run out', () => {
    taskService.create({ title: 'Only task' });

    expect(taskService.getPaginated(5, 10)).toEqual([]);
  });

  it('treats a page number below 1 as page 1', () => {
    const created = [0, 1].map((i) => taskService.create({ title: `Task ${i}` }));

    expect(taskService.getPaginated(0, 2)).toEqual(created);
  });
});

describe('getStats', () => {
  it('counts tasks by status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'todo' });
    taskService.create({ title: 'C', status: 'in_progress' });
    taskService.create({ title: 'D', status: 'done' });

    expect(taskService.getStats()).toMatchObject({ todo: 2, in_progress: 1, done: 1 });
  });

  it('counts a task as overdue when its due date is in the past and it is not done', () => {
    taskService.create({ title: 'Overdue', status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
    taskService.create({ title: 'Not due yet', status: 'todo', dueDate: '2099-01-01T00:00:00.000Z' });

    expect(taskService.getStats().overdue).toBe(1);
  });

  it('does not count a done task as overdue even if its due date has passed', () => {
    taskService.create({ title: 'Late but done', status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });

    expect(taskService.getStats().overdue).toBe(0);
  });

  it('returns zeroed counts for an empty store', () => {
    expect(taskService.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it('ignores a task whose status is outside the known set when counting', () => {
    // taskService.create() itself does not validate status (that happens at
    // the route/validator layer), so this exercises the defensive
    // `counts[t.status] !== undefined` check directly.
    taskService.create({ title: 'Weird', status: 'archived' });

    expect(taskService.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });
});

describe('update', () => {
  it('updates only the provided fields, leaving the rest untouched', () => {
    const created = taskService.create({ title: 'Original', priority: 'low' });

    const updated = taskService.update(created.id, { title: 'Updated' });

    expect(updated.title).toBe('Updated');
    expect(updated.priority).toBe('low');
    expect(updated.id).toBe(created.id);
  });

  it('returns null when updating a non-existent id', () => {
    expect(taskService.update('nope', { title: 'x' })).toBeNull();
  });

  // BUG #3 (see BUGS.md): update() spreads the raw fields object directly
  // onto the stored task with no field whitelist, so a caller can overwrite
  // protected fields like id/createdAt/completedAt. Not fixed in this
  // submission; this test documents the actual, current (buggy) behavior.
  it('BUG: allows overwriting protected fields such as id', () => {
    const created = taskService.create({ title: 'Original' });

    const updated = taskService.update(created.id, { id: 'hijacked-id' });

    expect(updated.id).toBe('hijacked-id');
    // The task is now unreachable by its original id.
    expect(taskService.findById(created.id)).toBeUndefined();
  });
});

describe('remove', () => {
  it('removes an existing task and returns true', () => {
    const created = taskService.create({ title: 'Delete me' });

    expect(taskService.remove(created.id)).toBe(true);
    expect(taskService.findById(created.id)).toBeUndefined();
  });

  it('returns false when removing a non-existent id', () => {
    expect(taskService.remove('nope')).toBe(false);
  });
});

describe('completeTask', () => {
  it('marks a task done and stamps completedAt', () => {
    const created = taskService.create({ title: 'Finish', status: 'todo' });

    const completed = taskService.completeTask(created.id);

    expect(completed.status).toBe('done');
    expect(completed.completedAt).toEqual(expect.any(String));
  });

  it('returns null for a non-existent id', () => {
    expect(taskService.completeTask('nope')).toBeNull();
  });

  // BUG #4 (see BUGS.md): completeTask unconditionally resets priority to
  // 'medium', silently discarding whatever priority the task actually had.
  // Not fixed in this submission; documents the actual, current behavior.
  it('BUG: resets priority to medium regardless of the original value', () => {
    const created = taskService.create({ title: 'Finish', priority: 'high' });

    const completed = taskService.completeTask(created.id);

    // Expected: priority should remain 'high'. Actual: forced to 'medium'.
    expect(completed.priority).toBe('medium');
  });
});

describe('assignTask', () => {
  it('sets the assignee on an existing task', () => {
    const created = taskService.create({ title: 'Assign me' });

    const assigned = taskService.assignTask(created.id, 'Aarushi');

    expect(assigned.assignee).toBe('Aarushi');
    expect(assigned.id).toBe(created.id);
  });

  it('returns null for a non-existent id', () => {
    expect(taskService.assignTask('nope', 'Aarushi')).toBeNull();
  });

  it('overwrites an existing assignee when reassigned', () => {
    const created = taskService.create({ title: 'Assign me' });
    taskService.assignTask(created.id, 'Aarushi');

    const reassigned = taskService.assignTask(created.id, 'Rohit');

    expect(reassigned.assignee).toBe('Rohit');
  });
});
