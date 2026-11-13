import { annualDueDay } from '@/features/timetracking/annualTaskRules';
/** Seasonal office work: suggestions, never an asserted parliamentary deadline. */
export interface OfficeRoutineTemplate {
  id: string; name: string; description: string;
  month: string; day: string; deadlineMonth: string; deadlineDay: string;
  confirmAnnually: boolean; steps: string;
}
export const OFFICE_ROUTINE_TEMPLATES: OfficeRoutineTemplate[] = [
  { id:'team-walk-talk',name:'Walk & Talk mit Eis-Check',description:'Freiwilliger gemeinsamer Spaziergang. Route, Wetter und Eisdiele prüfen; kurze oder telefonische Teilnahme ermöglichen. Alle Termine und Schritte sind anpassbare Vorschläge.',month:'5',day:'1',deadlineMonth:'5',deadlineDay:'15',confirmAnnually:false,
    steps:'14 | Freiwilliges Interesse und passenden Termin für Walk & Talk erfragen\n7 | Kurze barrierearme Route, Wetter und Öffnungszeiten einer Eisdiele prüfen\n2 | Treffpunkt und optionale telefonische Teilnahme teilen\n0 | Freiwilligen Walk & Talk durchführen und bei schlechtem Wetter eine Alternative anbieten' },
  { id:'team-regional-snack',name:'Heimat-Snack im Büro',description:'Freiwilliger Austausch über regionale Snacks, auch aus dem Homeoffice. Keine Mitbringpflicht, keine Bewertung und keine Rangliste.',month:'9',day:'1',deadlineMonth:'9',deadlineDay:'15',confirmAnnually:false,
    steps:'14 | Freiwilligen Heimat-Snack-Termin vorschlagen\n7 | Optionale Beiträge und Ernährungswünsche ohne Mitbringpflicht sammeln\n2 | Kurze digitale Teilnahme und freiwillige Snack-Geschichten ermöglichen\n0 | Regionalen Snack-Austausch ohne Bewertung oder Rangliste durchführen' },
  { id:'team-constituency-trip',name:'Mini-Ausflug im Wahlkreis',description:'Kleiner freiwilliger Team-Ausflug im Wahlkreis mit gut erreichbarem Ziel. Zeit, Kosten und Zugänglichkeit vorher abstimmen; keine Teilnahme voraussetzen.',month:'6',day:'1',deadlineMonth:'6',deadlineDay:'30',confirmAnnually:false,
    steps:'21 | Freiwilliges Interesse, Zeitrahmen und Kostenrahmen für einen Mini-Ausflug erfragen\n14 | Gut erreichbares Ziel und barrierearme Anreise im Wahlkreis auswählen\n7 | Termin, Wetteralternative und freiwillige Zusagen abstimmen\n0 | Kleinen Wahlkreis-Ausflug durchführen und freiwillige Eindrücke teilen' },
  { id:'annual-budget', name:'Haushaltsberatungen vorbereiten', description:'Bedarfe aus dem Wahlkreis sammeln, Prioritäten setzen und mit der Fraktion abstimmen. Start und Abschluss sind Vorschläge: den tatsächlichen Haushaltsfahrplan jährlich bestätigen.', month:'9',day:'1',deadlineMonth:'10',deadlineDay:'15',confirmAnnually:true,
    steps:'42 | Bedarfe und Förderanliegen aus dem Wahlkreis sammeln\n28 | Politische Prioritäten und Finanzierungsvorschläge abstimmen\n21 | Vorschläge mit der Fraktion und Facharbeitskreisen besprechen\n7 | Änderungsanträge und Argumentationsunterlagen vorbereiten\n0 | Unterlagen für die Haushaltsberatungen freigeben' },
  { id:'annual-greetings',name:'Weihnachtskarten vorbereiten',description:'Empfänger, Gestaltung, Druck und persönlichen Versand rechtzeitig organisieren.',month:'9',day:'15',deadlineMonth:'12',deadlineDay:'10',confirmAnnually:false,
    steps:'70 | Empfängerliste und Anschriften bereinigen\n56 | Persönliche Empfänger ergänzen und Gestaltung abstimmen\n42 | Gestaltung freigeben und Druck bestellen\n21 | Persönliche Texte und Unterschriften vorbereiten\n7 | Karten unterschreiben und Versand vorbereiten\n0 | Weihnachtskarten versenden' },
  { id:'annual-summer-tour',name:'Sommertour vorbereiten',description:'Schwerpunkt, Besuchsorte und Gesprächspartner auswählen; Tourprogramm vor dem Sommer fertigstellen.',month:'2',day:'1',deadlineMonth:'5',deadlineDay:'31',confirmAnnually:false,
    steps:'120 | Politischen Schwerpunkt und Ziel der Sommertour festlegen\n90 | Besuchsorte und Gesprächspartner auswählen\n60 | Termine anfragen und Route abstimmen\n30 | Kommunikation und organisatorische Details planen\n7 | Briefings und offene Zusagen zusammenstellen\n0 | Tourprogramm und Zuständigkeiten abschließen' },
  { id:'annual-office-planning',name:'Jahresplanung fürs Folgejahr',description:'Politische Schwerpunkte, Veranstaltungen, Budget und verfügbare Kapazitäten für das Folgejahr abstimmen.',month:'10',day:'1',deadlineMonth:'11',deadlineDay:'30',confirmAnnually:false,
    steps:'45 | Politische Schwerpunkte und Ziele fürs Folgejahr sammeln\n30 | Budget, Personal- und Vertretungskapazitäten abgleichen\n14 | Veranstaltungen, Besuchsprogramme und Jahreskalender abstimmen\n0 | Jahresplanung im Büro beschließen und dokumentieren' },
  { id:'annual-mandate-report',name:'Jahres- und Mandatsbericht vorbereiten',description:'Ergebnisse, Bilder und Beispiele des laufenden Jahres sammeln; Bericht bis Ende Januar des Folgejahres veröffentlichen.',month:'11',day:'1',deadlineMonth:'1',deadlineDay:'31',confirmAnnually:false,
    steps:'60 | Politische Ergebnisse und Beispiele zusammentragen\n45 | Bilder, Zahlen und Freigaben sammeln\n30 | Berichtsentwurf und Gestaltung erstellen\n14 | Bericht fachlich und politisch freigeben\n0 | Jahresbericht veröffentlichen und Verteiler bedienen' },
];
export interface OfficeRoutineFields {
  officeTemplateId?: string; routineDeadlineMonth?: string; routineDeadlineDay?: string;
  routineStepSettings?: string; routineStepKinds?: string; routineSteps?: string; routineRequiresConfirmation?: boolean; routineConfirmedYear?: string;
}
export function parseRoutineSteps(value: string) {
  const lines=value.split('\n').map(line=>line.trim()).filter(Boolean);
  if(lines.length>20) throw new Error('Maximal 20 Arbeitsschritte sind möglich.');
  return lines.map(line=>{
    const match=line.match(/^(\d{1,3})\s*\|\s*(.+)$/);
    if(!match || Number(match[1])>365 || match[2].length>500) throw new Error('Arbeitsschritte als „Tage vorher | Aufgabe“ eingeben (0–365 Tage, maximal 500 Zeichen).');
    return {days_before:Number(match[1]),title:match[2].trim()};
  }).sort((a,b)=>b.days_before-a.days_before);
}
export function validateOfficeRoutine(fields: OfficeRoutineFields): string | null {
  if(!fields.routineDeadlineMonth && !fields.routineDeadlineDay && !fields.routineSteps?.trim() && !fields.routineRequiresConfirmation) return null;
  const m=Number(fields.routineDeadlineMonth),d=Number(fields.routineDeadlineDay);
  if(!Number.isInteger(m)||m<1||m>12||!Number.isInteger(d)||d<1||d>31) return 'Abschlussmonat und -tag vollständig angeben.';
  try { const steps = parseRoutineSteps(fields.routineSteps??''); routineStepKinds(fields.routineStepKinds, steps.length); } catch(error) { return (error as Error).message; }
  return null;
}
export { routineConfirmationMissing } from '../../../supabase/functions/_shared/officeRoutinePlan';

export function officeRoutineDeadline(payload:Record<string,string>|undefined,start:string):string {
  if(!payload?.routine_deadline_month && !payload?.routine_deadline_day) return start;
  const fields={due_month:Number(payload.routine_deadline_month),due_day:Number(payload.routine_deadline_day)};
  const year=Number(start.slice(0,4));
  let finish=annualDueDay(fields,year);
  if(finish<start) finish=annualDueDay(fields,year+1);
  return finish;
}

export const ROUTINE_STEP_KINDS = [
  { value: "subtask", label: "Teilaufgabe im Paket" },
  { value: "task", label: "Eigenständige Aufgabe" },
  { value: "case", label: "Vorgang" },
  { value: "decision", label: "Entscheidung" },
  { value: "jour_fixe", label: "Für Jour fixe vormerken" },
] as const;
export function routineStepKinds(value: string | undefined, count: number): string[] {
  if (!value) return Array(count).fill("subtask");
  const kinds: unknown = JSON.parse(value);
  if (!Array.isArray(kinds) || kinds.length !== count || kinds.some(kind => !ROUTINE_STEP_KINDS.some(option => option.value === kind))) {
    throw new Error("Für jeden Arbeitsschritt einen gültigen Aktionstyp auswählen.");
  }
  return kinds;
}
