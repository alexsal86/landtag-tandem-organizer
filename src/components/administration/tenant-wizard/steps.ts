// Übergabeschritte eines neu angelegten Büros. Ein Modell für den
// Provisioning-Wizard (direkt nach dem Anlegen) und für die Mandantenzeile,
// damit beide dieselben Punkte bewerten und benennen.

export type TenantStepKey = "admin" | "sender" | "logo" | "members" | "calendar";

export interface TenantStepState {
  /** Noch offen = der Super-Admin sollte diese Übergabe nachziehen. */
  open: boolean;
  /** Optionaler Zusatz, z. B. Anzahl der Benutzer. */
  detail?: string;
}

export interface TenantSetupInput {
  /** Aktive Benutzer im Büro; reicht als Nachweis für den angelegten Admin. */
  users: number;
  senderCount: number;
  /** undefined = im Kontext nicht bekannt (dann nicht als offen gewertet). */
  hasLogo?: boolean;
  /** undefined = keine Kalenderkennzahl verfügbar. */
  calendars?: number;
}

export const TENANT_STEPS: Array<{ key: TenantStepKey; label: string; hint: string }> = [
  {
    key: "admin",
    label: "Abgeordneter angelegt",
    hint: "Ohne aktiven Zugang kann sich niemand im Büro anmelden.",
  },
  {
    key: "sender",
    label: "Absender hinterlegt",
    hint: "Briefe laufen erst mit einer Absenderadresse.",
  },
  {
    key: "logo",
    label: "Logo / App-Name gesetzt",
    hint: "Erscheint in Navigation, Login und auf Briefen.",
  },
  {
    key: "members",
    label: "Team ergänzt",
    hint: "Mitarbeiter und Büroleitung nach und nach zuordnen.",
  },
  {
    key: "calendar",
    label: "Kalender verbunden",
    hint: "Termine und Jour fixe kommen erst dann automatisch.",
  },
];

/** Baut aus den Kennzahlen von get_admin_tenant_health die Übergabe-Checkliste. */
export function buildTenantSteps(input: TenantSetupInput): Record<TenantStepKey, TenantStepState> {
  return {
    admin: {
      open: input.users < 1,
      detail: input.users > 0 ? undefined : "Noch kein aktiver Benutzer im Büro.",
    },
    sender: {
      open: input.senderCount < 1,
      detail: input.senderCount > 0 ? `${input.senderCount} Absender` : undefined,
    },
    logo: {
      open: input.hasLogo === false,
      detail: input.hasLogo === undefined ? "nicht geprüft" : undefined,
    },
    members: {
      open: input.users < 2,
      detail: `${input.users} aktive Benutzer`,
    },
    calendar: {
      open: input.calendars === 0,
      detail: input.calendars === undefined ? "keine Kalenderkennzahl" : undefined,
    },
  };
}

export function openTenantSteps(steps: Record<TenantStepKey, TenantStepState>): TenantStepKey[] {
  return TENANT_STEPS.filter((step) => steps[step.key].open).map((step) => step.key);
}
