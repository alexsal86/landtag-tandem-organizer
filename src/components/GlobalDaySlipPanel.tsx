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
  EditorState,
  KEY_ENTER_COMMAND,
} from "lexical";
import { $createHorizontalRuleNode, HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { ClipboardPen, Folder, FolderArchive, ListTodo, NotebookPen, Scale, X } from "lucide-react";
import FloatingTextFormatToolbar from "@/components/FloatingTextFormatToolbar";

type ResolveTarget = "note" | "task" | "decision" | "archived";

interface DaySlipDayData {
  html: string;
  plainText: string;
  nodes?: string;
  resolved?: Array<{ text: string; target: ResolveTarget }>;
}

type DaySlipStore = Record<string, DaySlipDayData>;

const STORAGE_KEY = "day-slip-v2";

const toDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

const extractPointsFromHtml = (html: string) => {
  if (!html.trim()) return [];
  const parser = new DOMParser();
  const dom = parser.parseFromString(html, "text/html");

  return Array.from(dom.querySelectorAll("p"))
    .map((p) => (p.textContent ?? "").trim())
    .filter((line) => line.length > 0 && line !== "---");
};

function InitialContentPlugin({ initialHtml, initialNodes, dayKey }: { initialHtml: string; initialNodes?: string; dayKey: string }) {
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
          // fallback to HTML path
        }
      }

      if (initialHtml.trim()) {
        const parser = new DOMParser();
        const dom = parser.parseFromString(initialHtml, "text/html");
        const nodes = $generateNodesFromDOM(editor, dom);
        root.append(...nodes);
        return;
      }

      root.append($createParagraphNode());
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
        if (event?.shiftKey) {
          return false;
        }

        let handled = false;

        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const topLevel = selection.anchor.getNode().getTopLevelElementOrThrow();
          const text = topLevel.getTextContent().trim();

          if (text === "---") {
            const hr = $createHorizontalRuleNode();
            const newParagraph = $createParagraphNode();
            topLevel.insertBefore(hr);
            topLevel.replace(newParagraph);
            newParagraph.select();
            handled = true;
            return;
          }

          const newParagraph = $createParagraphNode();
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

export function GlobalDaySlipPanel() {
  const [open, setOpen] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [store, setStore] = useState<DaySlipStore>({});
  const [resolveMode, setResolveMode] = useState(false);

  const todayKey = toDayKey(new Date());
  const todayData = store[todayKey] ?? { html: "", plainText: "", nodes: "" };

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      setStore(JSON.parse(raw) as DaySlipStore);
    } catch {
      setStore({});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const yesterdayOpenLines = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const key = toDayKey(yesterday);
    return extractPointsFromHtml(store[key]?.html ?? "");
  }, [store]);

  const openLines = useMemo(() => extractPointsFromHtml(todayData.html), [todayData.html]);

  const archiveDays = useMemo(
    () => Object.keys(store).filter((key) => key !== todayKey).sort((a, b) => b.localeCompare(a)),
    [store, todayKey],
  );

  const unresolvedCount = openLines.length;

  const handleClose = () => {
    if (unresolvedCount > 0) {
      setResolveMode(true);
      return;
    }
    setResolveMode(false);
    setOpen(false);
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

    setResolveMode(false);
    setOpen(false);
  };

  const resolveLine = (line: string, target: ResolveTarget, index: number) => {
    const remaining = [...openLines];
    remaining.splice(index, 1);

    setStore((prev) => ({
      ...prev,
      [todayKey]: {
        ...todayData,
        plainText: remaining.join("\n"),
        html: remaining.map((entry) => `<p>${entry}</p>`).join(""),
        resolved: [...(prev[todayKey]?.resolved ?? []), { text: line, target }],
      },
    }));
  };

  const editorConfig = {
    namespace: "DaySlipEditor",
    editable: true,
    theme: {
      paragraph:
        "day-slip-item group relative mb-2 pl-7 before:absolute before:left-0 before:top-[2px] before:content-['—'] before:text-muted-foreground before:rounded before:px-1 before:border before:border-transparent before:transition-colors hover:before:border-border/70 hover:before:bg-muted/40 hover:before:shadow-sm before:cursor-grab",
      text: {
        bold: "font-bold",
        italic: "italic",
        underline: "underline",
        strikethrough: "line-through",
      },
      horizontalRule: "my-3 border-border/80",
    },
    nodes: [HorizontalRuleNode],
    onError: (error: Error) => console.error("DaySlip Lexical error", error),
  };

  const onEditorChange = (editorState: EditorState, editor: any) => {
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
          ...(prev[todayKey] ?? { resolved: [] }),
          plainText,
          html,
          nodes,
        },
      }));
    });
  };

  return (
    <>
      {open && (
        <aside className="fixed bottom-24 right-6 z-50 w-[520px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold">
                <ClipboardPen className="h-5 w-5" /> Tageszettel
              </p>
              <p className="text-xs text-muted-foreground">{formatDate(todayKey)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setShowArchive((prev) => !prev)} aria-label="Archiv anzeigen">
                <Folder className="h-4 w-4" />
              </button>
              <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={handleClose} aria-label="Panel schließen">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showArchive ? (
            <div className="max-h-[560px] space-y-3 overflow-y-auto p-4">
              <p className="text-sm font-medium">Archiv (nur lesen)</p>
              {archiveDays.length === 0 && <p className="text-sm text-muted-foreground">Noch keine vergangenen Tage.</p>}
              {archiveDays.map((day) => (
                <div key={day} className="rounded-lg border border-border/60 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{formatDate(day)}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{stripHtml(store[day]?.html ?? "") || "—"}</p>
                </div>
              ))}
            </div>
          ) : (
            <>
              {yesterdayOpenLines.length > 0 && (
                <div className="border-b border-amber-400/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
                  <span className="font-semibold">Gestern noch offen:</span> "{yesterdayOpenLines[0]}"
                  {yesterdayOpenLines.length > 1 ? ` +${yesterdayOpenLines.length - 1}` : ""}
                </div>
              )}

              <div className="relative min-h-[520px] border-b border-border/60">
                <LexicalComposer initialConfig={editorConfig}>
                  <div className="relative">
                    <RichTextPlugin
                      contentEditable={<ContentEditable className="editor-input min-h-[520px] p-4 text-sm focus:outline-none" />}
                      placeholder={
                        <div className="pointer-events-none absolute top-4 left-4 text-base italic text-muted-foreground whitespace-pre-line">
                          {"Was steht heute an? Einfach drauflos schreiben …\n\n— Rückruf Joschka\n— Pressemitteilung Schulgesetz abstimmen\n— Unterlagen Ausschusssitzung"}
                        </div>
                      }
                      ErrorBoundary={LexicalErrorBoundary}
                    />
                    <FloatingTextFormatToolbar />
                  </div>
                  <OnChangePlugin onChange={onEditorChange} />
                  <HistoryPlugin />
                  <HorizontalRulePlugin />
                  <DaySlipEnterBehaviorPlugin />
                  <InitialContentPlugin initialHtml={todayData.html} initialNodes={todayData.nodes} dayKey={todayKey} />
                </LexicalComposer>
              </div>

              {resolveMode && unresolvedCount > 0 && (
                <div className="border-y border-border/60 bg-muted/30 px-4 py-3">
                  <p className="mb-2 text-sm font-medium">{unresolvedCount} Einträge noch offen – was soll damit passieren?</p>
                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {openLines.map((line, index) => (
                      <div key={`${line}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-sm">
                        <span className="line-clamp-1">{line}</span>
                        <div className="flex items-center gap-1">
                          <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => resolveLine(line, "note", index)} aria-label="Als Notiz übernehmen"><NotebookPen className="h-4 w-4" /></button>
                          <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => resolveLine(line, "task", index)} aria-label="Als Aufgabe übernehmen"><ListTodo className="h-4 w-4" /></button>
                          <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => resolveLine(line, "decision", index)} aria-label="Als Entscheidung übernehmen"><Scale className="h-4 w-4" /></button>
                          <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => resolveLine(line, "archived", index)} aria-label="Archivieren"><FolderArchive className="h-4 w-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3">
                <button type="button" onClick={completeDay} className="flex h-10 w-full items-center justify-between rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 text-sm font-medium text-emerald-200">
                  <span>🏁 Tag abschließen</span>
                  <span>{resolveMode ? "abbrechen" : `${unresolvedCount} offen →`}</span>
                </button>
              </div>
            </>
          )}
        </aside>
      )}

      <button type="button" className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-background/90 shadow-lg backdrop-blur hover:bg-muted" aria-label="Tageszettel öffnen" onClick={() => setOpen((prev) => !prev)}>
        <ClipboardPen className="h-5 w-5" />
      </button>
    </>
  );
}
