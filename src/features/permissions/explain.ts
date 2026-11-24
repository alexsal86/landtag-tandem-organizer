/**
 * Reine Regeln des Rechte-Explorers: Antwort der Datenbank einordnen, Widersprüche
 * zwischen Rolle, Modulschalter und Feldrecht benennen und eine Rollensimulation
 * mit der tatsächlichen Rolle vergleichen. Keine Datenbankzugriffe, keine UI.
 */

export type ActionSource = "platform" | "membership" | "rule" | "default";
export type FeatureSource = "tenant" | "default";
export type FieldSource = "platform" | "membership" | "field_rule" | "default";

export interface ActionDecision {
  key: string;
  allowed: boolean;
  reason: string;
  source: ActionSource;
  role: string | null;
  allowedRoles: string[] | null;
}

export interface FeatureDecision {
  key: string;
  enabled: boolean;
  reason: string;
  source: FeatureSource;
  role: string | null;
}

export interface FieldDecision {
  table: string;
  column: string;
  canRead: boolean;
  canWrite: boolean;
  readMode: "mask" | "record" | null;
  reason: string;
  source: FieldSource;
}

export interface PermissionExplanation {
  member: boolean;
  role: string | null;
  simulatedRole: string | null;
  isSuperadmin: boolean;
  actions: ActionDecision[];
  features: FeatureDecision[];
  fields: FieldDecision[];
}

export interface PermissionQuestion {
  actions: string[];
  features: string[];
  fields: Array<{ table: string; column: string }>;
}

export type ConflictSeverity = "critical" | "warning" | "info";
export type ConflictArea = "Rolle & Modul" | "Feld";

export interface PermissionConflict {
  id: string;
  severity: ConflictSeverity;
  area: ConflictArea;
  title: string;
  detail: string;
}

export interface SimulationChange {
  id: string;
  area: "Modul" | "Aktion" | "Feld";
  actual: string;
  simulated: string;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const text = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);

const bool = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback;

const asActionSource = (value: unknown): ActionSource => {
  const source = text(value);
  return source === "platform" || source === "membership" || source === "rule" ? source : "default";
};

const asFieldSource = (value: unknown): FieldSource => {
  const source = text(value);
  return source === "platform" || source === "membership" || source === "field_rule"
    ? source
    : "default";
};

const asFeatureSource = (value: unknown): FeatureSource =>
  text(value) === "tenant" ? "tenant" : "default";

/**
 * Ordnet die Datenbankantwort strikt dem angefragten Katalog zu. Fehlt eine Antwort,
 * gilt die Entscheidung als verweigert und wird als solche gekennzeichnet – nie
 * stillschweigend als erlaubt.
 */
export function parsePermissionExplanation(
  value: unknown,
  question: PermissionQuestion,
): PermissionExplanation {
  const root = record(value);

  const actionRows = list(root.actions).map(record);
  const featureRows = list(root.features).map(record);
  const fieldRows = list(root.fields).map(record);

  const actions: ActionDecision[] = question.actions.map((key) => {
    const row = actionRows.find((entry) => text(entry.key) === key) ?? {};
    const roles = list(row.allowed_roles).filter((role): role is string => typeof role === "string");
    return {
      key,
      allowed: bool(row.allowed, false),
      reason: text(row.reason, "Keine Auskunft erhalten."),
      source: asActionSource(row.source),
      role: typeof row.role === "string" ? row.role : null,
      allowedRoles: roles.length ? roles : null,
    };
  });

  const features: FeatureDecision[] = question.features.map((key) => {
    const row = featureRows.find((entry) => text(entry.key) === key) ?? {};
    return {
      key,
      enabled: bool(row.enabled, false),
      reason: text(row.reason, "Keine Auskunft erhalten."),
      source: asFeatureSource(row.source),
      role: typeof row.role === "string" ? row.role : null,
    };
  });

  const fields: FieldDecision[] = question.fields.map(({ table, column }) => {
    const row =
      fieldRows.find(
        (entry) => text(entry.table) === table && text(entry.column) === column,
      ) ?? {};
    const mode = text(row.read_mode);
    return {
      table,
      column,
      canRead: bool(row.can_read, false),
      canWrite: bool(row.can_write, false),
      readMode: mode === "mask" || mode === "record" ? mode : null,
      reason: text(row.reason, "Keine Auskunft erhalten."),
      source: asFieldSource(row.source),
    };
  });

  return {
    member: bool(root.member, false),
    role: typeof root.role === "string" ? root.role : null,
    simulatedRole: typeof root.simulated_role === "string" ? root.simulated_role : null,
    isSuperadmin: bool(root.is_superadmin, false),
    actions,
    features,
    fields,
  };
}

/**
 * Widersprüche zwischen den drei Ebenen:
 * - Rollenrecht erlaubt eine Aktion, deren Modul büroweit ausgeschaltet ist.
 * - Modul ist aktiv, aber die zugehörige Aktion bleibt gesperrt.
 * - Feldrecht ist in sich widersprüchlich (Schreiben ohne Lesen) oder sperrt
 *   bewusst den ganzen Datensatz.
 * Standardwerte ohne gespeicherte Regel erscheinen nicht als Konflikt, sondern
 * über die Quellenkennzeichnung in der Oberfläche.
 */
export function buildPermissionDiff(
  explanation: PermissionExplanation,
  actionModules: Record<string, string | undefined>,
): PermissionConflict[] {
  const conflicts: PermissionConflict[] = [];
  const featureByKey = new Map(explanation.features.map((feature) => [feature.key, feature]));

  for (const action of explanation.actions) {
    const moduleKey = actionModules[action.key];
    const feature = moduleKey ? featureByKey.get(moduleKey) : undefined;
    if (!feature) continue;

    if (action.allowed && !feature.enabled) {
      conflicts.push({
        id: `action-open-module-off:${action.key}`,
        severity: "warning",
        area: "Rolle & Modul",
        title: "Aktion erlaubt, Modul ausgeschaltet",
        detail: `Die Rolle darf „${action.key}“ ausführen, das zugehörige Modul „${feature.key}“ ist für dieses Büro aber aus. Die Aktion ist im Arbeitsbereich nicht erreichbar.`,
      });
    } else if (!action.allowed && feature.enabled) {
      conflicts.push({
        id: `module-on-action-closed:${action.key}`,
        severity: "info",
        area: "Rolle & Modul",
        title: "Modul aktiv, Aktion gesperrt",
        detail: `Das Modul „${feature.key}“ ist aktiv, die Rolle darf „${action.key}“ darin aber nicht ausführen.`,
      });
    }
  }

  for (const field of explanation.fields) {
    const id = `${field.table}.${field.column}`;
    if (field.canWrite && !field.canRead) {
      conflicts.push({
        id: `field-write-without-read:${id}`,
        severity: "critical",
        area: "Feld",
        title: "Schreiben ohne Lesen",
        detail: `${id} ist schreibbar, obwohl Lesen gesperrt ist. Das widerspricht der Regel „ein Leseverbot sperrt auch das Schreiben“ und muss in der Feldkonfiguration korrigiert werden.`,
      });
    }
    if (!field.canRead && field.readMode === "record") {
      conflicts.push({
        id: `field-record-locked:${id}`,
        severity: "warning",
        area: "Feld",
        title: "Gesamter Datensatz gesperrt",
        detail: `${id} ist nicht nur ausgeblendet: Für diese Rolle ist der ganze Datensatz gesperrt.`,
      });
    }
  }

  return conflicts;
}

/**
 * Vergleicht die tatsächliche Rolle mit einer simulierten Rolle. Nur Abweichungen
 * werden zurückgegeben; die Simulation selbst schreibt nichts.
 */
export function diffSimulation(
  actual: PermissionExplanation,
  simulated: PermissionExplanation,
): SimulationChange[] {
  const changes: SimulationChange[] = [];
  const yesNo = (value: boolean): string => (value ? "erlaubt" : "gesperrt");

  const actualFeatures = new Map(actual.features.map((feature) => [feature.key, feature]));
  for (const feature of simulated.features) {
    const before = actualFeatures.get(feature.key);
    if (!before || before.enabled === feature.enabled) continue;
    changes.push({
      id: `feature:${feature.key}`,
      area: "Modul",
      actual: before.enabled ? "aktiv" : "aus",
      simulated: feature.enabled ? "aktiv" : "aus",
    });
  }

  const actualActions = new Map(actual.actions.map((action) => [action.key, action]));
  for (const action of simulated.actions) {
    const before = actualActions.get(action.key);
    if (!before || before.allowed === action.allowed) continue;
    changes.push({
      id: `action:${action.key}`,
      area: "Aktion",
      actual: yesNo(before.allowed),
      simulated: yesNo(action.allowed),
    });
  }

  const actualFields = new Map(actual.fields.map((field) => [`${field.table}.${field.column}`, field]));
  for (const field of simulated.fields) {
    const id = `${field.table}.${field.column}`;
    const before = actualFields.get(id);
    if (!before) continue;
    const beforeValue = `${yesNo(before.canRead)} / ${yesNo(before.canWrite)}`;
    const afterValue = `${yesNo(field.canRead)} / ${yesNo(field.canWrite)}`;
    if (beforeValue === afterValue) continue;
    changes.push({
      id: `field:${id}`,
      area: "Feld",
      actual: beforeValue,
      simulated: afterValue,
    });
  }

  return changes;
}
