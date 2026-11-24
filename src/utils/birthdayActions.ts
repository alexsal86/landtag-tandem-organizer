import { CreditCard, Mail, Phone, Gift } from 'lucide-react';

/** Shared by the Jour-fixe planning and dashboard congratulations menu. */
export const BIRTHDAY_ACTION_OPTIONS = [
  { key: 'card', label: 'Karte', icon: CreditCard, color: 'text-palette-purple' },
  { key: 'mail', label: 'Mail', icon: Mail, color: 'text-palette-blue' },
  { key: 'call', label: 'Anruf', icon: Phone, color: 'text-palette-green' },
  { key: 'gift', label: 'Geschenk', icon: Gift, color: 'text-palette-amber' },
] as const;
export type BirthdayActionKey = typeof BIRTHDAY_ACTION_OPTIONS[number]['key'];
export function birthdayActionLabel(key: string): string | undefined {
  return BIRTHDAY_ACTION_OPTIONS.find(option => option.key === key)?.label;
}
