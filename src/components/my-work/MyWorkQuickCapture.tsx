import { useQuickNoteDraft } from "@/hooks/useQuickNoteDraft";
import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pin, Loader2, Info, SquarePen } from "lucide-react";
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
          <SquarePen className="h-4 w-4" aria-hidden="true" />
          <span className="flex-1 text-body">{canSaveNote ? "Entwurf fortsetzen…" : "Notiz erfassen…"}</span>
        </button>
        <span className="hidden sm:inline text-caption text-muted-foreground select-none" aria-hidden="true">@ erwähnen · # Thema</span>
      </div>
    );
  }

  const footer = (

    <>
      <TooltipProvider><Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Hinweise zur Notizerfassung"><Info className="h-4 w-4" /></Button>
        </TooltipTrigger>
        <TooltipContent>Strg/Cmd + Enter speichert. @ erwähnt Personen. [ ] erstellt eine Checkbox. Abbrechen behält deinen lokalen Entwurf.</TooltipContent>
      </Tooltip></TooltipProvider>
      <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Notizfarbe wählen">
            <span className="h-3.5 w-3.5 rounded-full border border-border" style={{ backgroundColor: selectedColor }} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex flex-wrap gap-1">
            {palette.map(color => (
              <button type="button" key={color.value} aria-label={colorLabel(color)} aria-pressed={selectedColor === color.value}
                className={cn("h-6 w-6 rounded-full border-2", selectedColor === color.value ? "border-foreground" : "border-transparent")}
                style={{ backgroundColor: color.value }} onClick={() => setSelectedColor(color.value)} />
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon" className={cn("h-7 w-7", isPinned && "bg-muted text-foreground")}
        aria-label="Notiz anpinnen" aria-pressed={isPinned} onClick={() => setIsPinned(!isPinned)}>
        <Pin className="h-4 w-4" />
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <span role="status" title={draftStatus} className="hidden text-xs text-muted-foreground sm:inline">
          {draftStatus === "Entwurf lokal gesichert" ? "Lokal gesichert" : draftStatus || "@ erwähnen"}
        </span>
        <Button variant="ghost" size="sm" disabled={saving || savingAsTask} onClick={() => setExpanded(false)}>Abbrechen</Button>
        <Button variant="secondary" size="sm" onClick={handleSaveNote} disabled={!canSaveNote || saving || savingAsTask} title="Strg/Cmd + Enter">
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Notiz speichern
        </Button>
      </div>
    </>
  );

  return (
    <>
      <Card className="w-full rounded-xl border-border bg-card shadow-sm animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none"
        onKeyDown={e => { if (e.key === "Escape" && !saving && !savingAsTask) setExpanded(false); }}>
        <CardContent className="p-3 pb-0">
          <div className="[&_[contenteditable]]:text-base [&_[contenteditable]]:font-semibold">
            <SimpleRichTextEditor key={`title-${editorResetKey}`} initialContent={toEditorHtml(title)}
              disabled={saving || savingAsTask} onChange={setTitle} onKeyDown={handleTitleKeyDown}
              placeholder="Titel" minHeight="36px" showToolbar={false} seamless />
          </div>
          <div ref={contentEditorRef}>
            <SimpleRichTextEditor key={editorResetKey} initialContent={toEditorHtml(content)}
              disabled={saving || savingAsTask} onChange={setContent} autoFocus enableChecklists seamless
              toolbarPosition="bottom" compactToolbar toolbarExtras={footer} onKeyDown={handleEditorKeyDown}
              placeholder="Gedanke, Notiz oder Anliegen…" minHeight="72px" />
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
