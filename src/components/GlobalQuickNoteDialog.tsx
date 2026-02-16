import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote, Keyboard, Loader2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface GlobalQuickNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalQuickNoteDialog({ open, onOpenChange }: GlobalQuickNoteDialogProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTitle("");
      setContent("");
    }
  }, [open]);

  const handleSave = async () => {
    if (!content.trim() && !title.trim()) {
      toast.error("Bitte Inhalt eingeben");
      return;
    }
    
    if (!user?.id) {
      toast.error("Nicht angemeldet");
      return;
    }

    setSaving(true);
    
    try {
      const insertData = {
        user_id: user.id,
        title: title.trim() || null,
        content: content.trim() || title.trim(),
        is_pinned: false,
        priority_level: 0,
        is_archived: false
      };
      
      const { data, error } = await supabase
        .from('quick_notes')
        .insert(insertData)
        .select();

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      toast.success("Notiz erstellt");
      
      // Dispatch event to refresh notes list immediately
      window.dispatchEvent(new CustomEvent('quick-note-created', { 
        detail: { note: data?.[0] } 
      }));
      
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating quick note:", error);
      toast.error(`Fehler: ${error.message || 'Unbekannter Fehler'}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle Enter key for quick save
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const isTextarea = target.tagName === "TEXTAREA";

    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      if (!isTextarea || (isTextarea && !(e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        if (!saving) {
          void handleSave();
        }
      }
    }

    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!saving) {
        void handleSave();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary" />
            Schnelle Notiz
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          <Input
            placeholder="Titel (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            disabled={saving}
          />
          <Textarea
            placeholder="Notiz eingeben..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            disabled={saving}
            onKeyDown={handleKeyDown}
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
                  <p>Enter speichert, Shift + Enter erzeugt eine neue Zeile.</p>
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
    </Dialog>
  );
}