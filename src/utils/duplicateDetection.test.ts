import { describe, expect, it } from 'vitest';

import { findPotentialDuplicates } from './duplicateDetection';

describe('findPotentialDuplicates', () => {
  it('meldet keine Duplikate nur wegen ähnlichem Namen bei gemeinsamer Organisation', () => {
    const duplicates = findPotentialDuplicates(
      {
        id: 'new',
        name: 'Max Mustermann',
        organization: 'Muster GmbH',
      },
      [
        {
          id: '1',
          name: 'Max Musterfrau',
          organization: 'Muster GmbH',
        },
      ],
    );

    expect(duplicates).toHaveLength(0);
  });

  it('meldet Duplikat bei identischer E-Mail weiterhin zuverlässig', () => {
    const duplicates = findPotentialDuplicates(
      {
        id: 'new',
        name: 'Anna Beispiel',
        email: 'anna@example.org',
      },
      [
        {
          id: '1',
          name: 'A. Beispiel',
          email: 'anna@example.org',
        },
      ],
    );

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].reasons).toContain('Identische E-Mail-Adresse');
  });
});
