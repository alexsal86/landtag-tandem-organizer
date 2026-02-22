import { useEffect, useMemo, useRef, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  type EditorState,
  type LexicalEditor,
  KEY_ENTER_COMMAND,
  ParagraphNode,
} from "lexical";
import {
  $createHorizontalRuleNode,
  HorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import {
  ClipboardPen,
  Folder,
  FolderArchive,
  ListTodo,
  NotebookPen,
  Scale,
  Settings,
  X,
  Clock3,
} from "lucide-react";
import FloatingTextFormatToolbar from "@/components/FloatingTextFormatToolbar";
import { DaySlipLineNode, $createDaySlipLineNode } from "@/components/DaySlipLineNode";

// ─── Types ───────────────────────────────────────────────────────────────────

type ResolveTarget = "note" | "task" | "decision" | "archived" | "snoozed";

interface DaySlipDayData {
  html: string;
  plainText: string;
  nodes?: string;
  struckLines?: string[]; // deprecated legacy fallback (read-only)
  struckLineIds?: string[];
  resolved?: Array<{ lineId: string; text: string; target: ResolveTarget }>;
}

type ResolvedItem = { lineId: string; text: string; target: ResolveTarget };

type DaySlipStore = Record<string, DaySlipDayData>;

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "day-slip-v2";
const RECURRING_STORAGE_KEY = "day-slip-recurring-v2";
const RESOLVE_EXPORT_KEY = "day-slip-resolve-export-v1";
const SAVE_DEBOUNCE_MS = 400;

// ─── Helpers ─────────────────────────────────────────────────────────────────


type DaySlipLineEntry = { id: string; text: string };
type RecurringByWeekday = Record<string, string[]>;
type ResolveExportItem = {
  sourceDayKey: string;
  lineId: string;
  text: string;
  target: Exclude<ResolveTarget, "archived" | "snoozed">;
  createdAt: string;
};

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
    .filter((line) => line.text.length > 0 && !/^-{3,}$/.test(normalizeRuleMarker(line.text)));
};

const normalizeRuleMarker = (text: string) =>
  text.replace(/[‐‑‒–—―−]/g, "-").replace(/\s+/g, "").trim();

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
        } catch {
          // fall through to HTML path
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

        let handled = false;

        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const topLevel =
            selection.anchor.getNode().getTopLevelElementOrThrow();
          const text = topLevel.getTextContent().trim();

          if (/^-{3,}$/.test(normalizeRuleMarker(text))) {
            const hr = $createHorizontalRuleNode();
            const newParagraph = $createDaySlipLineNode();
            topLevel.insertBefore(hr);
            topLevel.replace(newParagraph);
            newParagraph.select();
            handled = true;
            return;
          }

          const newParagraph = $createDaySlipLineNode();
          newParagraph.append($createTextNode(""));
          topLevel.insertAfter(newParagraph);
          newParagraph.select();
          handled = true;
        });

        if (handled) {
          event?.preventDefault();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  return null;
}

function EditorEditablePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);

  return null;
}

// ─── Lexical editor theme ─────────────────────────────────────────────────────
//
// The `—` before each paragraph is the interactive strike toggle.
// It is always visible (no opacity trick) so users immediately understand
// it is clickable. The cursor changes to `pointer` on hover as affordance.
// Struck lines get `line-through` via the `.struck` class toggled in JS.
//
const editorTheme = {
  paragraph:
    "day-slip-item group relative mb-0 pl-7 " +
    // The dash – always visible, pointer cursor
    "before:absolute before:left-0 before:top-[2px] " +
    "before:content-['—'] before:text-muted-foreground " +
    "before:cursor-pointer before:select-none " +
    "before:rounded before:px-1 before:border before:border-transparent " +
    "before:transition-colors transition-all duration-200 " +
    "hover:before:border-border/70 hover:before:bg-muted/40 hover:before:shadow-sm",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
  },
  horizontalRule: "my-3 border-border/80",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function GlobalDaySlipPanel() {
  const [open, setOpen] = useState(true);
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
  const [recurringDraft, setRecurringDraft] = useState("");
  const [recurringEditIndex, setRecurringEditIndex] = useState<number | null>(null);
  const [recurringEditDraft, setRecurringEditDraft] = useState("");
  const [selectedRecurringWeekday, setSelectedRecurringWeekday] = useState<(typeof weekDays)[number]>("all");
  const [recurringItemsByWeekday, setRecurringItemsByWeekday] = useState<RecurringByWeekday>(() => {
    try {
      const raw = localStorage.getItem(RECURRING_STORAGE_KEY);
      if (!raw) return Object.fromEntries(weekDays.map((day) => [day, []])) as RecurringByWeekday;
      const parsed = JSON.parse(raw) as string[] | RecurringByWeekday;
      if (Array.isArray(parsed)) {
        return {
          all: parsed,
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: [],
          saturday: [],
          sunday: [],
        };
      }
      return {
        all: parsed.all ?? [],
        monday: parsed.monday ?? [],
        tuesday: parsed.tuesday ?? [],
        wednesday: parsed.wednesday ?? [],
        thursday: parsed.thursday ?? [],
        friday: parsed.friday ?? [],
        saturday: parsed.saturday ?? [],
        sunday: parsed.sunday ?? [],
      };
    } catch {
      return Object.fromEntries(weekDays.map((day) => [day, []])) as RecurringByWeekday;
    }
  });

  const editorRef = useRef<LexicalEditor | null>(null);

  // Debounce ref for localStorage writes
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const todayKey = toDayKey(new Date());
  const todayData = store[todayKey] ?? {
    html: "",
    plainText: "",
    nodes: "",
    struckLines: [],
  };

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
      localStorage.setItem(RECURRING_STORAGE_KEY, JSON.stringify(recurringItemsByWeekday));
    } catch (error) {
      console.warn("Recurring items localStorage write failed", error);
    }
  }, [recurringItemsByWeekday]);

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

  // ── Derived data ─────────────────────────────────────────────────────────

  const yesterdayOpenLines = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const key = toDayKey(yesterday);
    const allLines = extractLinesFromHtml(store[key]?.html ?? "");
    const struck = store[key]?.struckLineIds ?? store[key]?.struckLines ?? [];
    return allLines.filter((line) => !struck.includes(line.id));
  }, [store]);

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

  const currentRecurringItems =
    recurringItemsByWeekday[selectedRecurringWeekday] ?? [];

  // ── Strike toggle (dash click) ───────────────────────────────────────────

  const toggleStrike = (lineId: string) => {
    setStore((prev) => {
      const day = prev[todayKey] ?? {
        html: "",
        plainText: "",
        struckLineIds: [],
      };
      const struck = day.struckLineIds ?? day.struckLines ?? [];
      const isStruck = struck.includes(lineId);
      return {
        ...prev,
        [todayKey]: {
          ...day,
          struckLineIds: isStruck
            ? struck.filter((l) => l !== lineId)
            : [...struck, lineId],
        },
      };
    });
  };

  // ── Editor change handler (debounced via store effect above) ─────────────

  const onEditorChange = (editorState: EditorState, editor: LexicalEditor) => {
    editorState.read(() => {
      const plainText = $getRoot().getTextContent();
      const html = $generateHtmlFromNodes(editor, null);
      let nodes: string | undefined;
      try {
        nodes = JSON.stringify(editorState.toJSON());
      } catch {
        nodes = undefined;
      }

      setStore((prev) => ({
        ...prev,
        [todayKey]: {
          ...(prev[todayKey] ?? { resolved: [], struckLines: [] }),
          plainText,
          html,
          nodes,
        },
      }));
    });
  };

  useEffect(() => {
    if (!editorRef.current) return;
    const struckSet = new Set(struckLineIds);
    requestAnimationFrame(() => {
      const nodes = document.querySelectorAll<HTMLElement>(".day-slip-item");
      nodes.forEach((node) => {
        const lineId = node.dataset.lineId ?? "";
        const struck = struckSet.has(lineId);
        node.classList.toggle("line-through", struck);
        node.classList.toggle("text-muted-foreground", struck);
        node.classList.toggle("opacity-70", struck);
      });
    });
  }, [struckLineIds, todayData.html]);

  // ── Panel close / resolve flow ───────────────────────────────────────────

  const handleClose = () => {
    if (unresolvedCount > 0) {
      setResolveMode(true);
    } else {
      setClosing(true);
      setTimeout(() => {
        setResolveMode(false);
        setOpen(false);
        setClosing(false);
      }, 220);
    }
  };

  const completeDay = () => {
    if (resolveMode) {
      setResolveMode(false);
      return;
    }
    if (unresolvedCount > 0) {
      setResolveMode(true);
      return;
    }
    setClosing(true);
    setTimeout(() => {
      setResolveMode(false);
      setOpen(false);
      setClosing(false);
    }, 220);
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

      syncResolveExport(lineId, line, target, isUndo);

      return {
        ...prev,
        [todayKey]: {
          ...day,
          struckLineIds: nextStruck,
          resolved: nextResolved,
        },
      };
    });
  };

  const carryOverFromYesterday = () => {
    if (yesterdayOpenLines.length === 0) return;
    setStore((prev) => {
      const day = prev[todayKey] ?? { html: "", plainText: "", nodes: "", struckLineIds: [] };
      const existingLines = extractLinesFromHtml(day.html);
      const existingIds = new Set(existingLines.map((line) => line.id));
      const toAppend = yesterdayOpenLines.filter((line) => !existingIds.has(line.id));
      if (toAppend.length === 0) return prev;
      const merged = [...existingLines, ...toAppend];
      const appended = merged.map(toParagraphHtml).join("");
      return {
        ...prev,
        [todayKey]: {
          ...day,
          html: appended,
          plainText: merged.map((line) => line.text).join("\n"),
          nodes: undefined,
        },
      };
    });
  };

  const addRecurringItem = () => {
    const value = recurringDraft.trim();
    if (!value) return;
    setRecurringItemsByWeekday((prev) => ({
      ...prev,
      [selectedRecurringWeekday]: prev[selectedRecurringWeekday].includes(value)
        ? prev[selectedRecurringWeekday]
        : [...prev[selectedRecurringWeekday], value],
    }));
    setRecurringDraft("");
  };

  const removeRecurringItem = (index: number) => {
    setRecurringItemsByWeekday((prev) => ({
      ...prev,
      [selectedRecurringWeekday]: prev[selectedRecurringWeekday].filter((_, idx) => idx !== index),
    }));
    if (recurringEditIndex === index) {
      setRecurringEditIndex(null);
      setRecurringEditDraft("");
    }
  };

  const startEditRecurringItem = (index: number) => {
    setRecurringEditIndex(index);
    setRecurringEditDraft(recurringItemsByWeekday[selectedRecurringWeekday][index] ?? "");
  };

  const saveEditRecurringItem = () => {
    if (recurringEditIndex === null) return;
    const value = recurringEditDraft.trim();
    if (!value) return;
    setRecurringItemsByWeekday((prev) => ({
      ...prev,
      [selectedRecurringWeekday]: prev[selectedRecurringWeekday].map((item, idx) =>
        idx === recurringEditIndex ? value : item,
      ),
    }));
    setRecurringEditIndex(null);
    setRecurringEditDraft("");
  };

  useEffect(() => {
    const weekdayRecurring = recurringItemsByWeekday[weekdayKey(new Date())] ?? [];
    const recurringItems = [...(recurringItemsByWeekday.all ?? []), ...weekdayRecurring];
    if (todayData.html.trim() || recurringItems.length === 0) return;
    setStore((prev) => {
      const day = prev[todayKey] ?? { html: "", plainText: "" };
      if (day.html.trim()) return prev;
      const entries = recurringItems.map((text) => ({ id: crypto.randomUUID(), text }));
      const html = entries.map(toParagraphHtml).join("");
      return {
        ...prev,
        [todayKey]: {
          ...day,
          html,
          plainText: recurringItems.join("\n"),
          nodes: undefined,
        },
      };
    });
  }, [todayData.html, recurringItemsByWeekday, todayKey]);

  // ── Click handler attached to editor container ───────────────────────────
  //
  // We intercept clicks on the `::before` pseudo-element (the dash) by
  // checking if the click landed in the left 28 px of a .day-slip-item.
  // Pseudo-elements cannot be directly targeted in JS, but their rendered
  // box is within the element's padding area which we can measure.
  //
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const item = target.closest(".day-slip-item") as HTMLElement | null;
    if (!item) return;

    const rect = item.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    // The dash occupies roughly 0–28 px (pl-7 = 1.75rem ≈ 28px)
    if (clickX > 28) return;

    const lineText = (item.textContent ?? "").trim();
    if (!lineText || /^-{3,}$/.test(normalizeRuleMarker(lineText))) return;
    const lineId = item.dataset.lineId;
    if (!lineId) return;
    toggleStrike(lineId);
  };

  // ── Lexical config ────────────────────────────────────────────────────────

  const editorConfig = useMemo(() => ({
    namespace: "DaySlipEditor",
    theme: editorTheme,
    nodes: [
      HorizontalRuleNode,
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
        <aside className={`fixed bottom-24 right-6 z-50 w-[520px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur transition-all duration-200 ${closing ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100"}`}>

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
                onClick={() => {
                  setShowSettings((prev) => !prev);
                  setShowArchive(false);
                }}
                aria-label="Einstellungen anzeigen"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => {
                  setShowArchive((prev) => !prev);
                  setShowSettings(false);
                }}
                aria-label="Archiv anzeigen"
              >
                <Folder className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={handleClose}
                aria-label="Panel schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Archive view ── */}
          {showSettings ? (
            <div className="max-h-[560px] space-y-4 overflow-y-auto p-4">
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
                      onClick={() => setSelectedRecurringWeekday(day)}
                      className={`rounded border px-2 py-0.5 text-[11px] ${selectedRecurringWeekday === day ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100" : "border-border/60 hover:bg-muted"}`}
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

                <div className="space-y-2">
                  {currentRecurringItems.length === 0 && (
                    <p className="text-xs text-muted-foreground">Noch keine wiederkehrenden Punkte gespeichert.</p>
                  )}
                  {currentRecurringItems.map((item, index) => (
                    <div key={`${item}-${index}`} className="flex items-center gap-2 rounded border border-border/50 px-2 py-1.5 text-xs">
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
                          <span className="flex-1">{item}</span>
                          <button type="button" className="rounded border border-border/60 px-2 py-1 hover:bg-muted" onClick={() => startEditRecurringItem(index)}>
                            Bearbeiten
                          </button>
                          <button type="button" className="rounded border border-red-300/60 px-2 py-1 text-red-300 hover:bg-red-500/10" onClick={() => removeRecurringItem(index)}>
                            Löschen
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : showArchive ? (
            <div className="max-h-[560px] space-y-3 overflow-y-auto p-4">
              <p className="text-sm font-medium">Archiv (nur lesen)</p>
              {archiveDays.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Noch keine vergangenen Tage.
                </p>
              )}
              {archiveDays.map((day) => (
                <div
                  key={day}
                  className="rounded-lg border border-border/60 p-3"
                >
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {formatDate(day)}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {stripHtml(store[day]?.html ?? "") || "—"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* ── Yesterday banner ── */}
              {yesterdayOpenLines.length > 0 && (
                <div className="border-b border-amber-400/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
                  <span className="font-semibold">Gestern noch offen:</span>{" "}
                  &ldquo;{yesterdayOpenLines[0].text}&rdquo;
                  {yesterdayOpenLines.length > 1
                    ? ` +${yesterdayOpenLines.length - 1}`
                    : ""}
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-amber-100/80">
                    <span>Es werden bewusst nur offene Punkte von gestern angezeigt.</span>
                    <button
                      type="button"
                      className="rounded border border-amber-300/40 px-2 py-0.5 hover:bg-amber-400/10"
                      onClick={carryOverFromYesterday}
                    >
                      In heute übernehmen
                    </button>
                  </div>
                </div>
              )}

              <div className="border-b border-border/60 px-4 py-2">
                <p className="mb-1 text-xs text-muted-foreground">Wiederkehrende Punkte</p>
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
              </div>

              {/* ── Editor OR Triage ── */}
              {resolveMode && unresolvedCount > 0 ? (
                /* Triage view – replaces editor completely */
                <div className="border-b border-border/60">
                  <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                    <p className="text-sm font-medium">
                      {unresolvedCount}{" "}
                      {unresolvedCount === 1 ? "Eintrag" : "Einträge"} noch
                      offen – was soll damit passieren?
                    </p>
                  </div>
                  <div className="max-h-[460px] space-y-2 overflow-y-auto p-4">
                    {triageEntries.map(({ id, text }) => {
                      const activeTarget = resolvedByLineId.get(id);
                      const buttonClass = (target: ResolveTarget) =>
                        `rounded p-1 transition-colors ${activeTarget === target ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/50" : "hover:bg-muted"}`;

                      return (
                      <div
                        key={id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-sm"
                      >
                        <span className="line-clamp-1 flex-1">{text}</span>
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
              ) : (
                /* Editor view */
                <div
                  className="relative min-h-[520px] border-b border-border/60"
                  onClick={handleEditorClick}
                >
                  <LexicalComposer initialConfig={editorConfig}>
                    <EditorEditablePlugin editable={!resolveMode} />
                    <div className="relative">
                      <RichTextPlugin
                        contentEditable={
                          <ContentEditable className="editor-input min-h-[520px] p-4 text-sm focus:outline-none" />
                        }
                        placeholder={
                          <div className="pointer-events-none absolute left-4 top-4 whitespace-pre-line text-base italic text-muted-foreground">
                            {"Was steht heute an? Einfach drauflos schreiben …\n\n— Rückruf Joschka\n— Pressemitteilung Schulgesetz abstimmen\n— Unterlagen Ausschusssitzung"}
                          </div>
                        }
                        ErrorBoundary={LexicalErrorBoundary}
                      />
                      <FloatingTextFormatToolbar />
                    </div>
                    <OnChangePlugin onChange={onEditorChange} />
                    <OnChangePlugin onChange={(_, editor) => {
                      editorRef.current = editor;
                    }} ignoreSelectionChange />
                    <HistoryPlugin />
                    <HorizontalRulePlugin />
                    <DaySlipEnterBehaviorPlugin />
                    <InitialContentPlugin
                      initialHtml={todayData.html}
                      initialNodes={todayData.nodes}
                      dayKey={todayKey}
                    />
                  </LexicalComposer>
                </div>
              )}

              {/* ── Footer ── */}
              <div className="p-3">
                <button
                  type="button"
                  onClick={completeDay}
                  className="flex h-10 w-full items-center justify-between rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 text-sm font-medium text-emerald-200"
                >
                  <span>🏁 Tag abschließen</span>
                  <span className="text-xs opacity-70">
                    {resolveMode
                      ? "abbrechen"
                      : unresolvedCount > 0
                        ? `${unresolvedCount} offen →`
                        : "alles erledigt →"}
                  </span>
                </button>
              </div>
            </>
          )}
        </aside>
      )}

      {/* ── Trigger button ── */}
      <button
        type="button"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/90 shadow-lg backdrop-blur hover:bg-muted"
        aria-label="Tageszettel öffnen (Strg+Alt+J)"
        onClick={() => setOpen((prev) => !prev)}
      >
        <ClipboardPen className="h-5 w-5" />
        {unresolvedCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold text-white">
            {unresolvedCount}
          </span>
        )}
      </button>
    </>
  );
}
