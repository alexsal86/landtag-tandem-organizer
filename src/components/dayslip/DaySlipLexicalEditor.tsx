import '@/styles/lexical-editor.css';
import { memo, useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { debugConsole } from "@/utils/debugConsole";
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
  COMMAND_PRIORITY_NORMAL,
  type EditorState,
  type LexicalEditor,
  KEY_ENTER_COMMAND,
} from "lexical";
import { $createHorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { BLUR_COMMAND, FOCUS_COMMAND } from "lexical";
import { $generateNodesFromDOM } from "@lexical/html";
import FloatingTextFormatToolbar from "@/components/lexical/FloatingTextFormatToolbar";
import { $createDaySlipLineNode } from "@/components/lexical/DaySlipLineNode";
import { $createLabeledHorizontalRuleNode } from "@/components/lexical/LabeledHorizontalRuleNode";
import { parseRuleLine } from "./dayslipTypes";

// ─── Lexical Plugins ─────────────────────────────────────────────────────────

/**
 * Lädt den initialen Editor-Inhalt genau einmal pro Rehydrate-Key.
 *
 * Wichtig: Solange `dayKey` (und optional `forceReloadToken`) gleich bleiben,
 * wird absichtlich kein erneutes Reload ausgeführt. So überschreiben laufende
 * lokale Edits nicht versehentlich den aktuellen Editor-State.
 *
 * Falls externe Syncs denselben `dayKey` mit neuem Inhalt liefern, kann über
 * `forceReloadToken` eine explizite Rehydrate-Strategie implementiert werden
 * (z. B. Versionsnummer oder Content-Hash).
 */
function InitialContentPlugin({ initialHtml, initialNodes, dayKey, forceReloadToken }: { initialHtml: string; initialNodes?: string; dayKey: string; forceReloadToken?: string | number }) {
  const [editor] = useLexicalComposerContext();
  const loadedForDayRef = useRef<string | null>(null);
  const reloadKey = `${dayKey}::${forceReloadToken ?? ""}`;

  useEffect(() => {
    if (loadedForDayRef.current === reloadKey) return;
    loadedForDayRef.current = reloadKey;
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      if (initialNodes?.trim()) {
        try { const parsed = editor.parseEditorState(initialNodes); editor.setEditorState(parsed); return; } catch (e) { debugConsole.warn("Failed to parse saved nodes, falling back to HTML", e); }
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
  }, [reloadKey, editor, initialHtml, initialNodes]);

  return null;
}

function DaySlipEnterBehaviorPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(KEY_ENTER_COMMAND, (event) => {
      if (event?.shiftKey) return false;
      let currentText = "";
      let hasRangeSelection = false;
      editor.getEditorState().read(() => {
        const sel = $getSelection();
        if ($isRangeSelection(sel)) { hasRangeSelection = true; currentText = sel.anchor.getNode().getTopLevelElementOrThrow().getTextContent().trim(); }
      });
      if (!hasRangeSelection) return false;
      const ruleParsed = parseRuleLine(currentText);
      event?.preventDefault();
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const topLevel = selection.anchor.getNode().getTopLevelElementOrThrow();
        if (ruleParsed.isRule) {
          const hrNode = ruleParsed.label ? $createLabeledHorizontalRuleNode(ruleParsed.label) : $createHorizontalRuleNode();
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
    }, COMMAND_PRIORITY_CRITICAL);
  }, [editor]);
  return null;
}

function FocusPlugin({ onFocusChange }: { onFocusChange: (focused: boolean) => void }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const unregFocus = editor.registerCommand(FOCUS_COMMAND, () => { onFocusChange(true); return false; }, COMMAND_PRIORITY_NORMAL);
    const unregBlur = editor.registerCommand(BLUR_COMMAND, () => { onFocusChange(false); return false; }, COMMAND_PRIORITY_NORMAL);
    return () => { unregFocus(); unregBlur(); };
  }, [editor, onFocusChange]);
  return null;
}

function EditorEditablePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => { editor.setEditable(editable); }, [editor, editable]);
  return null;
}

function EditorReadyPlugin({ onEditorReady }: { onEditorReady: (editor: LexicalEditor) => void }) {
  const [editor] = useLexicalComposerContext();
  const readyCalledRef = useRef(false);

  useEffect(() => {
    if (readyCalledRef.current) return;
    readyCalledRef.current = true;
    onEditorReady(editor);
  }, [editor, onEditorReady]);

  return null;
}

// ─── DaySlipEditor Component ─────────────────────────────────────────────────

export interface DaySlipEditorProps {
  initialHtml: string;
  initialNodes?: string;
  dayKey: string;
  /** Optionales Rehydrate-Token für explizite Reloads bei unverändertem `dayKey`. */
  forceReloadToken?: string | number;
  resolveMode: boolean;
  editorConfig: Parameters<typeof LexicalComposer>[0]["initialConfig"];
  onEditorChange: (editorState: EditorState, editor: LexicalEditor) => void;
  onEditorReady: (editor: LexicalEditor) => void;
  onEditorClick: (e: MouseEvent<HTMLDivElement>) => void;
  onEditorContextMenu: (e: MouseEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
  hidden?: boolean;
}

export const DaySlipLexicalEditor = memo(function DaySlipLexicalEditor(props: DaySlipEditorProps) {
  const { initialHtml, initialNodes, dayKey, forceReloadToken, resolveMode, editorConfig, onEditorChange, onEditorReady, onEditorClick, onEditorContextMenu, onDrop, hidden } = props;
  const [isFocused, setIsFocused] = useState(false);
  const handleFocusChange = useCallback((focused: boolean) => setIsFocused(focused), []);

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
            contentEditable={<ContentEditable className="editor-input h-full min-h-[340px] p-4 text-sm focus:outline-none" />}
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
        <EditorReadyPlugin onEditorReady={onEditorReady} />
        <HistoryPlugin />
        <HorizontalRulePlugin />
        <DaySlipEnterBehaviorPlugin />
        <FocusPlugin onFocusChange={handleFocusChange} />
        <InitialContentPlugin initialHtml={initialHtml} initialNodes={initialNodes} dayKey={dayKey} forceReloadToken={forceReloadToken} />
      </LexicalComposer>
    </div>
  );
});
