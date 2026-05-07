import { describe, it, expect } from 'vitest';
import { buildDeepLinkPath } from '@/utils/notificationDeepLinks';
import type { Notification } from '@/hooks/useNotifications';

const makeNotification = (overrides: Partial<Notification>): Notification =>
  ({
    id: 'n1',
    title: 't',
    message: 'm',
    is_read: false,
    priority: 'medium',
    created_at: '2026-01-01T00:00:00Z',
    data: {},
    notification_types: { name: 'task_created', label: 'Task' },
    ...overrides,
  }) as Notification;

describe('buildDeepLinkPath', () => {
  it('verlinkt Briefe per ID', () => {
    const path = buildDeepLinkPath(
      makeNotification({
        notification_types: { name: 'letter_created', label: 'Brief' },
        data: { letter_id: 'abc' },
      }),
    );
    expect(path).toBe('/letters/abc');
  });

  it('fällt für Briefe ohne ID auf Dokumente zurück', () => {
    const path = buildDeepLinkPath(
      makeNotification({
        notification_types: { name: 'letter_created', label: 'Brief' },
        data: {},
      }),
    );
    expect(path).toBe('/documents?tab=letters');
  });

  it('fügt highlight-Parameter für Tasks an', () => {
    const path = buildDeepLinkPath(
      makeNotification({ data: { task_id: 'task-9' } }),
    );
    expect(path).toBe('/tasks?highlight=task-9');
  });

  it('verlinkt Decisions', () => {
    const path = buildDeepLinkPath(
      makeNotification({
        notification_types: { name: 'decision_request', label: 'Entscheidung' },
        data: { decision_id: 'dec-1' },
      }),
    );
    expect(path).toBe('/decisions?highlight=dec-1');
  });

  it('navigiert Termin-Reminder zu Datum', () => {
    const path = buildDeepLinkPath(
      makeNotification({
        notification_types: { name: 'appointment_reminder', label: 'Termin' },
        data: { start_time: '2026-05-10T09:00:00Z' },
      }),
    );
    expect(path).toBe('/calendar?date=2026-05-10');
  });

  it('liefert Default / wenn nichts passt', () => {
    const path = buildDeepLinkPath(
      makeNotification({
        notification_types: { name: 'unknown', label: 'x' },
        data: {},
      }),
    );
    expect(path).toBe('/');
  });

  it('routet appointment_feedback mit task target', () => {
    const path = buildDeepLinkPath(
      makeNotification({
        notification_types: { name: 'appointment_feedback', label: 'Feedback' },
        data: {
          feedback_context: { target: { type: 'task', id: 't1' }, source: { id: 'fb1' } },
        },
      }),
    );
    expect(path).toBe('/tasks?highlight=t1&feedback_id=fb1');
  });
});
