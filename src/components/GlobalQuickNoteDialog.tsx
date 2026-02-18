import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StickyNote, Keyboard, Loader2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { MentionSharePromptDialog } from "@/components/shared/MentionSharePromptDialog";
import { extractMentionedUserIds } from "@/utils/noteMentions";

interface GlobalQuickNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalQuickNoteDialog({ open, onOpenChange }: GlobalQuickNoteDialogProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
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

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTitle("");
      setContent("");
    }
  }, [open]);

  const handleSave = async () => {
    if (savingRef.current) return;

    const plainTitle = stripHtml(title);
    const plainContent = stripHtml(content);

    if (!plainContent && !plainTitle) {
      toast.error("Bitte Titel oder Inhalt eingeben");
      return;
    }
    
    if (!user?.id) {
      toast.error("Nicht angemeldet");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    
    try {
      const insertData = {
        user_id: user.id,
        title: title.trim() || null,
        content: plainContent ? content.trim() : "",
        is_pinned: false,
        priority_level: 0,
        is_archived: false
      };
      
      const { data, error } = await supabase
        .from('quick_notes')
        .insert(insertData)
        .select('id')
        .single();

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      const mentionedUserIds = extractMentionedUserIds(title, content).filter(
        (mentionedUserId) => mentionedUserId !== user.id
      );

      if (mentionedUserIds.length > 0 && currentTenant?.id && data?.id) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .eq("tenant_id", currentTenant.id)
          .in("user_id", mentionedUserIds);

        const users = mentionedUserIds.map((userId) => ({
          id: userId,
          displayName:
            profiles?.find((profile) => profile.user_id === userId)?.display_name || "Unbekannt",
        }));

        setNewNoteId(data.id);
        setMentionedUsers(users);
        setMentionPromptOpen(true);
      }

      toast.success("Notiz erstellt");
      
      // Dispatch event to refresh notes list immediately
      window.dispatchEvent(new CustomEvent('quick-note-created', { 
        detail: { note: data } 
      }));
      
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating quick note:", error);
      toast.error(`Fehler: ${error.message || 'Unbekannter Fehler'}`);
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

    const { error } = await supabase.from("quick_note_shares").insert(
      userIds.map((sharedWithUserId) => ({
        note_id: newNoteId,
        shared_with_user_id: sharedWithUserId,
        shared_by_user_id: user.id,
        permission_type: permission,
      }))
    );

    if (error) {
      toast.error("Freigabe für erwähnte Personen fehlgeschlagen");
      return;
    }

    toast.success("Notiz für erwähnte Personen freigegeben");
  };

  // Handle Enter key in title editor for quick save
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
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
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!savingRef.current) {
        void handleSave();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            placeholder="Notiz eingeben..."
            minHeight="120px"
            onKeyDown={handleContentKeyDown}
            disabled={saving}
          />
        </div>
        
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
                  <p>Im Titel speichert Enter direkt. Im Inhalt speichert Cmd/Ctrl + Enter.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
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
