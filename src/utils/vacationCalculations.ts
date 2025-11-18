import { parseISO, eachDayOfInterval } from "date-fns";

interface VacationCalculationParams {
  annualVacationDays: number;
  carryOverDays: number;
  employmentStartDate: string | null;
  approvedVacationLeaves: Array<{ start_date: string; end_date: string }>;
  currentYear?: number;
}

export function calculateVacationBalance(params: VacationCalculationParams) {
  const {
    annualVacationDays,
    carryOverDays,
    employmentStartDate,
    approvedVacationLeaves,
    currentYear = new Date().getFullYear(),
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

  // Genommene Urlaubstage (nur Werktage)
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

  const totalEntitlement = proratedDays + carryOverDays;
  const remaining = totalEntitlement - vacationDaysTaken;

  return {
    annual: annualVacationDays,
    prorated: proratedDays,
    carryOver: carryOverDays,
    totalEntitlement,
    taken: vacationDaysTaken,
    remaining,
  };
}
