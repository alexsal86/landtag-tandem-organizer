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
import { QUICK_NOTE_COLORS } from "@/components/my-work/quickNoteColors";

const COLORS = QUICK_NOTE_COLORS;

interface MyWorkQuickCaptureProps {
  onNoteSaved?: () => void;
}

export function MyWorkQuickCapture({ onNoteSaved }: MyWorkQuickCaptureProps) {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [selectedColor, setSelectedColor] = useState("#3b82f6");
  const [isPinned, setIsPinned] = useState(false);
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const canSaveNote = Boolean(stripHtml(title) || stripHtml(content));

  const resetQuickCaptureForm = () => {
    setContent("");
    setTitle("");
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
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!saving && canSaveNote) {
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
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      const mentionMenuOpen = !!document.querySelector('.mentions-menu');
      if (mentionMenuOpen) return;

      e.preventDefault();
      if (!saving && canSaveNote) {
        void handleSaveNote();
      }
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mx-auto flex w-full max-w-2xl items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left text-muted-foreground shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <StickyNote className="h-4 w-4" />
        <span className="flex-1 text-body">Notiz erfassen…</span>
        <span className="text-caption hidden sm:inline">Klicken zum Schreiben</span>
      </button>
    );
  }

  return (
    <>
      <Card
        className="mx-auto max-w-2xl transition-colors border-l-4 w-full shadow-md"
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
                  <p>Enter speichert, Shift + Enter erzeugt eine neue Zeile.</p>
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
                  {COLORS.map((color) => (
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
                      title={color.name}
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
            onChange={setContent}
            onKeyDown={handleEditorKeyDown}
            placeholder="Was möchtest du festhalten? „[ ] “ am Zeilenanfang = Checkbox, Mikrofon = Diktat"
            minHeight="100px"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleSaveNote}
            disabled={!canSaveNote || saving}
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
            disabled={!stripHtml(content) || savingAsTask}
            size="sm"
          >
            {savingAsTask ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ListTodo className="mr-2 h-4 w-4" />
            )}
            Als Aufgabe
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setExpanded(false)}>
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
