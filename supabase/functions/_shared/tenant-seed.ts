// Centralized tenant-seeding helpers used by the manage-tenant-user edge function.
// All inserts are idempotent: ON CONFLICT DO NOTHING is handled via duplicate-tolerant inserts
// (we ignore "duplicate key" errors per row group rather than per individual row).

// Minimal admin client type — kept loose because Deno + esm.sh types vary.
type AdminClient = {
  from: (table: string) => {
    insert: (rows: unknown) => Promise<{ error: unknown | null }>;
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown | null }>;
      };
    };
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// STANDARD SEEDS
// ──────────────────────────────────────────────────────────────────────────────

export const STANDARD_CASE_FILE_TYPES = [
  { name: "Bürgeranfrage", description: "Anfrage einer Bürgerin oder eines Bürgers", color: "#3b82f6", icon: "MessageSquare" },
  { name: "Beschwerde", description: "Förmliche Beschwerde mit Bearbeitungsbedarf", color: "#ef4444", icon: "AlertTriangle" },
  { name: "Anfrage Behörde", description: "Anfrage an oder von einer Behörde", color: "#8b5cf6", icon: "Building" },
  { name: "Petition", description: "Petition oder Sammeleingabe", color: "#f59e0b", icon: "FileSignature" },
  { name: "Glückwunsch", description: "Glückwunsch- oder Grußanlass", color: "#10b981", icon: "PartyPopper" },
  { name: "Termin-Vorbereitung", description: "Vorbereitung eines politischen Termins", color: "#06b6d4", icon: "Calendar" },
  { name: "Veranstaltung", description: "Eigene oder fremde Veranstaltung", color: "#ec4899", icon: "Megaphone" },
  { name: "Sonstiges", description: "Allgemeiner Vorgang ohne klare Kategorie", color: "#6b7280", icon: "Folder" },
];

export const STANDARD_NOTIFICATION_TYPES = [
  { name: "task_assigned", label: "Aufgabe zugewiesen", category: "tasks" },
  { name: "task_due_soon", label: "Aufgabe läuft bald ab", category: "tasks" },
  { name: "task_completed", label: "Aufgabe abgeschlossen", category: "tasks" },
  { name: "appointment_created", label: "Neuer Termin", category: "appointments" },
  { name: "appointment_updated", label: "Termin geändert", category: "appointments" },
  { name: "appointment_reminder", label: "Termin-Erinnerung", category: "appointments" },
  { name: "poll_invitation", label: "Terminabstimmung – Einladung", category: "appointments" },
  { name: "poll_response", label: "Terminabstimmung – Antwort", category: "appointments" },
  { name: "letter_review_requested", label: "Brief – Kollegenprüfung erbeten", category: "letters" },
  { name: "letter_approval_requested", label: "Brief – Freigabe erbeten", category: "letters" },
  { name: "letter_approved", label: "Brief – Freigegeben", category: "letters" },
  { name: "letter_rejected", label: "Brief – Zurückgewiesen", category: "letters" },
  { name: "case_file_assigned", label: "Vorgang zugewiesen", category: "casefiles" },
  { name: "case_file_status_changed", label: "Vorgang – Status geändert", category: "casefiles" },
  { name: "decision_requested", label: "Entscheidung erbeten", category: "decisions" },
  { name: "decision_finalized", label: "Entscheidung getroffen", category: "decisions" },
  { name: "meeting_invitation", label: "Meeting-Einladung", category: "meetings" },
  { name: "meeting_archived", label: "Meeting archiviert", category: "meetings" },
  { name: "document_mention", label: "In Dokument erwähnt", category: "documents" },
  { name: "team_news", label: "Team-News", category: "team" },
  { name: "vacation_request", label: "Urlaubsantrag", category: "team" },
  { name: "social_post_change_requested", label: "Social Post – Änderung gewünscht", category: "editorial" },
  { name: "social_post_reminder", label: "Social Post – Veröffentlichung steht an", category: "editorial" },
  { name: "social_post_approved", label: "Social Post – Freigegeben", category: "editorial" },
];

export const STANDARD_LETTER_OCCASIONS = [
  { name: "Geburtstag", description: "Geburtstagsglückwunsch" },
  { name: "Kondolenz", description: "Beileidsschreiben" },
  { name: "Hochzeit", description: "Glückwunsch zur Hochzeit" },
  { name: "Jubiläum", description: "Geschäfts- oder Vereinsjubiläum" },
  { name: "Glückwunsch", description: "Allgemeiner Glückwunsch" },
  { name: "Dankschreiben", description: "Dank an Bürger oder Institution" },
  { name: "Antwort Bürgeranfrage", description: "Antwort auf Bürgeranfrage" },
];

export const STANDARD_MEETING_TEMPLATES = [
  { name: "Jour Fixe", description: "Wöchentliches Team-Meeting", agenda_items: ["Wochenrückblick", "Aktuelle Vorgänge", "Aufgabenverteilung", "Sonstiges"] },
  { name: "Wahlkreis-Termin", description: "Vor-Ort-Termin im Wahlkreis", agenda_items: ["Begrüßung", "Anliegen", "Nächste Schritte"] },
];

export const STANDARD_PLANNING_TEMPLATES = [
  { name: "Veranstaltungsplanung", description: "Standard-Checkliste für eigene Veranstaltungen" },
];

export function buildStandardAppSettings(tenantId: string, opts: { appName?: string; appSubtitle?: string }) {
  return [
    { tenant_id: tenantId, setting_key: "app_name", setting_value: opts.appName || "LandtagsOS" },
    { tenant_id: tenantId, setting_key: "app_subtitle", setting_value: opts.appSubtitle || "Koordinationssystem" },
    { tenant_id: tenantId, setting_key: "app_logo_url", setting_value: "" },
    { tenant_id: tenantId, setting_key: "default_dashboard_cover_url", setting_value: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1920" },
    { tenant_id: tenantId, setting_key: "default_dashboard_cover_position", setting_value: "center" },
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// SEED REPORT
// ──────────────────────────────────────────────────────────────────────────────

export interface SeedReport {
  app_settings: number;
  case_file_types: number;
  notification_types: number;
  letter_occasions: number;
  meeting_templates: number;
  planning_templates: number;
  letter_templates: number;
  sender_information: number;
  appointment_preparation_templates: number;
  event_email_templates: number;
  news_email_templates: number;
  vacation_checklist_templates: number;
  errors: string[];
}

function emptyReport(): SeedReport {
  return {
    app_settings: 0,
    case_file_types: 0,
    notification_types: 0,
    letter_occasions: 0,
    meeting_templates: 0,
    planning_templates: 0,
    letter_templates: 0,
    sender_information: 0,
    appointment_preparation_templates: 0,
    event_email_templates: 0,
    news_email_templates: 0,
    vacation_checklist_templates: 0,
    errors: [],
  };
}

async function safeInsert(
  admin: AdminClient,
  table: string,
  rows: Record<string, unknown>[],
  report: SeedReport,
  reportKey: keyof SeedReport,
): Promise<void> {
  if (!rows.length) return;
  try {
    const { error } = await admin.from(table).insert(rows);
    if (error) {
      const msg = (error as { message?: string }).message ?? String(error);
      // Tolerate duplicates and missing tables — we treat seeds as best-effort
      if (/duplicate key|unique constraint/i.test(msg)) {
        // partial success — treat as 0 inserted (already present)
        return;
      }
      if (/relation .* does not exist/i.test(msg)) {
        report.errors.push(`${table}: table not found`);
        return;
      }
      report.errors.push(`${table}: ${msg}`);
      return;
    }
    (report[reportKey] as number) += rows.length;
  } catch (err) {
    report.errors.push(`${table}: ${(err as Error).message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// SEED STANDARD
// ──────────────────────────────────────────────────────────────────────────────

export async function seedStandardData(
  admin: AdminClient,
  tenantId: string,
  opts: { appName?: string; appSubtitle?: string },
): Promise<SeedReport> {
  const report = emptyReport();

  // app_settings
  await safeInsert(
    admin,
    "app_settings",
    buildStandardAppSettings(tenantId, opts),
    report,
    "app_settings",
  );

  // case_file_types
  await safeInsert(
    admin,
    "case_file_types",
    STANDARD_CASE_FILE_TYPES.map((t) => ({ ...t, tenant_id: tenantId, is_active: true })),
    report,
    "case_file_types",
  );

  // notification_types
  await safeInsert(
    admin,
    "notification_types",
    STANDARD_NOTIFICATION_TYPES.map((t) => ({ ...t, tenant_id: tenantId, is_active: true })),
    report,
    "notification_types",
  );

  // letter_occasions
  await safeInsert(
    admin,
    "letter_occasions",
    STANDARD_LETTER_OCCASIONS.map((o) => ({ ...o, tenant_id: tenantId, is_active: true })),
    report,
    "letter_occasions",
  );

  // meeting_templates (best effort; column shape varies)
  await safeInsert(
    admin,
    "meeting_templates",
    STANDARD_MEETING_TEMPLATES.map((m) => ({
      tenant_id: tenantId,
      name: m.name,
      description: m.description,
      agenda_items: m.agenda_items,
    })),
    report,
    "meeting_templates",
  );

  // planning_templates
  await safeInsert(
    admin,
    "planning_templates",
    STANDARD_PLANNING_TEMPLATES.map((p) => ({ ...p, tenant_id: tenantId })),
    report,
    "planning_templates",
  );

  return report;
}

// ──────────────────────────────────────────────────────────────────────────────
// CLONE FROM ANOTHER TENANT
// ──────────────────────────────────────────────────────────────────────────────

const CLONE_TABLES: Array<{ table: string; key: keyof SeedReport }> = [
  { table: "app_settings", key: "app_settings" },
  { table: "case_file_types", key: "case_file_types" },
  { table: "notification_types", key: "notification_types" },
  { table: "letter_occasions", key: "letter_occasions" },
  { table: "letter_templates", key: "letter_templates" },
  { table: "sender_information", key: "sender_information" },
  { table: "meeting_templates", key: "meeting_templates" },
  { table: "planning_templates", key: "planning_templates" },
  { table: "appointment_preparation_templates", key: "appointment_preparation_templates" },
  { table: "event_email_templates", key: "event_email_templates" },
  { table: "news_email_templates", key: "news_email_templates" },
  { table: "vacation_checklist_templates", key: "vacation_checklist_templates" },
];

// Strip identity/audit fields so Postgres re-generates them on insert.
const STRIP_FIELDS = new Set(["id", "created_at", "updated_at", "created_by", "updated_by"]);

function rewriteRow(row: Record<string, unknown>, targetTenantId: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (STRIP_FIELDS.has(k)) continue;
    out[k] = k === "tenant_id" ? targetTenantId : v;
  }
  return out;
}

export async function cloneTenantData(
  // We use a more permissive client type here because we need .select with filters.
  admin: any,
  sourceTenantId: string,
  targetTenantId: string,
): Promise<SeedReport> {
  const report = emptyReport();

  for (const { table, key } of CLONE_TABLES) {
    try {
      const { data: srcRows, error: selectError } = await admin
        .from(table)
        .select("*")
        .eq("tenant_id", sourceTenantId);

      if (selectError) {
        const msg = (selectError as { message?: string }).message ?? String(selectError);
        if (/relation .* does not exist/i.test(msg)) {
          report.errors.push(`${table}: table not found`);
          continue;
        }
        report.errors.push(`${table} (select): ${msg}`);
        continue;
      }

      if (!srcRows || srcRows.length === 0) continue;

      const rewritten = (srcRows as Record<string, unknown>[]).map((r) =>
        rewriteRow(r, targetTenantId),
      );

      await safeInsert(admin, table, rewritten, report, key);
    } catch (err) {
      report.errors.push(`${table}: ${(err as Error).message}`);
    }
  }

  return report;
}

// ──────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ──────────────────────────────────────────────────────────────────────────────

export interface TenantHealth {
  tenant_id: string;
  users: number;
  case_file_types: number;
  letter_templates: number;
  meeting_templates: number;
  notification_types: number;
  sender_information: number;
  app_settings: number;
}

const HEALTH_TABLES: Array<keyof Omit<TenantHealth, "tenant_id" | "users">> = [
  "case_file_types",
  "letter_templates",
  "meeting_templates",
  "notification_types",
  "sender_information",
  "app_settings",
];

export async function getTenantHealth(admin: any, tenantId: string): Promise<TenantHealth> {
  const result: TenantHealth = {
    tenant_id: tenantId,
    users: 0,
    case_file_types: 0,
    letter_templates: 0,
    meeting_templates: 0,
    notification_types: 0,
    sender_information: 0,
    app_settings: 0,
  };

  // Active users
  const { count: userCount } = await admin
    .from("user_tenant_memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  result.users = userCount ?? 0;

  for (const table of HEALTH_TABLES) {
    try {
      const { count } = await admin
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      result[table] = count ?? 0;
    } catch {
      // table missing or no id column — treat as 0
      result[table] = 0;
    }
  }

  return result;
}
