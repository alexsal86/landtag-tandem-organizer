import { describe, expect, it } from 'vitest';
import { buildDeepLinkPath } from '@/utils/notificationDeepLinks';
import {
  isLetterNotificationType,
  LETTER_NOTIFICATION_REGISTRY,
  LETTER_NOTIFICATION_TYPES,
  LETTER_NOTIFICATION_TYPE_VALUES,
} from '@/utils/letterNotificationTypes';
import type { Notification } from '@/hooks/useNotifications';

describe('letter notification registry', () => {
  it('contains the canonical letter workflow notification types with consistent metadata', () => {
    expect(LETTER_NOTIFICATION_TYPE_VALUES).toEqual([
      LETTER_NOTIFICATION_TYPES.REVIEW_REQUESTED,
      LETTER_NOTIFICATION_TYPES.REVIEW_COMPLETED,
      LETTER_NOTIFICATION_TYPES.SENT,
    ]);

    for (const type of LETTER_NOTIFICATION_TYPE_VALUES) {
      expect(isLetterNotificationType(type)).toBe(true);
      expect(LETTER_NOTIFICATION_REGISTRY[type].category).toBe('documents');
      expect(LETTER_NOTIFICATION_REGISTRY[type].navigationContext).toBe('documents');
      expect(LETTER_NOTIFICATION_REGISTRY[type].label.length).toBeGreaterThan(0);
      expect(LETTER_NOTIFICATION_REGISTRY[type].description.length).toBeGreaterThan(0);
    }
  });

  it('builds the same deep link for every canonical letter notification type', () => {
    for (const type of LETTER_NOTIFICATION_TYPE_VALUES) {
      const notification: Notification = {
        id: `notification-${type}`,
        title: 'Brief-Info',
        message: 'Nachricht',
        is_read: false,
        priority: 'medium',
        created_at: '2026-03-23T00:00:00.000Z',
        notification_types: { name: type, label: LETTER_NOTIFICATION_REGISTRY[type].label },
        data: {
          letter_id: 'letter-123',
        },
      };

      expect(buildDeepLinkPath(notification)).toBe('/letters/letter-123');
    }
  });
});
