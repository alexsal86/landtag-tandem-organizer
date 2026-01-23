import { parseISO, eachDayOfInterval } from "date-fns";

interface VacationCalculationParams {
  annualVacationDays: number;
  carryOverDays: number;
  employmentStartDate: string | null;
  approvedVacationLeaves: Array<{ start_date: string; end_date: string }>;
  currentYear?: number;
  carryOverExpiresAt?: string | null;
}

export interface VacationBalanceResult {
  annual: number;
  prorated: number;
  carryOver: number;
  carryOverUsed: number;
  carryOverRemaining: number;
  carryOverExpiresAt: string | null;
  carryOverExpired: boolean;
  totalEntitlement: number;
  taken: number;
  remaining: number;
  newVacationUsed: number;
  newVacationRemaining: number;
}

export function calculateVacationBalance(params: VacationCalculationParams): VacationBalanceResult {
  const {
    annualVacationDays,
    carryOverDays,
    employmentStartDate,
    approvedVacationLeaves,
    currentYear = new Date().getFullYear(),
    carryOverExpiresAt = null,
  } = params;

  // Anteilige Berechnung bei Eintritt im laufenden Jahr
  let proratedDays = annualVacationDays;
  if (employmentStartDate) {
    const start = parseISO(employmentStartDate);
    if (start.getFullYear() === currentYear) {
      const startMonth = start.getMonth(); // 0-based
      const monthsEligible = 12 - startMonth;
      proratedDays = Math.round((annualVacationDays * monthsEligible) / 12);
    } else if (start.getFullYear() > currentYear) {
      proratedDays = 0;
    }
  }

  // Prüfen ob Resturlaub verfallen ist (nach 31.03)
  let effectiveCarryOver = carryOverDays;
  let carryOverExpired = false;
  
  if (carryOverExpiresAt) {
    const expiryDate = parseISO(carryOverExpiresAt);
    const today = new Date();
    if (today > expiryDate) {
      // Resturlaub ist verfallen
      effectiveCarryOver = 0;
      carryOverExpired = true;
    }
  } else if (carryOverDays > 0) {
    // Fallback: Prüfe ob wir nach dem 31.03 des aktuellen Jahres sind
    const defaultExpiry = new Date(currentYear, 2, 31); // 31. März
    const today = new Date();
    if (today > defaultExpiry) {
      effectiveCarryOver = 0;
      carryOverExpired = true;
    }
  }

  // Genommene Urlaubstage (nur Werktage im aktuellen Jahr)
  const vacationDaysTaken = approvedVacationLeaves.reduce((acc, leave) => {
    const start = parseISO(leave.start_date);
    const end = parseISO(leave.end_date);
    
    const days = eachDayOfInterval({ start, end })
      .filter(d => d.getFullYear() === currentYear)
      .filter(d => {
        const dow = d.getDay();
        return dow !== 0 && dow !== 6; // weekdays only
      }).length;
    
    return acc + days;
  }, 0);

  // WICHTIG: Resturlaub wird ZUERST verbraucht
  const carryOverUsed = Math.min(effectiveCarryOver, vacationDaysTaken);
  const carryOverRemaining = Math.max(0, effectiveCarryOver - carryOverUsed);
  
  // Neuer Urlaub wird erst nach Resturlaub verwendet
  const newVacationUsed = Math.max(0, vacationDaysTaken - effectiveCarryOver);
  const newVacationRemaining = proratedDays - newVacationUsed;

  const totalEntitlement = proratedDays + effectiveCarryOver;
  const remaining = totalEntitlement - vacationDaysTaken;

  return {
    annual: annualVacationDays,
    prorated: proratedDays,
    carryOver: effectiveCarryOver,
    carryOverUsed,
    carryOverRemaining,
    carryOverExpiresAt: carryOverExpired ? null : carryOverExpiresAt,
    carryOverExpired,
    totalEntitlement,
    taken: vacationDaysTaken,
    remaining,
    newVacationUsed,
    newVacationRemaining,
  };
}
