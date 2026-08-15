const request = require('supertest');
const app = require('../../src/app');
const taskService = require('../../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

describe('error handling', () => {
  it('returns 500 via the generic error handler when the request body is malformed JSON', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Content-Type', 'application/json')
      .send('{ this is not valid json');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});

describe('GET /tasks', () => {
  it('returns an empty list when there are no tasks', async () => {
    const res = await request(app).get('/tasks');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all created tasks', async () => {
    taskService.create({ title: 'A' });
    taskService.create({ title: 'B' });

    const res = await request(app).get('/tasks');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filters by status when ?status= is provided', async () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'done' });

    const res = await request(app).get('/tasks?status=done');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('B');
  });

  it('paginates results with ?page= and ?limit=', async () => {
    for (let i = 0; i < 5; i++) {
      taskService.create({ title: `Task ${i}` });
    }

    const res = await request(app).get('/tasks?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('Task 0');
    expect(res.body[1].title).toBe('Task 1');
  });

  it('falls back to page=1 and limit=10 when the query values are not numeric', async () => {
    for (let i = 0; i < 3; i++) {
      taskService.create({ title: `Task ${i}` });
    }

    const res = await request(app).get('/tasks?page=abc&limit=xyz');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].title).toBe('Task 0');
  });
});

describe('GET /tasks/stats', () => {
  it('returns zeroed counts for an empty store', async () => {
    const res = await request(app).get('/tasks/stats');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it('returns correct counts and overdue total for mixed data', async () => {
    taskService.create({ title: 'A', status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
    taskService.create({ title: 'B', status: 'done' });

    const res = await request(app).get('/tasks/stats');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ todo: 1, done: 1, overdue: 1 });
  });
});

describe('POST /tasks', () => {
  it('creates a task and returns 201 with the full task shape', async () => {
    const res = await request(app).post('/tasks').send({ title: 'New task', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'New task', priority: 'high', status: 'todo' });
    expect(res.body.id).toEqual(expect.any(String));
  });

  it('rejects a missing title with 400', async () => {
    const res = await request(app).post('/tasks').send({ description: 'no title' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it('rejects a whitespace-only title with 400', async () => {
    const res = await request(app).post('/tasks').send({ title: '   ' });

    expect(res.status).toBe(400);
  });

  it('rejects an invalid status with 400', async () => {
    const res = await request(app).post('/tasks').send({ title: 'X', status: 'not-a-status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
  });

  it('rejects an invalid dueDate with 400', async () => {
    const res = await request(app).post('/tasks').send({ title: 'X', dueDate: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dueDate/i);
  });
});

describe('PUT /tasks/:id', () => {
  it('updates an existing task and returns it', async () => {
    const created = taskService.create({ title: 'Original' });

    const res = await request(app).put(`/tasks/${created.id}`).send({ title: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
  });

  it('returns 404 for a non-existent task', async () => {
    const res = await request(app).put('/tasks/does-not-exist').send({ title: 'Updated' });

    expect(res.status).toBe(404);
  });

  it('rejects an invalid priority with 400', async () => {
    const created = taskService.create({ title: 'Original' });

    const res = await request(app).put(`/tasks/${created.id}`).send({ priority: 'urgent' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /tasks/:id', () => {
  it('deletes an existing task and returns 204', async () => {
    const created = taskService.create({ title: 'Delete me' });

    const res = await request(app).delete(`/tasks/${created.id}`);

    expect(res.status).toBe(204);
    expect(taskService.findById(created.id)).toBeUndefined();
  });

  it('returns 404 for a non-existent task', async () => {
    const res = await request(app).delete('/tasks/does-not-exist');

    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  it('marks a task complete', async () => {
    const created = taskService.create({ title: 'Finish me' });

    const res = await request(app).patch(`/tasks/${created.id}/complete`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).toEqual(expect.any(String));
  });

  it('returns 404 for a non-existent task', async () => {
    const res = await request(app).patch('/tasks/does-not-exist/complete');

    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/assign', () => {
  it('assigns a task to a name and returns the updated task', async () => {
    const created = taskService.create({ title: 'Assign me' });

    const res = await request(app).patch(`/tasks/${created.id}/assign`).send({ assignee: 'Aarushi' });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Aarushi');
    expect(res.body.id).toBe(created.id);
  });

  it('returns 404 for a non-existent task', async () => {
    const res = await request(app).patch('/tasks/does-not-exist/assign').send({ assignee: 'Aarushi' });

    expect(res.status).toBe(404);
  });

  it('rejects a missing assignee with 400', async () => {
    const created = taskService.create({ title: 'Assign me' });

    const res = await request(app).patch(`/tasks/${created.id}/assign`).send({});

    expect(res.status).toBe(400);
  });

  it('rejects an empty-string assignee with 400', async () => {
    const created = taskService.create({ title: 'Assign me' });

    const res = await request(app).patch(`/tasks/${created.id}/assign`).send({ assignee: '   ' });

    expect(res.status).toBe(400);
  });

  it('rejects a non-string assignee with 400', async () => {
    const created = taskService.create({ title: 'Assign me' });

    const res = await request(app).patch(`/tasks/${created.id}/assign`).send({ assignee: 12345 });

    expect(res.status).toBe(400);
  });

  it('allows reassigning a task that already has an assignee', async () => {
    const created = taskService.create({ title: 'Assign me' });
    await request(app).patch(`/tasks/${created.id}/assign`).send({ assignee: 'Aarushi' });

    const res = await request(app).patch(`/tasks/${created.id}/assign`).send({ assignee: 'Rohit' });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Rohit');
  });

  it('trims surrounding whitespace on the stored assignee', async () => {
    const created = taskService.create({ title: 'Assign me' });

    const res = await request(app).patch(`/tasks/${created.id}/assign`).send({ assignee: '  Aarushi  ' });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Aarushi');
  });
});
