import { describe, it, expect } from 'vitest';
import { calculateVacationBalance } from '@/utils/vacationCalculations';

describe('calculateVacationBalance', () => {
  it('berechnet vollen Anspruch ohne Eintrittsdatum', () => {
    const r = calculateVacationBalance({
      annualVacationDays: 30,
      carryOverDays: 0,
      employmentStartDate: null,
      approvedVacationLeaves: [],
      currentYear: 2026,
    });
    expect(r.prorated).toBe(30);
    expect(r.totalEntitlement).toBe(30);
    expect(r.taken).toBe(0);
    expect(r.remaining).toBe(30);
  });

  it('rechnet anteilig bei Eintritt im laufenden Jahr', () => {
    const r = calculateVacationBalance({
      annualVacationDays: 24,
      carryOverDays: 0,
      employmentStartDate: '2026-07-01',
      approvedVacationLeaves: [],
      currentYear: 2026,
    });
    // ab Juli (Monat 6) -> 6 Monate -> 24 * 6 / 12 = 12
    expect(r.prorated).toBe(12);
  });

  it('liefert 0 prorata bei Eintritt in Zukunft', () => {
    const r = calculateVacationBalance({
      annualVacationDays: 30,
      carryOverDays: 0,
      employmentStartDate: '2099-01-01',
      approvedVacationLeaves: [],
      currentYear: 2026,
    });
    expect(r.prorated).toBe(0);
  });

  it('verbraucht Resturlaub zuerst', () => {
    const r = calculateVacationBalance({
      annualVacationDays: 30,
      carryOverDays: 5,
      employmentStartDate: null,
      approvedVacationLeaves: [
        // Mo-Fr 2026-01-05 bis 2026-01-09 = 5 Werktage
        { start_date: '2026-01-05', end_date: '2026-01-09' },
      ],
      currentYear: 2026,
      carryOverExpiresAt: '2099-12-31',
    });
    expect(r.taken).toBe(5);
    expect(r.carryOverUsed).toBe(5);
    expect(r.newVacationUsed).toBe(0);
    expect(r.newVacationRemaining).toBe(30);
  });

  it('markiert Resturlaub als verfallen nach Ablaufdatum', () => {
    const r = calculateVacationBalance({
      annualVacationDays: 30,
      carryOverDays: 5,
      employmentStartDate: null,
      approvedVacationLeaves: [],
      currentYear: 2026,
      carryOverExpiresAt: '2000-03-31',
    });
    expect(r.carryOverExpired).toBe(true);
    expect(r.carryOver).toBe(0);
  });

  it('zählt nur Werktage', () => {
    const r = calculateVacationBalance({
      annualVacationDays: 30,
      carryOverDays: 0,
      employmentStartDate: null,
      // 2026-01-03 (Sa) bis 2026-01-04 (So) -> 0 Werktage
      approvedVacationLeaves: [{ start_date: '2026-01-03', end_date: '2026-01-04' }],
      currentYear: 2026,
    });
    expect(r.taken).toBe(0);
  });
});
