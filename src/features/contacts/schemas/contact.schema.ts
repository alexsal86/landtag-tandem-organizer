import { z } from 'zod';

/**
 * Zod-Schema für die Kontakt-Erstellung.
 * Zentralisiert die Validierungslogik, die bisher verteilt in CreateContact.tsx
 * und als separate validateEmail/checkForDuplicates-Aufrufe vorhanden war.
 */
export const createContactSchema = z.object({
  contact_type: z.enum(['person', 'organization']),
  gender: z.string().optional(),
  name: z.string().min(1, 'Name ist erforderlich'),
  role: z.string().optional(),
  organization_id: z.string().optional(),
  email: z
    .string()
    .email('Bitte geben Sie eine gültige E-Mail-Adresse ein (z.B. name@beispiel.de)')
    .optional()
    .or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url('Bitte eine gültige URL eingeben').optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  industry: z.string().optional(),
  main_contact_person: z.string().optional(),
  category: z.string().min(1, 'Kategorie ist erforderlich'),
  priority: z.string().min(1, 'Priorität ist erforderlich'),
  added_reason: z.string().optional(),
  added_at: z.string().optional(),
}).refine(
  (data) => !!(data.email || data.phone),
  {
    message: 'Bitte hinterlegen Sie mindestens E-Mail oder Telefonnummer.',
    path: ['email'],
  }
);

export type CreateContactFormValues = z.infer<typeof createContactSchema>;
