export function routineConfirmationMissing(payload:Record<string,string>|undefined,year:number):boolean {
  return payload?.routine_requires_confirmation==='true' && payload.routine_confirmed_year!==String(year);
}
export function unconfirmedOfficeRoutine(actions:Array<{type:string;payload?:Record<string,string>}>,now=new Date()):boolean {
  const year=Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Berlin',year:'numeric'}).format(now));
  return actions.some(action=>action.type==='run_annual_routine'&&routineConfirmationMissing(action.payload,year));
}
