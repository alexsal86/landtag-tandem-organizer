// Centralized tenant-seeding helpers used by the manage-tenant-user edge function.
// All inserts are idempotent: ON CONFLICT DO NOTHING is handled via duplicate-tolerant inserts
// (we ignore "duplicate key" errors per row group rather than per individual row).

// Minimal admin client type — kept loose because Deno + esm.sh types vary.
type AdminClient = {
  from: (table: string) => {
    insert: (rows: unknown) => Promise<{ error: unknown | null }>;
    upsert: (rows: unknown, options?: { onConflict?: string }) => Promise<{ error: unknown | null }>;
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

// case_file_types kennt nur name/label/color/icon/order_index – kein description.
// label und name sind Pflicht und tragen hier denselben Anzeigenamen.
export const STANDARD_CASE_FILE_TYPES = [
  { name: "Bürgeranfrage", color: "#3b82f6", icon: "MessageSquare" },
  { name: "Beschwerde", color: "#ef4444", icon: "AlertTriangle" },
  { name: "Anfrage Behörde", color: "#8b5cf6", icon: "Building" },
  { name: "Petition", color: "#f59e0b", icon: "FileSignature" },
  { name: "Glückwunsch", color: "#10b981", icon: "PartyPopper" },
  { name: "Termin-Vorbereitung", color: "#06b6d4", icon: "Calendar" },
  { name: "Veranstaltung", color: "#ec4899", icon: "Megaphone" },
  { name: "Sonstiges", color: "#6b7280", icon: "Folder" },
];

export const STANDARD_NOTIFICATION_TYPES = [
  { name: "task_assigned", label: "Aufgabe zugewiesen", category: "tasks" },
  { name: "task_due_soon", label: "Aufgabe läuft bald ab", category: "tasks" },
  { name: "task_completed", label: "Aufgabe abgeschlossen", category: "tasks" },
  { name: "appointment_created", label: "Neuer Termin", category: "calendar" },
  { name: "appointment_updated", label: "Termin geändert", category: "calendar" },
  { name: "appointment_reminder", label: "Termin-Erinnerung", category: "calendar" },
  { name: "appointment_feedback", label: "Termin-Rückmeldung", category: "calendar" },
  { name: "poll_invitation", label: "Terminabstimmung – Einladung", category: "calendar" },
  { name: "poll_response", label: "Terminabstimmung – Antwort", category: "calendar" },
  { name: "poll_follow_up", label: "Terminabstimmung – Erinnerung", category: "calendar" },
  { name: "poll_restored", label: "Abstimmung wiederhergestellt", category: "polls" },
  { name: "letter_review_requested", label: "Brief – Kollegenprüfung erbeten", category: "documents" },
  { name: "letter_approval_requested", label: "Brief – Freigabe erbeten", category: "documents" },
  { name: "letter_approved", label: "Brief – Freigegeben", category: "documents" },
  { name: "letter_rejected", label: "Brief – Zurückgewiesen", category: "documents" },
  { name: "case_file_assigned", label: "Vorgang zugewiesen", category: "cases" },
  { name: "case_file_status_changed", label: "Vorgang – Status geändert", category: "cases" },
  { name: "case_interaction_mention", label: "In Vorgang erwähnt", category: "cases" },
  { name: "case_item_assigned", label: "Vorgang zugewiesen", category: "cases" },
  { name: "case_item_status_changed", label: "Vorgang-Status geändert", category: "cases" },
  { name: "case_item_comment", label: "Vorgang-Kommentar", category: "cases" },
  { name: "decision_requested", label: "Entscheidung erbeten", category: "decisions" },
  { name: "decision_finalized", label: "Entscheidung getroffen", category: "decisions" },
  { name: "task_decision_request", label: "Entscheidungsanfrage erhalten", category: "decisions" },
  { name: "task_decision_completed", label: "Entscheidungsergebnis verfügbar", category: "decisions" },
  { name: "task_decision_creator_response", label: "Antwort auf Ihren Kommentar", category: "decisions" },
  { name: "task_decision_comment_received", label: "Kommentar zu Entscheidungsanfrage", category: "decisions" },
  { name: "task_decision_comment_reaction_received", label: "Neue Reaktion", category: "decisions" },
  { name: "meeting_invitation", label: "Meeting-Einladung", category: "meetings" },
  { name: "meeting_archived", label: "Meeting archiviert", category: "meetings" },
  { name: "employee_meeting_scheduled", label: "Gespräch terminiert", category: "employee" },
  { name: "employee_meeting_request_declined", label: "Gesprächsanfrage abgelehnt", category: "employee" },
  { name: "document_mention", label: "In Dokument erwähnt", category: "documents" },
  { name: "note_follow_up", label: "Wiedervorlage fällig", category: "notes" },
  { name: "quick_note_shared", label: "Notiz geteilt", category: "notes" },
  { name: "team_news", label: "Team-News", category: "team" },
  { name: "news_shared_internal", label: "News intern geteilt", category: "team" },
  { name: "vacation_request", label: "Urlaubsantrag", category: "team" },
  { name: "time_tracking", label: "Fehlende Zeiteinträge", category: "time" },
  { name: "social_post_change_requested", label: "Social Post – Änderung gewünscht", category: "editorial" },
  { name: "social_post_reminder", label: "Social Post – Veröffentlichung steht an", category: "editorial" },
  { name: "social_post_approved", label: "Social Post – Freigegeben", category: "editorial" },
  { name: "social_post_approval_reopened", label: "Social Post – Freigabe erneut nötig", category: "editorial" },
];

// Kanonische Briefanlässe – wortgleich mit DEFAULT_OCCASIONS in
// src/components/administration/LetterOccasionManager.tsx, damit der Seed und
// die Nachpflege in der Verwaltung nicht auseinanderlaufen.
// letter_occasions verlangt key und label; die Muster dienen der Vorlagenwahl.
export const STANDARD_LETTER_OCCASIONS = [
  { key: "buergeranliegen", label: "Bürgeranliegen", description: "Antwort auf Anfragen von Bürgern", icon: "Users", color: "bg-palette-blue", patterns: ["bürger", "anliegen", "antwort", "citizen"] },
  { key: "ministerium", label: "Ministerium", description: "Formelle Korrespondenz mit Ministerien", icon: "Building2", color: "bg-palette-purple", patterns: ["minister", "formal", "amt"] },
  { key: "einladung", label: "Einladung", description: "Veranstaltungseinladungen", icon: "PartyPopper", color: "bg-palette-amber", patterns: ["einladung", "invitation", "event"] },
  { key: "gruss", label: "Gruß & Dank", description: "Glückwünsche, Beileid, Dankschreiben", icon: "Heart", color: "bg-palette-rose", patterns: ["gruß", "gruss", "dank", "beileid", "glückwunsch"] },
  { key: "parlamentarische_anfrage", label: "Parlamentarische Anfrage", description: "Anfragen an die Regierung", icon: "FileQuestion", color: "bg-palette-teal", patterns: ["anfrage", "parlament", "regierung"] },
  { key: "stellungnahme", label: "Stellungnahme", description: "Offizielle Positionierung", icon: "MessageSquare", color: "bg-palette-indigo", patterns: ["stellungnahme", "position", "statement"] },
  { key: "sonstiges", label: "Sonstiges", description: "Freie Briefform", icon: "FileText", color: "bg-muted-foreground", patterns: [] },
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
  /** Konfliktziel für Tabellen, die auch per Tenant-Trigger gefüllt werden (idempotenter Seed). */
  onConflict?: string,
): Promise<void> {
  if (!rows.length) return;
  try {
    const { error } = onConflict
      ? await admin.from(table).upsert(rows, { onConflict })
      : await admin.from(table).insert(rows);
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
  opts: {
    appName?: string;
    appSubtitle?: string;
    /** Der anlegende Super-Admin; meeting_templates/planning_templates verlangen user_id. */
    createdBy: string;
    senderInfo?: Omit<SenderSeedInput, "createdBy">;
  },
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
    STANDARD_CASE_FILE_TYPES.map((t, index) => ({
      ...t,
      label: t.name,
      tenant_id: tenantId,
      is_active: true,
      order_index: index,
    })),
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
    // note_follow_up/quick_note_shared legt bereits der Tenant-Trigger an; ohne
    // Konfliktziel würde der gesamte Insert scheitern und die übrigen Typen fehlen.
    "tenant_id,name",
  );

  // letter_occasions
  await safeInsert(
    admin,
    "letter_occasions",
    STANDARD_LETTER_OCCASIONS.map((o, index) => ({
      tenant_id: tenantId,
      key: o.key,
      label: o.label,
      description: o.description,
      icon: o.icon,
      color: o.color,
      sort_order: index,
      template_match_patterns: o.patterns,
      is_active: true,
    })),
    report,
    "letter_occasions",
  );

  // meeting_templates: Agenda liegt in template_items (Array mit title),
  // user_id ist Pflichtspalte.
  await safeInsert(
    admin,
    "meeting_templates",
    STANDARD_MEETING_TEMPLATES.map((m) => ({
      tenant_id: tenantId,
      user_id: opts.createdBy,
      name: m.name,
      description: m.description,
      template_items: m.agenda_items.map((title, index) => ({ title, order_index: index })),
      default_participants: [],
      default_recurrence: null,
      auto_create_count: 3,
      is_default: false,
    })),
    report,
    "meeting_templates",
  );

  // planning_templates: user_id ist Pflichtspalte.
  await safeInsert(
    admin,
    "planning_templates",
    STANDARD_PLANNING_TEMPLATES.map((p) => ({ ...p, tenant_id: tenantId, user_id: opts.createdBy })),
    report,
    "planning_templates",
  );

  // sender_information: one complete default block, so letters can be written
  // immediately. The office edits the real address later in the settings.
  if (opts.senderInfo) {
    await safeInsert(
      admin,
      "sender_information",
      [buildDefaultSender(tenantId, { ...opts.senderInfo, createdBy: opts.createdBy })],
      report,
      "sender_information",
    );
  }

  return report;
}

export interface SenderSeedInput {
  name: string;
  party?: string;
  city?: string;
  email?: string;
  /** Der anlegende Super-Admin; `sender_information.created_by` ist Pflicht. */
  createdBy: string;
}

/**
 * Neutraler Standard-Absender mit den aktuell vorhandenen Spalten.
 * Anschrift und Kontaktdaten bleiben leer, bis das Büro sie selbst pflegt.
 */
export function buildDefaultSender(tenantId: string, input: SenderSeedInput) {
  return {
    tenant_id: tenantId,
    created_by: input.createdBy,
    name: input.name.trim() || "Abgeordnetenbüro",
    organization: input.party?.trim() || "Abgeordnetenbüro",
    wahlkreis_city: input.city?.trim() || null,
    wahlkreis_email: input.email?.trim() || null,
    is_default: true,
    is_active: true,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// STANDARD DATA CREATED BY DATABASE TRIGGERS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Standarddaten, die Trigger beim Anlegen des Büros erzeugen. Sie stehen nicht im
 * Seed-Report oben, weil sie nicht diese Funktion schreibt, sondern die Datenbank.
 */
export interface GeneratedDefaults {
  topics: number;
  ministry_topic_links: number;
  topic_module_settings: number;
  notification_types_total: number;
}

const GENERATED_COUNTS: Array<{ key: keyof GeneratedDefaults; table: string; column: string }> = [
  { key: "topics", table: "topics", column: "id" },
  { key: "ministry_topic_links", table: "parlis_ministry_topics", column: "topic_id" },
  { key: "topic_module_settings", table: "topic_module_settings", column: "module" },
  { key: "notification_types_total", table: "notification_types", column: "id" },
];

/**
 * Zählt nach dem Anlegen, was im neuen Büro tatsächlich steht – inklusive der
 * Trigger-Daten (Themen-Wolke, Modul-Steuerung, zusätzliche Notification-Typen).
 * Fehlende Tabellen oder Spalten ergeben 0 statt eines Abbruchs.
 */
export async function countSeededDefaults(admin: any, tenantId: string): Promise<GeneratedDefaults> {
  const result: GeneratedDefaults = {
    topics: 0,
    ministry_topic_links: 0,
    topic_module_settings: 0,
    notification_types_total: 0,
  };
  for (const { key, table, column } of GENERATED_COUNTS) {
    try {
      const { count } = await admin
        .from(table)
        .select(column, { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      result[key] = count ?? 0;
    } catch {
      result[key] = 0;
    }
  }
  return result;
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
  // sender_information ist bewusst nicht dabei: Name, Anschrift und Kontakt des
  // Quellbüros gehören nicht in ein neues Büro. Der Wizard legt stattdessen
  // einen neutralen Standard-Absender aus den eingegebenen Stammdaten an.
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

/// Owner-Spalten, die beim Klonen auf den handelnden Super-Admin zeigen,
/// statt auf Personen des Quellbüros.
const CLONE_OWNER_COLUMNS: Record<string, "created_by" | "user_id"> = {
  meeting_templates: "user_id",
  planning_templates: "user_id",
  letter_templates: "created_by",
  appointment_preparation_templates: "created_by",
};

export async function cloneTenantData(
  // We use a more permissive client type here because we need .select with filters.
  admin: any,
  sourceTenantId: string,
  targetTenantId: string,
  opts: { createdBy?: string } = {},
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

      const ownerColumn = CLONE_OWNER_COLUMNS[table];
      if (ownerColumn && opts.createdBy) {
        for (const row of rewritten) row[ownerColumn] = opts.createdBy;
      }

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
