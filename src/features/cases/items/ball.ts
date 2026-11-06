// "Wer ist am Zug?" – Ball-Logik für Vorgänge (reine Funktionen, testbar).

export type BallOwner = "office" | "citizen" | "ministry" | "authority" | "fraction" | "snoozed";
export type ParliamentaryTool = "none" | "inquiry" | "onsite_visit" | "speech" | "letter";

export const BALL_OWNERS: { value: BallOwner; label: string; short: string; dotClass: string }[] = [
  { value: "office", label: "Büro am Zug", short: "Büro", dotClass: "bg-success" },
  { value: "citizen", label: "Wartet auf Bürger", short: "Bürger", dotClass: "bg-warning" },
  { value: "authority", label: "Bei der Verwaltung", short: "Verwaltung", dotClass: "bg-success" },
  { value: "fraction", label: "In der Fraktion", short: "Fraktion", dotClass: "bg-accent-foreground/60" },
  { value: "snoozed", label: "Ruhend / Wiedervorlage", short: "Ruhend", dotClass: "bg-muted-foreground/50" },
];

export const PARLIAMENTARY_TOOLS: { value: ParliamentaryTool; label: string }[] = [
  { value: "none", label: "Kein Instrument" },
  { value: "inquiry", label: "Kleine Anfrage" },
  { value: "onsite_visit", label: "Ortstermin" },
  { value: "speech", label: "Rede / Plenum" },
  { value: "letter", label: "Brief" },
];

export function ballMeta(owner: string | null | undefined) {
  return BALL_OWNERS.find((b) => b.value === (owner === "ministry" ? "authority" : owner)) ?? BALL_OWNERS[0];
}

/** Parlamentarische Antwortfrist bei Ministerien (Kalendertage). */
export const MINISTRY_RESPONSE_DAYS = 21;

/** Vorschläge in Kalendertagen; vorhandene oder ausdrücklich gesetzte Fristen bleiben erhalten. */
export const DEFAULT_RESPONSE_DAYS: Record<BallOwner, number> = {
  office: 3,
  citizen: 14,
  ministry: MINISTRY_RESPONSE_DAYS,
  authority: MINISTRY_RESPONSE_DAYS,
  fraction: 7,
  snoozed: 14,
};

/** Ergänzt beim Wechsel der Zuständigkeit eine bearbeitbare Frist. */
export function withAutoDeadline<T extends { ball_owner?: string | null; next_action_due_at?: string | null; next_action_label?: string | null }>(
  current: TriageItem,
  patch: T,
  now: Date = new Date(),
): T {
  const days = patch.ball_owner ? DEFAULT_RESPONSE_DAYS[patch.ball_owner as BallOwner] : undefined;
  if (days === undefined || current.next_action_due_at || Object.prototype.hasOwnProperty.call(patch, "next_action_due_at")) return patch;
  const due = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12);
  return {
    ...patch,
    next_action_due_at: due.toISOString(),
    ...((patch.ball_owner === "ministry" || patch.ball_owner === "authority") ? {
      next_action_label: patch.next_action_label ?? current.next_action_label ?? (patch.ball_owner === "ministry" ? "Antwort des Ministeriums nachhalten" : "Antwort der Verwaltung nachhalten"),
    } : {}),
  };
}

export type TriageFilter = "all" | "mine" | "office" | "waiting" | "due_soon" | "no_next_action";

export type TriageItem = {
  ball_owner?: string | null;
  next_action_label?: string | null;
  next_action_due_at?: string | null;
  next_action_assignee_id?: string | null;
  owner_user_id?: string | null;
};

/** Tage bis zur Frist des nächsten Schritts (negativ = überfällig), null wenn keine Frist. */
export function daysUntilNextAction(item: TriageItem, now: Date = new Date()): number | null {
  if (!item.next_action_due_at) return null;
  const due = new Date(item.next_action_due_at);
  if (Number.isNaN(due.getTime())) return null;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOf(due) - startOf(now)) / 86_400_000);
}

/** "Frist nah" = überfällig oder innerhalb der nächsten 3 Tage. */
export const DUE_SOON_DAYS = 3;

export function matchesTriage(item: TriageItem, filter: TriageFilter, userId: string | null, now: Date = new Date()): boolean {
  const owner = item.ball_owner || "office";
  switch (filter) {
    case "all":
      return true;
    case "mine":
      return owner === "office" && !!userId && (item.next_action_assignee_id ?? item.owner_user_id) === userId;
    case "office":
      return owner === "office";
    case "waiting":
      return owner === "citizen" || owner === "ministry" || owner === "authority" || owner === "fraction";
    case "due_soon": {
      const d = daysUntilNextAction(item, now);
      return d !== null && d <= DUE_SOON_DAYS;
    }
    case "no_next_action":
      return owner === "office" && !item.next_action_label?.trim();
  }
}

export function countTriage(items: TriageItem[], userId: string | null, now: Date = new Date()): Record<TriageFilter, number> {
  const filters: TriageFilter[] = ["all", "mine", "office", "waiting", "due_soon", "no_next_action"];
  return Object.fromEntries(filters.map((f) => [f, items.filter((i) => matchesTriage(i, f, userId, now)).length])) as Record<TriageFilter, number>;
}

export const TRIAGE_FILTERS: { value: TriageFilter; label: string; hint: string }[] = [
  { value: "all", label: "Alle", hint: "Alle offenen Vorgänge" },
  { value: "mine", label: "Mein Ball", hint: "Das Büro ist am Zug und du bist für den nächsten Schritt zuständig" },
  { value: "office", label: "Büro am Zug", hint: "Wir müssen handeln" },
  { value: "waiting", label: "Wartet", hint: "Ball liegt bei Bürger, Ministerium, Behörde oder Fraktion" },
  { value: "due_soon", label: "Frist nah", hint: "Nächster Schritt überfällig oder in den nächsten 3 Tagen fällig" },
  { value: "no_next_action", label: "Ohne nächsten Schritt", hint: "Büro ist am Zug, aber niemand hat festgelegt, was als Nächstes passiert" },
];

/** Ein Schritt gilt als festgelegt, sobald ein Text gespeichert ist. */
export function stepState(item: TriageItem): "none" | "set" {
  return item.next_action_label?.trim() ? "set" : "none";
}

/** Wiedervorlage = festgelegter Schritt mit Frist nach heute. Ab dem Fristtag kehrt der Vorgang in die Liste zurück. */
export function isOnResubmission(item: TriageItem, now: Date = new Date()): boolean {
  if (stepState(item) !== "set") return false;
  const d = daysUntilNextAction(item, now);
  return d !== null && d > 0;
}

const OWNER_PHRASE: Record<BallOwner, string> = {
  office: "beim Büro",
  citizen: "bei der Bürgerin / dem Bürger",
  ministry: "beim Ministerium",
  authority: "bei der Verwaltung",
  fraction: "bei der Fraktion",
  snoozed: "ruhend",
};

export function resubmissionHint(item: TriageItem, now: Date = new Date()): string | null {
  if (!isOnResubmission(item, now)) return null;
  const due = new Date(item.next_action_due_at!);
  const date = `${String(due.getDate()).padStart(2, "0")}.${String(due.getMonth() + 1).padStart(2, "0")}.`;
  const owner = ballMeta(item.ball_owner).value;
  const where = owner === "snoozed" ? "ruht" : `liegt ${OWNER_PHRASE[owner]}`;
  return `Wiedervorlage: Der Vorgang ${where} und erscheint am ${date} wieder unter „Heute“.`;
}

export type BallChangeEvent = { title: string; note?: string };

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

/** Verlaufseinträge für eine Änderung an „Wer ist am Zug?“ / nächstem Schritt. */
export function ballChangeEvents(
  prev: TriageItem,
  patch: Partial<TriageItem>,
  nameOf: (id: string | null | undefined) => string | null = () => null,
  now: Date = new Date(),
): BallChangeEvent[] {
  const events: BallChangeEvent[] = [];
  if (patch.ball_owner !== undefined && (patch.ball_owner || "office") !== (prev.ball_owner || "office")) {
    events.push({ title: "Am Zug geändert", note: `${ballMeta(prev.ball_owner).short} → ${ballMeta(patch.ball_owner).short}` });
  }
  const next = { ...prev, ...patch };
  const labelChanged = patch.next_action_label !== undefined && (patch.next_action_label ?? "") !== (prev.next_action_label ?? "");
  const dueChanged = patch.next_action_due_at !== undefined && fmtDate(patch.next_action_due_at) !== fmtDate(prev.next_action_due_at);
  const assigneeChanged = patch.next_action_assignee_id !== undefined && (patch.next_action_assignee_id ?? null) !== (prev.next_action_assignee_id ?? null);
  const details = [
    fmtDate(next.next_action_due_at) ? `Frist: ${fmtDate(next.next_action_due_at)}` : null,
    nameOf(next.next_action_assignee_id) ? `Zuständig: ${nameOf(next.next_action_assignee_id)}` : null,
  ].filter(Boolean).join(" · ");
  if (labelChanged && next.next_action_label?.trim()) {
    events.push({ title: stepState(prev) === "set" ? "Schritt geändert" : "Schritt festgelegt", note: [next.next_action_label.trim(), details].filter(Boolean).join(" · ") });
  } else if ((dueChanged || assigneeChanged) && stepState(next) === "set") {
    events.push({ title: "Schritt geändert", note: [next.next_action_label!.trim(), details].filter(Boolean).join(" · ") });
  }
  if (!isOnResubmission(prev, now) && isOnResubmission(next, now)) {
    events.push({ title: "Auf Wiedervorlage gelegt", note: `bis ${fmtDate(next.next_action_due_at)}` });
  }
  return events;
}
