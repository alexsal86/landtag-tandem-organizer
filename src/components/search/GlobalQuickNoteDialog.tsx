import { useQuickNotesData } from "@/features/quick-notes/useQuickNotesData";
import { QuickNotesSyncStatus } from "@/features/quick-notes/QuickNotesSyncStatus";
import { useQuickNoteDraft } from "@/hooks/useQuickNoteDraft";
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StickyNote, Keyboard, Loader2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from '@/utils/debugConsole';
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { MentionSharePromptDialog } from "@/components/shared/MentionSharePromptDialog";
import { extractMentionedUsers } from "@/utils/noteMentions";
import { notify } from "@/lib/notify";

interface GlobalQuickNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalQuickNoteDialog({ open, onOpenChange }: GlobalQuickNoteDialogProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { queueNote, repository } = useQuickNotesData();
  const { title, content, setTitle, setContent, clearDraft, draftStatus } = useQuickNoteDraft("global");
  const [saving, setSaving] = useState(false);
  const [mentionPromptOpen, setMentionPromptOpen] = useState(false);
  const [newNoteId, setNewNoteId] = useState<string | null>(null);
  const [mentionedUsers, setMentionedUsers] = useState<Array<{ id: string; displayName: string }>>([]);
  const savingRef = useRef(false);

  const stripHtml = (value: string) => value.replace(/<[^>]*>/g, "").trim();
  const toEditorHtml = (value: string | null | undefined) => {
    if (!value) return "";
    if (/<[^>]+>/.test(value)) return value;
    return `<p>${value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</p>`;
  };

  const handleSave = async () => {
    if (savingRef.current) return;

    const plainTitle = stripHtml(title);
    const plainContent = stripHtml(content);

    if (!plainContent && !plainTitle) {
      notify.error("Bitte Titel oder Inhalt eingeben");
      return;
    }
    
    if (!user?.id) {
      notify.error("Nicht angemeldet");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    
    try {
      const data = await queueNote({ title: title.trim() || null, content: plainContent ? content.trim() : "" });

      const mentions = extractMentionedUsers(title, content).filter(person => person.id !== user.id);
      if (mentions.length > 0) {
        setNewNoteId(data.id); setMentionedUsers(mentions); setMentionPromptOpen(true);
      }

      notify.success(navigator.onLine ? "Notiz lokal gespeichert" : "Offline auf diesem Gerät gespeichert");
      
      // Dispatch event to refresh notes list immediately
      window.dispatchEvent(new CustomEvent('quick-note-created', { 
        detail: { note: data } 
      }));
      
      clearDraft();
      onOpenChange(false);
    } catch (error: unknown) {
      debugConsole.error("Error creating quick note:", error);
      notify.error(`Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleShareMentionedUsers = async (
    userIds: string[],
    permission: "view" | "edit"
  ) => {
    if (!newNoteId || !user?.id || userIds.length === 0) return;
    await repository.sync();
    if (repository.getSnapshot().writes.some(write => write.noteId === newNoteId)) {
      notify.error("Bitte die Notiz nach der Synchronisierung über das Notizmenü teilen");
      return;
    }

    const { error } = await supabase.from("quick_note_shares").insert(
      userIds.map((sharedWithUserId) => ({
        tenant_id: currentTenant?.id,
        note_id: newNoteId,
        shared_with_user_id: sharedWithUserId,
        shared_by_user_id: user.id,
        permission_type: permission,
      }))
    );

    if (error) {
      notify.error("Freigabe für erwähnte Personen fehlgeschlagen");
      return;
    }

    notify.success("Notiz für erwähnte Personen freigegeben");
  };

  // Handle Enter key in title editor for quick save
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      const mentionMenuOpen = !!document.querySelector('.mentions-menu');

      if (!mentionMenuOpen) {
        e.preventDefault();
        if (!savingRef.current) {
          void handleSave();
        }
      }
    }
  };

  const handleContentKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!savingRef.current) {
        void handleSave();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!savingRef.current) onOpenChange(nextOpen); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary" />
            Schnelle Notiz
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          <SimpleRichTextEditor
            key={open ? 'global-quick-note-title-open' : 'global-quick-note-title-closed'}
            initialContent={toEditorHtml(title)}
            disabled={saving}
            onChange={setTitle}
            placeholder="Titel (@ für Mentions)"
            minHeight="44px"
            showToolbar={false}
            onKeyDown={handleTitleKeyDown}
          />
          <SimpleRichTextEditor
            key={open ? 'global-quick-note-content-open' : 'global-quick-note-content-closed'}
            initialContent={toEditorHtml(content)}
            onChange={setContent}
            enableChecklists
            placeholder="Notiz eingeben..."
            minHeight="120px"
            onKeyDown={handleContentKeyDown}
            disabled={saving}
          />
        </div>
        
        <QuickNotesSyncStatus />
        <p role="status" className="text-xs text-muted-foreground">{draftStatus}</p>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mr-auto">
            <div className="flex items-center gap-1">
              <Keyboard className="h-3 w-3" />
              <span>Cmd/Ctrl + .</span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="hover:text-foreground">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enter erzeugt einen Absatz. Strg/Cmd + Enter speichert.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Schließen
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Speichern...
              </>
            ) : (
              "Speichern"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      <MentionSharePromptDialog
        open={mentionPromptOpen}
        onOpenChange={setMentionPromptOpen}
        users={mentionedUsers}
        onConfirm={handleShareMentionedUsers}
      />
    </Dialog>
  );
}
