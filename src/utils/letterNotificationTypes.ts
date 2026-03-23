export const LETTER_NOTIFICATION_TYPES = {
  REVIEW_REQUESTED: 'letter_review_requested',
  REVIEW_COMPLETED: 'letter_review_completed',
  SENT: 'letter_sent',
} as const;

export type LetterNotificationType = typeof LETTER_NOTIFICATION_TYPES[keyof typeof LETTER_NOTIFICATION_TYPES];

export const LETTER_NOTIFICATION_TYPE_VALUES: readonly LetterNotificationType[] = Object.values(LETTER_NOTIFICATION_TYPES);

export const LETTER_NOTIFICATION_TYPE_SET = new Set<string>(LETTER_NOTIFICATION_TYPE_VALUES);

export const isLetterNotificationType = (type: string): type is LetterNotificationType => {
  return LETTER_NOTIFICATION_TYPE_SET.has(type);
};

export const LETTER_NOTIFICATION_REGISTRY: Record<LetterNotificationType, {
  label: string;
  description: string;
  category: 'documents';
  navigationContext: 'documents';
}> = {
  [LETTER_NOTIFICATION_TYPES.REVIEW_REQUESTED]: {
    label: 'Brief zur Prüfung',
    description: 'Benachrichtigung wenn ein Brief zur Prüfung oder Freigabe zugewiesen wird',
    category: 'documents',
    navigationContext: 'documents',
  },
  [LETTER_NOTIFICATION_TYPES.REVIEW_COMPLETED]: {
    label: 'Brief geprüft',
    description: 'Benachrichtigung wenn ein Brief freigegeben oder zur Überarbeitung zurückgegeben wird',
    category: 'documents',
    navigationContext: 'documents',
  },
  [LETTER_NOTIFICATION_TYPES.SENT]: {
    label: 'Brief versendet',
    description: 'Benachrichtigung wenn ein Brief als versendet markiert wird',
    category: 'documents',
    navigationContext: 'documents',
  },
};
