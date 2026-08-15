const { validateCreateTask, validateUpdateTask, validateAssignTask } = require('../../src/utils/validators');

describe('validateCreateTask', () => {
  it('returns null for a valid payload', () => {
    expect(validateCreateTask({ title: 'Valid', status: 'todo', priority: 'high' })).toBeNull();
  });

  it('rejects a missing title', () => {
    expect(validateCreateTask({})).toMatch(/title/i);
  });

  it('rejects a whitespace-only title', () => {
    expect(validateCreateTask({ title: '   ' })).toMatch(/title/i);
  });

  it('rejects an invalid status', () => {
    expect(validateCreateTask({ title: 'X', status: 'bogus' })).toMatch(/status/i);
  });

  it('rejects an invalid priority', () => {
    expect(validateCreateTask({ title: 'X', priority: 'urgent' })).toMatch(/priority/i);
  });

  it('rejects an invalid dueDate', () => {
    expect(validateCreateTask({ title: 'X', dueDate: 'not-a-date' })).toMatch(/dueDate/i);
  });

  it('accepts a missing dueDate', () => {
    expect(validateCreateTask({ title: 'X' })).toBeNull();
  });
});

describe('validateUpdateTask', () => {
  it('returns null for an empty payload (partial updates allowed)', () => {
    expect(validateUpdateTask({})).toBeNull();
  });

  it('rejects a whitespace-only title', () => {
    expect(validateUpdateTask({ title: '  ' })).toMatch(/title/i);
  });

  it('rejects an invalid status', () => {
    expect(validateUpdateTask({ status: 'bogus' })).toMatch(/status/i);
  });

  it('rejects an invalid priority', () => {
    expect(validateUpdateTask({ priority: 'urgent' })).toMatch(/priority/i);
  });

  it('rejects an invalid dueDate', () => {
    expect(validateUpdateTask({ dueDate: 'not-a-date' })).toMatch(/dueDate/i);
  });
});

describe('validateAssignTask', () => {
  it('returns null for a valid assignee', () => {
    expect(validateAssignTask({ assignee: 'Aarushi' })).toBeNull();
  });

  it('rejects a missing assignee', () => {
    expect(validateAssignTask({})).toMatch(/assignee/i);
  });

  it('rejects an empty-string assignee', () => {
    expect(validateAssignTask({ assignee: '' })).toMatch(/assignee/i);
  });

  it('rejects a whitespace-only assignee', () => {
    expect(validateAssignTask({ assignee: '   ' })).toMatch(/assignee/i);
  });

  it('rejects a non-string assignee', () => {
    expect(validateAssignTask({ assignee: 42 })).toMatch(/assignee/i);
  });
});
