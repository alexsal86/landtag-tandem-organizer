import { useCallback, useEffect, useState } from "react";
import { Archive, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { debugConsole } from "@/utils/debugConsole";

interface ArchivedItem {
  id: string;
  subject: string | null;
  source_channel: string | null;
  priority: string | null;
  updated_at: string;
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  urgent: "Dringend",
};

const CHANNEL_LABELS: Record<string, string> = {
  email: "E-Mail",
  phone: "Telefon",
  social: "Social Media",
  in_person: "Persönlich",
  other: "Sonstiges",
};

interface CaseItemsArchiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore?: () => void;
}

export function CaseItemsArchiveSheet({ open, onOpenChange, onRestore }: CaseItemsArchiveSheetProps) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [items, setItems] = useState<ArchivedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadArchived = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("case_items")
        .select("id, subject, source_channel, priority, updated_at")
        .eq("tenant_id", currentTenant.id)
        .eq("status", "archiviert" as any)
        .order("updated_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setItems((data ?? []) as ArchivedItem[]);
    } catch (e) {
      debugConsole.error("Error loading archived case items:", e);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    if (open) loadArchived();
  }, [open, loadArchived]);

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      const { error } = await supabase
        .from("case_items")
        .update({ status: "neu" } as any)
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Wiederhergestellt", description: "Vorgang wurde wiederhergestellt." });
      setItems((prev) => prev.filter((i) => i.id !== id));
      onRestore?.();
    } catch (e) {
      console.error("Error restoring case item:", e);
      toast({ title: "Fehler", description: "Vorgang konnte nicht wiederhergestellt werden.", variant: "destructive" });
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Archivierte Vorgänge
          </SheetTitle>
          <SheetDescription>
            Archivierte Vorgänge anzeigen und wiederherstellen
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Keine archivierten Vorgänge.</p>
          ) : (
            <ScrollArea className="h-[calc(100vh-180px)]">
              <div className="space-y-2 pr-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium truncate">{item.subject || "Ohne Titel"}</p>
                      <div className="flex flex-wrap gap-1">
                        {item.source_channel && (
                          <Badge variant="outline" className="text-xs">
                            {CHANNEL_LABELS[item.source_channel] || item.source_channel}
                          </Badge>
                        )}
                        {item.priority && (
                          <Badge variant="secondary" className="text-xs">
                            {PRIORITY_LABELS[item.priority] || item.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(item.updated_at), "dd.MM.yyyy HH:mm", { locale: de })}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={restoringId === item.id}
                      onClick={() => handleRestore(item.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Wiederherstellen
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
