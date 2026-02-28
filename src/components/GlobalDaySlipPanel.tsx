import { memo, useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  type EditorState,
  type LexicalEditor,
  KEY_ENTER_COMMAND,
  ParagraphNode,
} from "lexical";
import {
  $createHorizontalRuleNode,
  HorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";
import { BLUR_COMMAND, FOCUS_COMMAND } from "lexical";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import {
  ClipboardPen,
  Check,
  Clock3,
  Folder,
  FolderArchive,
  ListTodo,
  NotebookPen,
  Pencil,
  Scale,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import FloatingTextFormatToolbar from "@/components/FloatingTextFormatToolbar";
import { DaySlipLineNode, $createDaySlipLineNode } from "@/components/DaySlipLineNode";
import { LabeledHorizontalRuleNode, $createLabeledHorizontalRuleNode } from "@/components/LabeledHorizontalRuleNode";
import { cn } from "@/lib/utils";
import { WeeklyRoutineGrid } from "@/components/dayslip/WeeklyRoutineGrid";
import { WeekPlanningBanner, getWeekPlanForDay } from "@/components/dayslip/WeekPlanningBanner";

// ─── Types ───────────────────────────────────────────────────────────────────

type ResolveTarget = "note" | "task" | "decision" | "archived" | "snoozed";

interface DaySlipDayData {
  html: string;
  plainText: string;
  nodes?: string;
  struckLines?: string[]; // deprecated legacy fallback (read-only)
  struckLineIds?: string[];
  resolved?: Array<{ lineId: string; text: string; target: ResolveTarget }>;
  completedAt?: string;
  recurringInjected?: boolean;
  lineTimestamps?: Record<string, { addedAt: string; checkedAt?: string }>;
  dayMood?: 1 | 2 | 3 | 4 | 5;
}

type ResolvedItem = { lineId: string; text: string; target: ResolveTarget };

type DaySlipStore = Record<string, DaySlipDayData>;

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "day-slip-v2";
const RECURRING_STORAGE_KEY = "day-slip-recurring-v2";
const DAY_TEMPLATE_STORAGE_KEY = "day-slip-day-templates-v1";
const RESOLVE_EXPORT_KEY = "day-slip-resolve-export-v1";
const SAVE_DEBOUNCE_MS = 400;

// ─── Helpers ─────────────────────────────────────────────────────────────────


type DaySlipLineEntry = { id: string; text: string };
type RecurringTemplate = {
  id: string;
  text: string;
  weekday: (typeof weekDays)[number];
};
type ResolveExportItem = {
  sourceDayKey: string;
  lineId: string;
  text: string;
  target: Exclude<ResolveTarget, "archived" | "snoozed">;
  createdAt: string;
};

type DayTemplate = {
  id: string;
  name: string;
  lines: string[];
};

const defaultDayTemplates: DayTemplate[] = [
  {
    id: "plenary-day",
    name: "Plenar-/Sitzungstag",
    lines: [
      "--- 1) Vor Start ---",
      "!! Tagesordnung + Redebeiträge final prüfen",
      "Mappen/Links für Sitzung und Team bereitstellen",
      "--- 2) Während der Sitzung ---",
      "! Offene Fragen + Zusagen live notieren",
      "Beschlüsse inkl. Fristen protokollieren",
      "--- 3) Direkt danach ---",
      "Aufgaben an zuständige Personen verteilen",
      "Follow-ups in Kalender/Taskliste eintragen",
    ],
  },
  {
    id: "committee-day",
    name: "Ausschusstag",
    lines: [
      "--- 1) Vorbereitung ---",
      "Einladung, Unterlagen und Stellungnahmen querlesen",
      "!! Kritische Nachfragen + Kernbotschaften formulieren",
      "--- 2) Termin ---",
      "Fragen, Antworten und nächste Schritte mitschreiben",
      "Stakeholder mit Bezug markieren",
      "--- 3) Nachbereitung ---",
      "Beschlusslage intern kurz zusammenfassen",
      "Offene Punkte an Fachreferate übergeben",
    ],
  },
  {
    id: "district-day",
    name: "Wahlkreis-/Bürgersprechstunden-Tag",
    lines: [
      "--- 1) Vorbereitung ---",
      "Termine + Anfahrten gegenprüfen",
      "Bürgeranliegen nach Dringlichkeit sortieren",
      "--- 2) Vor Ort ---",
      "! Zusagen realistisch und konkret festhalten",
      "Rückruf-/Antwortfristen direkt notieren",
      "--- 3) Nachbereitung ---",
      "Anliegen in Aufgaben überführen",
      "Status-Update für Team/Assistenz senden",
    ],
  },
  {
    id: "homeoffice-day",
    name: "Homeoffice-Tag",
    lines: [
      "--- 1) Fokusblöcke ---",
      "!! Wichtigste Aufgabe des Tages (MIT)",
      "! E-Mails nur um 11:00 und 16:00",
      "--- 2) Kommunikation ---",
      "Jour fixe vorbereiten",
      "Rückrufe und Nachrichten abarbeiten",
      "--- 3) Tagesabschluss ---",
      "Ergebnisse dokumentieren",
      "Top-3 für morgen festlegen",
    ],
  },
];

const weekDays = ["all", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

const weekDayLabels: Record<(typeof weekDays)[number], string> = {
  all: "Jeden Tag",
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
  saturday: "Samstag",
  sunday: "Sonntag",
};

const toDayKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDate = (dayKey: string) => {
  const date = new Date(`${dayKey}T12:00:00`);
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim();

/**
 * Extracts non-empty paragraph text values from HTML.
 * Skips horizontal rule separators.
 */
const extractLinesFromHtml = (html: string): DaySlipLineEntry[] => {
  if (!html.trim()) return [];
  const parser = new DOMParser();
  const dom = parser.parseFromString(html, "text/html");
  return Array.from(dom.querySelectorAll("p"))
    .map((p) => ({
      id: p.dataset.lineId || crypto.randomUUID(),
      text: (p.textContent ?? "").trim(),
    }))
    .filter((line) => line.text.length > 0 && !isRuleLine(line.text));
};

const normalizeRuleMarker = (text: string) =>
  text
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, "")
    .trim();

const normalizeLineText = (text: string) => text.replace(/\s+/g, " ").trim();
const isRuleLine = (text: string) => /^[-_]{3,}$/.test(normalizeRuleMarker(text));

const parseRuleLine = (text: string): { isRule: boolean; label?: string } => {
  const trimmed = text.trim();
  const match = trimmed.match(/^[-–—―−_]{3,}\s*(.*)$/);
  if (!match) return { isRule: false };
  const label = match[1]?.trim();
  return { isRule: true, label: label || undefined };
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const toParagraphHtml = (entry: DaySlipLineEntry) =>
  `<p data-line-id="${entry.id}">${escapeHtml(entry.text)}</p>`;

const weekdayKey = (date: Date): (typeof weekDays)[number] => {
  const idx = date.getDay();
  if (idx === 0) return "sunday";
  if (idx === 1) return "monday";
  if (idx === 2) return "tuesday";
  if (idx === 3) return "wednesday";
  if (idx === 4) return "thursday";
  if (idx === 5) return "friday";
  return "saturday";
};

// ─── Lexical Plugins ─────────────────────────────────────────────────────────

function InitialContentPlugin({
  initialHtml,
  initialNodes,
  dayKey,
}: {
  initialHtml: string;
  initialNodes?: string;
  dayKey: string;
}) {
  const [editor] = useLexicalComposerContext();
  const loadedForDayRef = useRef<string | null>(null);

  useEffect(() => {
    if (loadedForDayRef.current === dayKey) return;
    loadedForDayRef.current = dayKey;

    editor.update(() => {
      const root = $getRoot();
      root.clear();

      if (initialNodes?.trim()) {
        try {
          const parsed = editor.parseEditorState(initialNodes);
          editor.setEditorState(parsed);
          return;
        } catch (e) {
          console.warn("Failed to parse saved nodes, falling back to HTML", e);
        }
      }

      if (initialHtml.trim()) {
        const parser = new DOMParser();
        const dom = parser.parseFromString(initialHtml, "text/html");
        const nodes = $generateNodesFromDOM(editor, dom);
        root.append(...nodes);
        return;
      }

      root.append($createDaySlipLineNode());
    });
  }, [dayKey, editor, initialHtml, initialNodes]);

  return null;
}

function DaySlipEnterBehaviorPlugin() {
  const [editor] = useLexicalComposerContext();
  

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        // Shift+Enter → default behaviour
        if (event?.shiftKey) return false;

        // Read the current text synchronously first
        let currentText = "";
        let hasRangeSelection = false;
        editor.getEditorState().read(() => {
          const sel = $getSelection();
          if ($isRangeSelection(sel)) {
            hasRangeSelection = true;
            currentText = sel.anchor.getNode().getTopLevelElementOrThrow().getTextContent().trim();
          }
        });

        if (!hasRangeSelection) return false;

        // Check for rule line (with optional label)
        const ruleParsed = parseRuleLine(currentText);

        // Prevent default BEFORE the (potentially deferred) update
        event?.preventDefault();

        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const topLevel =
            selection.anchor.getNode().getTopLevelElementOrThrow();

          if (ruleParsed.isRule) {
            const hrNode = ruleParsed.label
              ? $createLabeledHorizontalRuleNode(ruleParsed.label)
              : $createHorizontalRuleNode();
            const newParagraph = $createDaySlipLineNode();
            topLevel.replace(hrNode);
            hrNode.insertAfter(newParagraph);
            newParagraph.select();
            return;
          }

          const newParagraph = $createDaySlipLineNode();
          newParagraph.append($createTextNode(""));
          topLevel.insertAfter(newParagraph);
          newParagraph.select();
        });

        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor]);

  return null;
}

function FocusPlugin({ onFocusChange }: { onFocusChange: (focused: boolean) => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const unregFocus = editor.registerCommand(
      FOCUS_COMMAND,
      () => { onFocusChange(true); return false; },
      COMMAND_PRIORITY_CRITICAL,
    );
    const unregBlur = editor.registerCommand(
      BLUR_COMMAND,
      () => { onFocusChange(false); return false; },
      COMMAND_PRIORITY_CRITICAL,
    );
    return () => { unregFocus(); unregBlur(); };
  }, [editor, onFocusChange]);

  return null;
}

function EditorEditablePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);

  return null;
}

interface DaySlipEditorProps {
  initialHtml: string;
  initialNodes?: string;
  dayKey: string;
  resolveMode: boolean;
  editorConfig: Parameters<typeof LexicalComposer>[0]["initialConfig"];
  onEditorChange: (editorState: EditorState, editor: LexicalEditor) => void;
  onEditorReady: (editor: LexicalEditor) => void;
  onEditorClick: (e: MouseEvent<HTMLDivElement>) => void;
  onEditorContextMenu: (e: MouseEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
  hidden?: boolean;
}

const DaySlipEditor = memo(function DaySlipEditor(props: DaySlipEditorProps) {
  const {
    initialHtml,
    initialNodes,
    dayKey,
    resolveMode,
    editorConfig,
    onEditorChange,
    onEditorReady,
    onEditorClick,
    onEditorContextMenu,
    onDrop,
    hidden,
  } = props;

  const [isFocused, setIsFocused] = useState(false);
  const handleFocusChange = useCallback((focused: boolean) => setIsFocused(focused), []);

  const prevProps = useRef(props);
  useEffect(() => {
    const changed = Object.entries(props).filter(
      ([k, v]) => prevProps.current[k as keyof DaySlipEditorProps] !== v,
    );
    if (changed.length) {
      console.log("DaySlipEditor props changed:", changed.map(([k]) => k));
    }
    prevProps.current = props;
  });

  return (
    <div
      className={`relative flex-1 border-b border-border/60${hidden ? " hidden" : ""}`}
      onClick={onEditorClick}
      onContextMenu={onEditorContextMenu}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <LexicalComposer initialConfig={editorConfig}>
        <EditorEditablePlugin editable={!resolveMode} />
        <div className="relative h-full">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="editor-input h-full min-h-[340px] p-4 text-sm focus:outline-none" />
            }
            placeholder={
              <div className={`pointer-events-none absolute left-4 top-4 whitespace-pre-line text-base italic text-muted-foreground transition-opacity duration-200 ${isFocused ? "opacity-0" : "opacity-100"}`}>
                {"Was steht heute an? Einfach drauflos schreiben …\n\n— Rückruf Joschka\n— Pressemitteilung Schulgesetz abstimmen\n— Unterlagen Ausschusssitzung"}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <FloatingTextFormatToolbar />
        </div>
        <OnChangePlugin onChange={onEditorChange} />
        <OnChangePlugin
          onChange={(_, editor) => {
            onEditorReady(editor);
          }}
          ignoreSelectionChange
        />
        <HistoryPlugin />
        <HorizontalRulePlugin />
        <DaySlipEnterBehaviorPlugin />
        <FocusPlugin onFocusChange={handleFocusChange} />
        <InitialContentPlugin
          initialHtml={initialHtml}
          initialNodes={initialNodes}
          dayKey={dayKey}
        />
      </LexicalComposer>
    </div>
  );
});

// ─── Lexical editor theme ─────────────────────────────────────────────────────
//
// The `—` before each paragraph is the interactive strike toggle.
// It is always visible (no opacity trick) so users immediately understand
// it is clickable. The cursor changes to `pointer` on hover as affordance.
// Struck lines get `line-through` via the `.struck` class toggled in JS.
//
const editorTheme = {
  paragraph:
    "day-slip-item group relative mb-1.5 pl-6 " +
    // Short dash marker only for non-empty lines
    "before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 " +
    "before:content-['–'] before:text-muted-foreground before:opacity-0 " +
    "before:cursor-pointer before:select-none " +
    "before:rounded before:px-0.5 before:border before:border-transparent " +
    "before:transition-colors transition-all duration-200 " +
    "[&.has-text]:before:opacity-100 " +
    "hover:before:border-border/70 hover:before:bg-muted/40 hover:before:shadow-sm",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
  },
  horizontalRule: "my-4 border-border/80",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function GlobalDaySlipPanel() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('day-slip-panel-open');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('day-slip-panel-open', JSON.stringify(open)); } catch {
      // ignore localStorage write failures
    }
  }, [open]);
  const [showArchive, setShowArchive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [store, setStore] = useState<DaySlipStore>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as DaySlipStore) : {};
    } catch {
      return {};
    }
  });
  const [resolveMode, setResolveMode] = useState(false);
  const [closing, setClosing] = useState(false);
  const [contentTransitioning, setContentTransitioning] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [showCompletePulse, setShowCompletePulse] = useState(false);
  const [recurringDraft, setRecurringDraft] = useState("");
  const [recurringEditIndex, setRecurringEditIndex] = useState<number | null>(null);
  const [recurringEditDraft, setRecurringEditDraft] = useState("");
  const [recurringDraftWeekday, setRecurringDraftWeekday] = useState<(typeof weekDays)[number]>("all");
  const [recurringItems, setRecurringItems] = useState<RecurringTemplate[]>(() => {
    try {
      const raw = localStorage.getItem(RECURRING_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as RecurringTemplate[] | string[];
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return [];
        if (typeof parsed[0] === "string") {
          return (parsed as string[]).map((text) => ({
            id: crypto.randomUUID(),
            text,
            weekday: "all",
          }));
        }
        return (parsed as RecurringTemplate[]).map((item) => ({
          id: item.id ?? crypto.randomUUID(),
          text: item.text,
          weekday: weekDays.includes(item.weekday) ? item.weekday : "all",
        }));
      }
      return [];
    } catch {
      return [];
    }
  });
  const [dayTemplates] = useState<DayTemplate[]>(() => {
    try {
      const raw = localStorage.getItem(DAY_TEMPLATE_STORAGE_KEY);
      if (!raw) return defaultDayTemplates;
      const parsed = JSON.parse(raw) as DayTemplate[];
      if (!Array.isArray(parsed) || parsed.length === 0) return defaultDayTemplates;
      return parsed;
    } catch {
      return defaultDayTemplates;
    }
  });
  const [lineContextMenu, setLineContextMenu] = useState<{
    x: number;
    y: number;
    lineId: string;
    text: string;
  } | null>(null);

  const editorRef = useRef<LexicalEditor | null>(null);
  const [editorReadyVersion, setEditorReadyVersion] = useState(0);

  // Debounce ref for localStorage writes
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const todayKey = toDayKey(new Date());
  const todayData = store[todayKey] ?? {
    html: "",
    plainText: "",
    nodes: "",
    struckLines: [],
    lineTimestamps: {},
  };

  // Editor key: stable per day, only remounts on day change
  // No increment on open/close to preserve Lexical state

  // ── Persist: debounced write on every store change ───────────────────────
  useEffect(() => {
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      } catch (error) {
        console.warn("DaySlip localStorage write failed", error);
      }
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(saveTimeoutRef.current);
  }, [store]);

  useEffect(() => {
    try {
      localStorage.setItem(RECURRING_STORAGE_KEY, JSON.stringify(recurringItems));
    } catch (error) {
      console.warn("Recurring items localStorage write failed", error);
    }
  }, [recurringItems]);

  // ── Global keyboard shortcut: Ctrl+Alt+J ────────────────────────────────
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.altKey &&
        event.key.toLowerCase() === "j"
      ) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);


  useEffect(() => {
    if (!completionMessage) return;
    const timeout = window.setTimeout(() => setCompletionMessage(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [completionMessage]);

  useEffect(() => {
    const closeMenu = () => setLineContextMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu);
    };
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────

  const yesterdayKey = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return toDayKey(yesterday);
  }, []);

  const yesterdayCarryLines = useMemo(() => {
    const yesterdayData = store[yesterdayKey];
    const allLines = extractLinesFromHtml(yesterdayData?.html ?? "");
    const struck = new Set(yesterdayData?.struckLineIds ?? yesterdayData?.struckLines ?? []);
    const openUnstruck = allLines.filter((line) => !struck.has(line.id));
    const snoozed = (yesterdayData?.resolved ?? [])
      .filter((item) => item.target === "snoozed")
      .map((item) => ({ lineId: item.lineId, text: item.text }));

    const merged = new Map<string, DaySlipLineEntry>();
    openUnstruck.forEach((line) => merged.set(line.id, line));
    snoozed.forEach((line) => {
      if (!line.text.trim()) return;
      merged.set(line.lineId, { id: line.lineId, text: line.text.trim() });
    });

    return Array.from(merged.values());
  }, [store, yesterdayKey]);

  const allLineEntries = useMemo(
    () => extractLinesFromHtml(todayData.html),
    [todayData.html],
  );

  const struckLineIds = useMemo(
    () => todayData.struckLineIds ?? todayData.struckLines ?? [],
    [todayData.struckLineIds, todayData.struckLines],
  );

  const resolvedItems = useMemo<ResolvedItem[]>(
    () =>
      (todayData.resolved ?? []).map((item) => ({
        lineId: item.lineId ?? crypto.randomUUID(),
        text: item.text,
        target: item.target,
      })),
    [todayData.resolved],
  );

  const resolvedByLineId = useMemo(
    () => new Map(resolvedItems.map((item) => [item.lineId, item.target])),
    [resolvedItems],
  );

  // Lines not yet struck = open; used for triage
  const openLines = useMemo(
    () => allLineEntries.filter((entry) => !struckLineIds.includes(entry.id)),
    [allLineEntries, struckLineIds],
  );

  const unresolvedCount = openLines.length;

  const completeButtonLabel =
    resolveMode && unresolvedCount === 0
      ? "✓ Alle zugewiesen – Tag abschließen"
      : "🏁 Tag abschließen";

  const completeButtonHint =
    resolveMode && unresolvedCount > 0
      ? "abbrechen"
      : unresolvedCount > 0
        ? `${unresolvedCount} offen →`
        : "alles erledigt →";

  const triageEntries = useMemo(() => {
    const unresolved = openLines;
    const resolved = allLineEntries.filter((entry) => resolvedByLineId.has(entry.id));
    return [...unresolved, ...resolved];
  }, [allLineEntries, openLines, resolvedByLineId]);

  const archiveDays = useMemo(
    () =>
      Object.keys(store)
        .filter((key) => key !== todayKey)
        .sort((a, b) => b.localeCompare(a)),
    [store, todayKey],
  );

  // ── Strike toggle (dash click) ───────────────────────────────────────────

  const formatTimeStamp = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  };

  const insertStructuredLines = useCallback((lines: string[]) => {
    if (!editorRef.current) {
      setStore((prev) => {
        const day = prev[todayKey] ?? { html: "", plainText: "", struckLineIds: [] };
        const existingLines = extractLinesFromHtml(day.html);
        const extra = lines
          .filter((line) => !parseRuleLine(line).isRule)
          .map((text) => ({ id: crypto.randomUUID(), text }));
        const merged = [...existingLines, ...extra];
        return {
          ...prev,
          [todayKey]: {
            ...day,
            html: merged.map(toParagraphHtml).join(""),
            plainText: merged.map((line) => line.text).join("\n"),
            nodes: undefined,
          },
        };
      });
      return;
    }

    editorRef.current.update(() => {
      const root = $getRoot();
      lines.forEach((line) => {
        const parsed = parseRuleLine(line);
        if (parsed.isRule) {
          const hrNode = parsed.label
            ? $createLabeledHorizontalRuleNode(parsed.label)
            : $createHorizontalRuleNode();
          root.append(hrNode);
          return;
        }
        const paragraph = $createDaySlipLineNode();
        paragraph.append($createTextNode(line));
        root.append(paragraph);
      });
    });
  }, [todayKey]);

  const applyDayTemplate = (template: DayTemplate) => {
    insertStructuredLines(template.lines);
    setShowSettings(false);
  };

  const createFromLine = async (lineText: string, target: "note" | "task") => {
    if (!user?.id || !lineText.trim()) return;
    if (target === "note") {
      await supabase.from("quick_notes").insert({
        user_id: user.id,
        title: lineText,
        content: `Aus Tageszettel (${todayKey})`,
      });
      return;
    }

    if (!currentTenant?.id) return;
    await supabase.from("tasks").insert({
      user_id: user.id,
      tenant_id: currentTenant.id,
      title: lineText,
      description: `Aus Tageszettel (${todayKey})`,
      status: "open",
      priority: "medium",
      category: "allgemein",
    });
  };

  const deleteLine = useCallback((lineId: string) => {
    if (editorRef.current) {
      editorRef.current.update(() => {
        const root = $getRoot();
        root.getChildren().forEach((node) => {
          const maybeLineId = (node as DaySlipLineNode & { __lineId?: string }).__lineId;
          if (maybeLineId === lineId) {
            node.remove();
          }
        });
      });
    }

    setStore((prev) => {
      const day = prev[todayKey];
      if (!day) return prev;
      const lines = extractLinesFromHtml(day.html).filter((line) => line.id !== lineId);
      const lineTimestamps = { ...(day.lineTimestamps ?? {}) };
      delete lineTimestamps[lineId];
      return {
        ...prev,
        [todayKey]: {
          ...day,
          html: lines.map(toParagraphHtml).join(""),
          plainText: lines.map((line) => line.text).join("\n"),
          struckLineIds: (day.struckLineIds ?? day.struckLines ?? []).filter((id) => id !== lineId),
          resolved: (day.resolved ?? []).filter((item) => item.lineId !== lineId),
          lineTimestamps,
        },
      };
    });
  }, [todayKey]);


  // ── Strike
  const toggleStrike = useCallback((lineId: string) => {
    setStore((prev) => {
      const day = prev[todayKey] ?? {
        html: "",
        plainText: "",
        struckLineIds: [],
      };
      const struck = day.struckLineIds ?? day.struckLines ?? [];
      const isStruck = struck.includes(lineId);
      const now = new Date().toISOString();
      const lineTimestamps = { ...(day.lineTimestamps ?? {}) };
      if (!lineTimestamps[lineId]) {
        lineTimestamps[lineId] = { addedAt: now };
      }
      if (isStruck) {
        delete lineTimestamps[lineId].checkedAt;
      } else {
        lineTimestamps[lineId].checkedAt = now;
      }
      return {
        ...prev,
        [todayKey]: {
          ...day,
          struckLineIds: isStruck
            ? struck.filter((l) => l !== lineId)
            : [...struck, lineId],
          lineTimestamps,
        },
      };
    });
  }, [todayKey]);

  // ── Editor change handler (debounced via store effect above) ─────────────

  const onEditorChange = useCallback((editorState: EditorState, editor: LexicalEditor) => {
    editorState.read(() => {
      const plainText = $getRoot().getTextContent();
      const html = $generateHtmlFromNodes(editor, null);
      let nodes: string | undefined;
      try {
        nodes = JSON.stringify(editorState.toJSON());
      } catch {
        nodes = undefined;
      }

      setStore((prev) => {
        const day: DaySlipDayData = prev[todayKey] ?? { html: '', plainText: '', resolved: [], struckLines: [] };
        const currentEntries = extractLinesFromHtml(html);
        const now = new Date().toISOString();
        const lineTimestamps = { ...(day.lineTimestamps ?? {}) };
        currentEntries.forEach((entry) => {
          if (!lineTimestamps[entry.id]) {
            lineTimestamps[entry.id] = { addedAt: now };
          }
        });
        const validLineIds = new Set(currentEntries.map((entry) => entry.id));
        Object.keys(lineTimestamps).forEach((lineId) => {
          if (!validLineIds.has(lineId)) {
            delete lineTimestamps[lineId];
          }
        });

        return {
          ...prev,
          [todayKey]: {
            ...day,
            plainText,
            html,
            nodes,
            lineTimestamps,
          },
        };
      });
    });
  }, [todayKey]);

  const handleEditorReady = useCallback((editor: LexicalEditor) => {
    if (editorRef.current !== editor) {
      editorRef.current = editor;
      setEditorReadyVersion((prev) => prev + 1);
    }
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;
    const struckSet = new Set(struckLineIds);
    requestAnimationFrame(() => {
      const nodes = document.querySelectorAll<HTMLElement>(".day-slip-item");
      nodes.forEach((node) => {
        const lineId = node.dataset.lineId ?? "";
        const text = (node.textContent ?? "").trim();
        const hasText = text.length > 0;
        node.classList.toggle("has-text", hasText);
        const struck = struckSet.has(lineId);
        node.classList.toggle("line-through", struck);
        node.classList.toggle("text-muted-foreground", struck);
        node.classList.toggle("opacity-70", struck);
        const isHighPriority = /^!!\s*/.test(text);
        const isPriority = !isHighPriority && /^!\s*/.test(text);
        node.classList.toggle("bg-red-500/10", isHighPriority);
        node.classList.toggle("border", isHighPriority || isPriority);
        node.classList.toggle("border-red-400/40", isHighPriority);
        node.classList.toggle("bg-amber-400/10", isPriority);
        node.classList.toggle("border-amber-400/40", isPriority);
        const stamp = todayData.lineTimestamps?.[lineId];
        if (stamp) {
          node.title = `Erfasst: ${formatTimeStamp(stamp.addedAt)} · Abgehakt: ${formatTimeStamp(stamp.checkedAt)}`;
        } else {
          node.title = "";
        }
      });
    });
  }, [struckLineIds, todayData.html, todayData.lineTimestamps, open, editorReadyVersion]);

  // ── Panel close / resolve flow ───────────────────────────────────────────

  const animateClosePanel = () => {
    // Flush current store to localStorage immediately to prevent data loss
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch { /* ignore */ }
    clearTimeout(saveTimeoutRef.current);

    setClosing(true);
    setTimeout(() => {
      setResolveMode(false);
      setOpen(false);
      setClosing(false);
      setShowCompletePulse(true);
      setTimeout(() => setShowCompletePulse(false), 500);
    }, 220);
  };

  const persistResolvedItems = async () => {
    if (!user?.id) return;
    const resolved = (store[todayKey]?.resolved ?? []) as ResolvedItem[];
    const exportableItems = resolved.filter(
      (item) => item.target === "note" || item.target === "task" || item.target === "decision"
    );
    
    for (const item of exportableItems) {
      try {
        if (item.target === "note") {
          await supabase.from("quick_notes").insert({
            user_id: user.id,
            title: item.text,
            content: `Aus Tageszettel (${todayKey})`,
          });
        } else if (item.target === "task") {
          if (currentTenant?.id) {
            await supabase.from("tasks").insert({
              user_id: user.id,
              tenant_id: currentTenant.id,
              title: item.text,
              description: `Aus Tageszettel (${todayKey})`,
              status: "open",
              priority: "medium",
              category: "allgemein",
            });
          }
        } else if (item.target === "decision") {
          await supabase.from("task_decisions").insert({
            created_by: user.id,
            title: item.text,
            description: `Aus Tageszettel (${todayKey})`,
            status: "open",
          });
        }
      } catch (err) {
        console.error(`Failed to persist resolved item (${item.target}):`, err);
      }
    }
  };

  const markDayCompleted = async () => {
    if (store[todayKey]?.completedAt) {
      animateClosePanel();
      return;
    }

    await persistResolvedItems();
    const completedAt = new Date().toISOString();
    setStore((prev) => ({
      ...prev,
      [todayKey]: {
        ...(prev[todayKey] ?? { html: "", plainText: "", struckLineIds: [] }),
        completedAt,
      },
    }));
    setCompletionMessage(`✅ Tag abgeschlossen (${new Date(completedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })})`);
    animateClosePanel();
  };

  const handleClose = () => {
    if (unresolvedCount > 0) {
      setResolveMode(true);
      return;
    }
    animateClosePanel();
  };

  const completeDay = () => {
    if (resolveMode && unresolvedCount > 0) {
      setResolveMode(false);
      return;
    }
    if (unresolvedCount > 0) {
      setResolveMode(true);
      return;
    }
    markDayCompleted();
  };


  const syncResolveExport = (
    lineId: string,
    text: string,
    target: ResolveTarget,
    isUndo: boolean,
  ) => {
    if (target === "archived" || target === "snoozed") return;
    try {
      const raw = localStorage.getItem(RESOLVE_EXPORT_KEY);
      const existing = raw ? (JSON.parse(raw) as ResolveExportItem[]) : [];
      const filtered = existing.filter(
        (item) => !(item.sourceDayKey === todayKey && item.lineId === lineId),
      );
      const next = isUndo
        ? filtered
        : [
            ...filtered,
            {
              sourceDayKey: todayKey,
              lineId,
              text,
              target,
              createdAt: new Date().toISOString(),
            },
          ];
      localStorage.setItem(RESOLVE_EXPORT_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn("Resolve export sync failed", error);
    }
  };

  const toggleResolveLine = (
    lineId: string,
    line: string,
    target: ResolveTarget,
  ) => {
    setStore((prev) => {
      const day = prev[todayKey] ?? { html: "", plainText: "", struckLineIds: [] };
      const struck = day.struckLineIds ?? day.struckLines ?? [];
      const resolved = (day.resolved ?? []) as ResolvedItem[];
      const existing = resolved.find((item) => item.lineId === lineId);
      const isUndo = existing?.target === target;
      const nextResolved = isUndo
        ? resolved.filter((item) => item.lineId !== lineId)
        : [
            ...resolved.filter((item) => item.lineId !== lineId),
            { lineId, text: line, target },
          ];

      const nextStruck = isUndo
        ? struck.filter((id) => id !== lineId)
        : struck.includes(lineId)
          ? struck
          : [...struck, lineId];
      const now = new Date().toISOString();
      const lineTimestamps = { ...(day.lineTimestamps ?? {}) };
      if (!lineTimestamps[lineId]) {
        lineTimestamps[lineId] = { addedAt: now };
      }
      if (isUndo) {
        delete lineTimestamps[lineId].checkedAt;
      } else {
        lineTimestamps[lineId].checkedAt = now;
      }

      syncResolveExport(lineId, line, target, isUndo);

      return {
        ...prev,
        [todayKey]: {
          ...day,
          struckLineIds: nextStruck,
          resolved: nextResolved,
          lineTimestamps,
        },
      };
    });
  };

  const [carriedOver, setCarriedOver] = useState(false);
  const [weekPlanInjected, setWeekPlanInjected] = useState(false);

  const carryOverFromYesterday = () => {
    if (yesterdayCarryLines.length === 0) return;
    const linesToAppend = yesterdayCarryLines.map((line) => line.text);
    appendLinesToToday(linesToAppend);
    setCarriedOver(true);
  };

  const appendLinesToToday = useCallback((lines: string[]) => {
    const normalizedLines = lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (normalizedLines.length === 0) return;

    if (editorRef.current) {
      editorRef.current.update(() => {
        const root = $getRoot();
        const existing = new Set(
          root
            .getChildren()
            .map((node) => normalizeLineText(node.getTextContent()))
            .filter((line) => line.length > 0),
        );

        normalizedLines.forEach((line) => {
          const normalized = normalizeLineText(line);
          if (!normalized || existing.has(normalized)) return;
          const paragraph = $createDaySlipLineNode();
          paragraph.append($createTextNode(line));
          root.append(paragraph);
          existing.add(normalized);
        });
      });

      return;
    }

    setStore((prev) => {
      const day = prev[todayKey] ?? { html: "", plainText: "", nodes: "", struckLineIds: [] };
      const existingLines = extractLinesFromHtml(day.html);
      const existingTexts = new Set(existingLines.map((line) => normalizeLineText(line.text)));
      const toAppend = normalizedLines
        .filter((line) => !existingTexts.has(normalizeLineText(line)))
        .map((text) => ({ id: crypto.randomUUID(), text }));
      if (toAppend.length === 0) return prev;
      const merged = [...existingLines, ...toAppend];
      return {
        ...prev,
        [todayKey]: {
          ...day,
          html: merged.map(toParagraphHtml).join(""),
          plainText: merged.map((entry) => entry.text).join("\n"),
          nodes: undefined,
        },
      };
    });
  }, [todayKey]);

  const handleDropToDaySlip = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const droppedTaskTitle = event.dataTransfer.getData("application/x-mywork-task-title").trim();
    const droppedTaskId = event.dataTransfer.getData("application/x-mywork-task-id").trim();
    const droppedPlainText = event.dataTransfer.getData("text/plain").trim();
    const rawValue = droppedTaskTitle || droppedPlainText;
    if (!rawValue) return;

    const withTaskIcon = droppedTaskTitle && !rawValue.startsWith("✅")
      ? `✅ ${rawValue}`
      : rawValue;

    // If we have a task ID, insert directly with linkedTaskId
    if (droppedTaskId && editorRef.current) {
      editorRef.current.update(() => {
        const root = $getRoot();
        const existing = new Set(
          root.getChildren()
            .map((node) => normalizeLineText(node.getTextContent()))
            .filter((l) => l.length > 0),
        );
        const normalized = normalizeLineText(withTaskIcon);
        if (!normalized || existing.has(normalized)) return;
        const paragraph = $createDaySlipLineNode(undefined, droppedTaskId);
        paragraph.append($createTextNode(withTaskIcon));
        root.append(paragraph);
      });
    } else {
      appendLinesToToday([withTaskIcon]);
    }

    setOpen(true);
    setResolveMode(false);
    setShowArchive(false);
    setShowSettings(false);
  }, [appendLinesToToday]);

  const addRecurringItem = () => {
    const value = recurringDraft.trim();
    if (!value) return;
    setRecurringItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: value, weekday: recurringDraftWeekday },
    ]);
    setRecurringDraft("");
    setRecurringDraftWeekday("all");
  };

  const removeRecurringItem = (index: number) => {
    setRecurringItems((prev) => prev.filter((_, idx) => idx !== index));
    if (recurringEditIndex === index) {
      setRecurringEditIndex(null);
      setRecurringEditDraft("");
    }
  };

  const startEditRecurringItem = (index: number) => {
    setRecurringEditIndex(index);
    setRecurringEditDraft(recurringItems[index]?.text ?? "");
  };

  const saveEditRecurringItem = () => {
    if (recurringEditIndex === null) return;
    const value = recurringEditDraft.trim();
    if (!value) return;
    setRecurringItems((prev) =>
      prev.map((item, idx) =>
        idx === recurringEditIndex ? { ...item, text: value } : item,
      ),
    );
    setRecurringEditIndex(null);
    setRecurringEditDraft("");
  };

  useEffect(() => {
    const todayWeekday = weekdayKey(new Date());
    const recurringForToday = recurringItems
      .filter((item) => item.weekday === "all" || item.weekday === todayWeekday)
      .map((item) => item.text);
    if (todayData.html.trim() || recurringForToday.length === 0 || todayData.recurringInjected) return;
    setStore((prev) => {
      const day = prev[todayKey] ?? { html: "", plainText: "" };
      if (day.html.trim() || day.recurringInjected) return prev;
      const entries = recurringForToday.map((text) => ({ id: crypto.randomUUID(), text }));
      const html = entries.map(toParagraphHtml).join("");
      return {
        ...prev,
        [todayKey]: {
          ...day,
          html,
          plainText: recurringForToday.join("\n"),
          nodes: undefined,
          recurringInjected: true,
        },
      };
    });
  }, [todayData.html, todayData.recurringInjected, recurringItems, todayKey]);

  // ── Week plan injection ─────────────────────────────────────────────────
  useEffect(() => {
    if (weekPlanInjected) return;
    const planned = getWeekPlanForDay(todayKey);
    if (!planned || planned.length === 0) return;
    setWeekPlanInjected(true);
    appendLinesToToday(planned);
  }, [todayKey, weekPlanInjected, appendLinesToToday]);

  const handleApplyWeekPlan = useCallback((days: Record<string, string[]>) => {
    // Inject today's items immediately
    const todayItems = days[todayKey];
    if (todayItems && todayItems.length > 0) {
      appendLinesToToday(todayItems);
    }
    setWeekPlanInjected(true);
  }, [todayKey, appendLinesToToday]);

  const handleChangeRecurringWeekday = useCallback((id: string, newWeekday: string) => {
    setRecurringItems((prev) =>
      prev.map((item) => item.id === id ? { ...item, weekday: newWeekday as (typeof weekDays)[number] } : item)
    );
  }, []);

  const switchView = (view: "settings" | "archive" | "default") => {
    setContentTransitioning(true);
    requestAnimationFrame(() => {
      setShowSettings(view === "settings");
      setShowArchive(view === "archive");
      setTimeout(() => setContentTransitioning(false), 360);
    });
  };

  // ── Click handler attached to editor container ───────────────────────────
  //
  // We intercept clicks on the `::before` pseudo-element (the dash) by
  // checking if the click landed in the left 24 px of a .day-slip-item.
  // Pseudo-elements cannot be directly targeted in JS, but their rendered
  // box is within the element's padding area which we can measure.
  //
  const handleEditorClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const item = target.closest(".day-slip-item") as HTMLElement | null;
    if (!item) return;

    const rect = item.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    // The dash occupies roughly 0–24 px (pl-6 = 1.5rem ≈ 24px)
    if (clickX > 24) return;

    const lineText = (item.textContent ?? "").trim();
    if (!lineText || isRuleLine(lineText)) return;
    const lineId = item.dataset.lineId;
    if (!lineId) return;
    toggleStrike(lineId);
  }, [toggleStrike]);

  const handleEditorContextMenu = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const item = target.closest(".day-slip-item") as HTMLElement | null;
    if (!item) return;
    const lineId = item.dataset.lineId;
    const text = (item.textContent ?? "").trim();
    if (!lineId || !text || isRuleLine(text)) return;
    e.preventDefault();
    setLineContextMenu({ x: e.clientX, y: e.clientY, lineId, text });
  }, []);

  // ── Lexical config ────────────────────────────────────────────────────────

  const editorConfig = useMemo(() => ({
    namespace: "DaySlipEditor",
    theme: editorTheme,
    nodes: [
      HorizontalRuleNode,
      LabeledHorizontalRuleNode,
      DaySlipLineNode,
      {
        replace: ParagraphNode,
        with: () => $createDaySlipLineNode(),
      },
    ],
    onError: (error: Error) => console.error("DaySlip Lexical error", error),
  }), []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Floating panel ── */}
      {open && (
        <aside
          className={`fixed bottom-24 right-6 z-50 flex h-[min(84vh,920px)] w-[calc(100vw-1rem)] sm:w-[min(24rem,calc(100vw-2rem))] lg:w-[min(35rem,calc(100vw-3rem))] max-w-[calc(100vw-1rem)] flex-col rounded-2xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur transition-all duration-300 ease-out ${closing ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100"}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDropToDaySlip}
        >

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold">
                <ClipboardPen className="h-5 w-5" /> Tageszettel
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(todayKey)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => switchView(showSettings ? "default" : "settings")}
                aria-label="Einstellungen anzeigen"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => switchView(showArchive ? "default" : "archive")}
                aria-label="Archiv anzeigen"
              >
                <Folder className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={animateClosePanel}
                aria-label="Panel schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Archive view ── */}
          {showSettings ? (
            <div className={`flex-1 space-y-4 overflow-y-auto p-4 transition-all duration-300 ease-out ${contentTransitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}>
              <div>
                <p className="text-sm font-medium">Einstellungen</p>
                <p className="text-xs text-muted-foreground">Wiederkehrende Punkte verwalten</p>
              </div>
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Wiederkehrende Punkte
                </p>
                <div className="mb-2 flex flex-wrap gap-1">
                  {weekDays.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setRecurringDraftWeekday(day)}
                      className={`rounded border px-2 py-0.5 text-[11px] transition-colors ${recurringDraftWeekday === day ? "border-primary/60 bg-primary/15 text-primary" : "border-border/60 hover:bg-muted"}`}
                    >
                      {weekDayLabels[day]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={recurringDraft}
                    onChange={(e) => setRecurringDraft(e.target.value)}
                    placeholder="z. B. Inbox prüfen"
                    className="h-8 flex-1 rounded border border-border/60 bg-background px-2 text-xs"
                  />
                  <button type="button" onClick={addRecurringItem} className="rounded border border-border/60 px-2 text-xs hover:bg-muted">
                    Hinzufügen
                  </button>
              </div>
              <WeeklyRoutineGrid
                recurringItems={recurringItems}
                onChangeWeekday={handleChangeRecurringWeekday}
              />

                <div className="space-y-2">
                  {recurringItems.length === 0 && (
                    <p className="text-xs text-muted-foreground">Noch keine wiederkehrenden Punkte gespeichert.</p>
                  )}
                  {recurringItems.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2 rounded border border-border/50 px-2 py-1.5 text-xs">
                      {recurringEditIndex === index ? (
                        <>
                          <input
                            value={recurringEditDraft}
                            onChange={(e) => setRecurringEditDraft(e.target.value)}
                            className="h-7 flex-1 rounded border border-border/60 bg-background px-2 text-xs"
                          />
                          <button type="button" className="rounded border border-border/60 px-2 py-1 hover:bg-muted" onClick={saveEditRecurringItem}>
                            Speichern
                          </button>
                          <button type="button" className="rounded border border-border/60 px-2 py-1 hover:bg-muted" onClick={() => setRecurringEditIndex(null)}>
                            Abbrechen
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1">{item.text}</span>
                          <span className="rounded border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {weekDayLabels[item.weekday]}
                          </span>
                          <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => startEditRecurringItem(index)} aria-label="Wiederkehrenden Punkt bearbeiten">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" className="rounded p-1 text-red-300 hover:bg-red-500/10" onClick={() => removeRecurringItem(index)} aria-label="Wiederkehrenden Punkt löschen">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tagesvorlagen
                </p>
                <p className="text-xs text-muted-foreground">Fügt vordefinierte Blöcke inkl. HR-Trennlinien ein.</p>
                <div className="space-y-1.5">
                  {dayTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className="w-full rounded border border-border/60 px-2 py-1.5 text-left text-xs hover:bg-muted"
                      onClick={() => applyDayTemplate(template)}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : showArchive ? (
            <div className={`flex-1 space-y-3 overflow-y-auto p-4 transition-all duration-300 ease-out ${contentTransitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}>
              <p className="text-sm font-medium">Archiv (nur lesen)</p>
              {archiveDays.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Noch keine vergangenen Tage.
                </p>
              )}
              {archiveDays.map((day) => {
                const dayData = store[day];
                const lines = extractLinesFromHtml(dayData?.html ?? "");
                const struck = new Set(dayData?.struckLineIds ?? dayData?.struckLines ?? []);
                const resolved = dayData?.resolved ?? [];
                const unresolved = lines.filter((line) => !struck.has(line.id)).length;
                const completedInfo = dayData?.completedAt
                  ? `Abgeschlossen um ${new Date(dayData.completedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
                  : "Nicht explizit abgeschlossen";
                const moodMap = ["😞", "🙁", "😐", "🙂", "😄"] as const;
                const mood = dayData?.dayMood ? moodMap[dayData.dayMood - 1] : "—";

                return (
                  <div
                    key={day}
                    className="rounded-lg border border-border/60 p-3"
                  >
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {formatDate(day)}
                    </p>
                    <p className="mb-2 text-[11px] text-muted-foreground/90">
                      {completedInfo} · {resolved.length} zugewiesen · {unresolved} offen geblieben · Stimmung: {mood}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {stripHtml(dayData?.html ?? "") || "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`flex min-h-0 flex-1 flex-col transition-all duration-300 ease-out ${contentTransitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}>
              {/* ── Week planning banner ── */}
              <WeekPlanningBanner
                recurringItems={recurringItems}
                onApplyPlan={handleApplyWeekPlan}
              />
              {/* ── Yesterday banner ── */}
              {yesterdayCarryLines.length > 0 && !carriedOver && (
                <div className={`border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-sm text-amber-900 transition-all duration-200 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200 ${contentTransitioning ? "opacity-0" : "opacity-100"}`}>
                  <span className="font-semibold">Gestern noch offen:</span>{" "}
                  &ldquo;{yesterdayCarryLines[0].text}&rdquo;
                  {yesterdayCarryLines.length > 1
                    ? ` +${yesterdayCarryLines.length - 1}`
                    : ""}
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-100/80">
                    <span>Es werden offene und gesnoozte Punkte von gestern angeboten.</span>
                    <button
                      type="button"
                      className="rounded border border-amber-300/80 px-2 py-0.5 hover:bg-amber-100 dark:border-amber-300/40 dark:hover:bg-amber-400/10"
                      onClick={carryOverFromYesterday}
                    >
                      In heute übernehmen
                    </button>
                  </div>
                </div>
              )}

              {/* ── Editor OR Triage ── */}
              <DaySlipEditor
                key={todayKey}
                hidden={resolveMode && triageEntries.length > 0}
                initialHtml={todayData.html}
                initialNodes={todayData.nodes}
                dayKey={todayKey}
                resolveMode={resolveMode}
                editorConfig={editorConfig}
                onEditorChange={onEditorChange}
                onEditorReady={handleEditorReady}
                onEditorClick={handleEditorClick}
                onEditorContextMenu={handleEditorContextMenu}
                onDrop={handleDropToDaySlip}
              />
              {resolveMode && triageEntries.length > 0 && (
                /* Triage view – replaces editor completely */
                <div className="flex-1 border-b border-border/60">
                  <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                    <p className="text-sm font-medium">
                      {unresolvedCount > 0
                        ? `${unresolvedCount} ${unresolvedCount === 1 ? "Eintrag" : "Einträge"} noch offen – was soll damit passieren?`
                        : "Alle Einträge sind zugewiesen. Du kannst den Tag jetzt abschließen."}
                    </p>
                  </div>
                  <div className="h-full space-y-2 overflow-y-auto p-4">
                    {unresolvedCount === 0 && (
                      <p className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                        ✓ Alle offenen Punkte wurden zugewiesen. Mit dem Button unten wird der Tag abgeschlossen.
                      </p>
                    )}
                    {triageEntries.map(({ id, text }) => {
                      const activeTarget = resolvedByLineId.get(id);
                      const buttonClass = (target: ResolveTarget) =>
                        `rounded p-1 transition-colors ${activeTarget === target ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/50" : "hover:bg-muted"}`;
                      const stamp = todayData.lineTimestamps?.[id];
                      const isHighPriority = /^!!\s*/.test(text);
                      const isPriority = !isHighPriority && /^!\s*/.test(text);

                      return (
                      <div
                        key={id}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-sm",
                          isHighPriority && "bg-red-500/10 border-red-400/40",
                          isPriority && "bg-amber-400/10 border-amber-400/40",
                        )}
                      >
                        <div className="flex flex-1 flex-col">
                          <span className="line-clamp-1">{text}</span>
                          <span className="text-[10px] text-muted-foreground">Erfasst {formatTimeStamp(stamp?.addedAt)} · Abgehakt {formatTimeStamp(stamp?.checkedAt)}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            title="Als Notiz"
                            className={buttonClass("note")}
                            onClick={() => toggleResolveLine(id, text, "note")}
                          >
                            <NotebookPen className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Als Aufgabe"
                            className={buttonClass("task")}
                            onClick={() => toggleResolveLine(id, text, "task")}
                          >
                            <ListTodo className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Als Entscheidung"
                            className={buttonClass("decision")}
                            onClick={() => toggleResolveLine(id, text, "decision")}
                          >
                            <Scale className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Snoozen"
                            className={buttonClass("snoozed")}
                            onClick={() => toggleResolveLine(id, text, "snoozed")}
                          >
                            <Clock3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Archivieren"
                            className={buttonClass("archived")}
                            onClick={() => toggleResolveLine(id, text, "archived")}
                          >
                            <FolderArchive className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Footer ── */}
              <div className="space-y-2 p-3">
              {resolveMode && (
                <div className="rounded-lg border border-border/60 px-3 py-2">
                  <p className="mb-1 text-[11px] text-muted-foreground">Wie war dein Tag?</p>
                  <div className="flex items-center justify-between">
                    {["😞", "🙁", "😐", "🙂", "😄"].map((mood, index) => (
                      <button
                        key={mood}
                        type="button"
                        className={cn(
                          "rounded px-1.5 py-1 text-lg transition hover:bg-muted",
                          todayData.dayMood === (index + 1) ? "bg-emerald-500/20 ring-1 ring-emerald-400/50" : "opacity-70",
                        )}
                        onClick={() =>
                          setStore((prev) => ({
                            ...prev,
                            [todayKey]: {
                              ...(prev[todayKey] ?? { html: "", plainText: "", struckLineIds: [] }),
                              dayMood: (index + 1) as 1 | 2 | 3 | 4 | 5,
                            },
                          }))
                        }
                      >
                        {mood}
                      </button>
                    ))}
                  </div>
                </div>
              )}
                <button
                  type="button"
                  onClick={completeDay}
                  className="flex h-10 w-full items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-medium text-emerald-800 dark:border-emerald-300/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                >
                  <span>{completeButtonLabel}</span>
                  <span className="text-xs opacity-70">{completeButtonHint}</span>
                </button>
              </div>
            </div>
          )}
        </aside>
      )}

      {lineContextMenu && (
        <div
          className="fixed z-[70] min-w-44 rounded-md border border-border bg-popover p-1 shadow-xl"
          style={{ left: lineContextMenu.x, top: lineContextMenu.y }}
        >
          <button className="flex w-full rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={async () => { await createFromLine(lineContextMenu.text, "task"); setLineContextMenu(null); }}>
            Als Aufgabe erstellen
          </button>
          <button className="flex w-full rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={async () => { await createFromLine(lineContextMenu.text, "note"); setLineContextMenu(null); }}>
            Als Notiz speichern
          </button>
          <button className="flex w-full rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => { toggleResolveLine(lineContextMenu.lineId, lineContextMenu.text, "snoozed"); setLineContextMenu(null); }}>
            Snoozen
          </button>
          <button className="flex w-full rounded px-2 py-1 text-left text-sm text-red-300 hover:bg-red-500/10" onClick={() => { deleteLine(lineContextMenu.lineId); setLineContextMenu(null); }}>
            Löschen
          </button>
        </div>
      )}

      {completionMessage && (
        <div className="fixed bottom-24 right-6 z-50 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 shadow-lg backdrop-blur dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-100">
          {completionMessage}
        </div>
      )}

      {/* ── Trigger button ── */}
      <button
        type="button"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/90 shadow-lg backdrop-blur hover:bg-muted"
        aria-label="Tageszettel öffnen (Strg+Alt+J)"
        onClick={() => setOpen((prev) => !prev)}
      >
        {showCompletePulse ? <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-300" /> : <ClipboardPen className="h-5 w-5" />}
        {unresolvedCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold text-white">
            {unresolvedCount}
          </span>
        )}
      </button>
    </>
  );
}
