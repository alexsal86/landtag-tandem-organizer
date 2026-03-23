import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({
  insert: insertMock,
}));
const debugErrorMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('@/utils/debugConsole', () => ({
  debugConsole: {
    error: debugErrorMock,
  },
}));

import {
  buildLetterRevisionTaskPayload,
  buildLetterSendTaskPayload,
  createLetterRevisionTask,
  createLetterSendTask,
} from '@/utils/letterWorkflowActions';

const DB_ALLOWED_STATUSES = new Set(['todo', 'in-progress', 'completed']);
const DB_ALLOWED_PRIORITIES = new Set(['low', 'medium', 'high']);
const ALLOWED_FRONTEND_OR_TENANT_CATEGORIES = new Set(['personal', 'meeting', 'call_follow_up', 'call_followup']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function expectTaskPayloadToMatchDbConstraints(payload: {
  title?: string;
  status?: string;
  priority?: string;
  category?: string;
  user_id?: string;
  tenant_id?: string;
  assigned_to?: string | null;
}) {
  expect(payload.title?.trim()).toBeTruthy();
  expect(DB_ALLOWED_STATUSES.has(payload.status ?? '')).toBe(true);
  expect(DB_ALLOWED_PRIORITIES.has(payload.priority ?? '')).toBe(true);
  expect(ALLOWED_FRONTEND_OR_TENANT_CATEGORIES.has(payload.category ?? '')).toBe(true);
  expect(payload.user_id).toMatch(UUID_RE);
  expect(payload.tenant_id).toMatch(UUID_RE);

  if (payload.assigned_to == null) {
    return;
  }

  const assigneeIds = payload.assigned_to.replace(/[{}]/g, '').split(',').filter(Boolean);
  expect(assigneeIds.length).toBeGreaterThan(0);
  assigneeIds.forEach((assigneeId) => {
    expect(assigneeId).toMatch(UUID_RE);
  });
}

describe('letterWorkflowActions task payloads', () => {
  const creatorUserId = '11111111-1111-4111-8111-111111111111';
  const reviewerUserId = '22222222-2222-4222-8222-222222222222';
  const tenantId = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockResolvedValue({ data: null, error: null });
  });

  it('builds a send-task payload with the current task status and an allowed category', () => {
    const payload = buildLetterSendTaskPayload(
      'Haushaltsbrief',
      reviewerUserId,
      creatorUserId,
      tenantId,
    );

    expect(payload.status).toBe('todo');
    expect(payload.category).toBe('personal');
    expect(payload.assigned_to).toBe(reviewerUserId);
    expectTaskPayloadToMatchDbConstraints(payload);
  });

  it('builds a revision-task payload with serialized multi-assignees that still matches task constraints', () => {
    const payload = buildLetterRevisionTaskPayload(
      'Haushaltsbrief',
      'Bitte Einleitung präzisieren.',
      creatorUserId,
      reviewerUserId,
      tenantId,
    );

    expect(payload.status).toBe('todo');
    expect(payload.category).toBe('personal');
    expect(payload.assigned_to).toBe(`{${creatorUserId},${reviewerUserId}}`);
    expectTaskPayloadToMatchDbConstraints(payload);
  });

  it('persists send and revision tasks with schema-compliant payloads', async () => {
    await createLetterSendTask('Haushaltsbrief', reviewerUserId, creatorUserId, tenantId);
    await createLetterRevisionTask('Haushaltsbrief', '', creatorUserId, reviewerUserId, tenantId);

    expect(fromMock).toHaveBeenCalledWith('tasks');
    expect(insertMock).toHaveBeenCalledTimes(2);

    const firstInsertPayload = insertMock.mock.calls[0][0][0];
    const secondInsertPayload = insertMock.mock.calls[1][0][0];

    expectTaskPayloadToMatchDbConstraints(firstInsertPayload);
    expectTaskPayloadToMatchDbConstraints(secondInsertPayload);
    expect(debugErrorMock).not.toHaveBeenCalled();
  });
});
