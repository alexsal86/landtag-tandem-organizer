import { useQuickNoteDraft } from "@/hooks/useQuickNoteDraft";
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pin, Palette, Save, ListTodo, Loader2, Info, StickyNote, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { MentionSharePromptDialog } from "@/components/shared/MentionSharePromptDialog";
import { useQuickCaptureActions } from "@/components/my-work/hooks/useQuickCaptureActions";
import { stripHtml, toEditorHtml } from "@/components/my-work/utils/editorContent";
import { useNoteColorPalette, colorLabel } from "@/components/my-work/useNoteColorPalette";

interface MyWorkQuickCaptureProps {
  onNoteSaved?: () => void;
}

export function MyWorkQuickCapture({ onNoteSaved }: MyWorkQuickCaptureProps) {
  const { title, content, setTitle, setContent, clearDraft, draftStatus } = useQuickNoteDraft("capture");
  const [selectedColor, setSelectedColor] = useState("#3b82f6");
  const [isPinned, setIsPinned] = useState(false);
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const { palette } = useNoteColorPalette();

  const canSaveNote = Boolean(stripHtml(title) || stripHtml(content));

  const resetQuickCaptureForm = () => {
    clearDraft();
    setSelectedColor("#3b82f6");
    setIsPinned(false);
    setEditorResetKey((prev) => prev + 1);
  };

  const {
    handleSaveNote,
    handleSaveAsTask,
    handleShareMentionedUsers,
    saving,
    savingAsTask,
    mentionPromptOpen,
    setMentionPromptOpen,
    mentionedUsers,
  } = useQuickCaptureActions({
    values: { title, content, selectedColor, isPinned },
    canSaveNote,
    onResetForm: resetQuickCaptureForm,
    onNoteSaved,
  });

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!saving && !savingAsTask && canSaveNote) {
        void handleSaveNote();
      }
    }
  };

  const contentEditorRef = useRef<HTMLDivElement>(null);

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      // Focus the content editor
      const contentEditable = contentEditorRef.current?.querySelector('[contenteditable="true"]');
      if (contentEditable instanceof HTMLElement) {
        contentEditable.focus();
      }
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      const mentionMenuOpen = !!document.querySelector('.mentions-menu');
      if (mentionMenuOpen) return;

      e.preventDefault();
      if (!saving && !savingAsTask && canSaveNote) {
        void handleSaveNote();
      }
    }
  };

  if (!expanded) {
    return (
      <div className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-muted-foreground shadow-sm transition-shadow hover:shadow-md">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <StickyNote className="h-4 w-4" />
          <span className="flex-1 text-body">{canSaveNote ? "Entwurf fortsetzen…" : "Notiz erfassen…"}</span>
        </button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="hover:text-foreground" aria-label="Tipps">
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs space-y-1">
              <p>„[ ] Punkt" am Zeilenanfang wird zur abhakbaren Checkbox.</p>
              <p>Über „Umwandeln" landet eine Notiz als Aufgabe, Entscheidung, Vorgang, im Jour fixe oder auf dem Tageszettel.</p>
              <p>Enter erzeugt einen Absatz. Strg/Cmd + Enter speichert.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <>
      <Card
        className="transition-colors border-l-4 w-full shadow-md"
        onKeyDown={(e) => { if (e.key === "Escape" && !canSaveNote) setExpanded(false); }}
        style={{ borderLeftColor: selectedColor }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-1.5">
            Quick Notes
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enter erzeugt einen Absatz. Strg/Cmd + Enter speichert.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isPinned && "text-primary")}
              onClick={() => setIsPinned(!isPinned)}
            >
              <Pin className={cn("h-4 w-4", isPinned && "fill-current")} />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Palette className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="end">
                <div className="flex gap-1">
                  {palette.map((color) => (
                    <button
                      key={color.value}
                      className={cn(
                        "h-6 w-6 rounded-full border-2",
                        selectedColor === color.value
                          ? "border-foreground"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setSelectedColor(color.value)}
                      title={colorLabel(color)}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <SimpleRichTextEditor
          key={`title-${editorResetKey}`}
          initialContent={toEditorHtml(title)}
          disabled={saving || savingAsTask}
          onChange={setTitle}
          onKeyDown={handleTitleKeyDown}
          placeholder="Titel (@ für Mentions)"
          minHeight="44px"
          showToolbar={false}
          autoFocus
        />
        <div className="min-h-[120px]" ref={contentEditorRef}>
          <SimpleRichTextEditor
            key={editorResetKey}
            initialContent={toEditorHtml(content)}
            disabled={saving || savingAsTask}
            onChange={setContent}
            enableChecklists
            onKeyDown={handleEditorKeyDown}
            placeholder="Was möchtest du festhalten? „[ ] “ am Zeilenanfang = Checkbox, Mikrofon = Diktat"
            minHeight="100px"
          />
        </div>
        <p role="status" className="text-xs text-muted-foreground">{draftStatus}</p>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleSaveNote}
            disabled={!canSaveNote || saving || savingAsTask}
            size="sm"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Speichern
          </Button>
          <Button
            variant="outline"
            onClick={handleSaveAsTask}
            disabled={!stripHtml(content) || saving || savingAsTask}
            size="sm"
          >
            {savingAsTask ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ListTodo className="mr-2 h-4 w-4" />
            )}
            Als Aufgabe
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto" disabled={saving || savingAsTask} onClick={() => setExpanded(false)}>
            <ChevronUp className="mr-1.5 h-4 w-4" />
            Schließen
          </Button>
        </div>
      </CardContent>
      </Card>
      <MentionSharePromptDialog
        open={mentionPromptOpen}
        onOpenChange={setMentionPromptOpen}
        users={mentionedUsers}
        onConfirm={handleShareMentionedUsers}
      />
    </>
  );
}
