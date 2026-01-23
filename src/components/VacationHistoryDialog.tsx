import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, TrendingDown, TrendingUp } from "lucide-react";

interface VacationHistoryEntry {
  id: string;
  year: number;
  annual_entitlement: number;
  carry_over_from_previous: number;
  total_taken: number;
  carry_over_to_next: number;
  expired_days: number;
  notes: string | null;
}

interface VacationHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string; // Optional: Für Admin-Ansicht anderer Mitarbeiter
  userName?: string;
}

export function VacationHistoryDialog({ 
  open, 
  onOpenChange, 
  userId,
  userName 
}: VacationHistoryDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<VacationHistoryEntry[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!open || !targetUserId) return;
    loadHistory();
  }, [open, targetUserId]);

  const loadHistory = async () => {
    if (!targetUserId) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from("vacation_history")
        .select("*")
        .eq("user_id", targetUserId)
        .order("year", { ascending: false });

      if (error) throw error;
      
      setHistory(data || []);
      
      // Extrahiere verfügbare Jahre
      const years = (data || []).map(h => h.year);
      setAvailableYears([...new Set(years)].sort((a, b) => b - a));
    } catch (error) {
      console.error("Error loading vacation history:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Urlaubshistorie {userName ? `- ${userName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Noch keine Urlaubshistorie vorhanden.</p>
              <p className="text-sm">Die Historie wird automatisch am Jahresende erstellt.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jahr</TableHead>
                  <TableHead className="text-right">Anspruch</TableHead>
                  <TableHead className="text-right">Übertrag</TableHead>
                  <TableHead className="text-right">Gesamt</TableHead>
                  <TableHead className="text-right">Genommen</TableHead>
                  <TableHead className="text-right">Verfallen</TableHead>
                  <TableHead className="text-right">Übertrag ins nächste Jahr</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => {
                  const total = entry.annual_entitlement + entry.carry_over_from_previous;
                  const remaining = total - entry.total_taken - entry.expired_days;
                  
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.year}</span>
                          {entry.year === currentYear && (
                            <Badge variant="secondary" className="text-xs">Aktuell</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.annual_entitlement}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.carry_over_from_previous > 0 ? (
                          <Badge variant="outline" className="font-mono">
                            <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                            +{entry.carry_over_from_previous}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground font-mono">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {total}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.total_taken}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.expired_days > 0 ? (
                          <Badge variant="destructive" className="font-mono">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            -{entry.expired_days}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground font-mono">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.carry_over_to_next > 0 ? (
                          <Badge variant="secondary" className="font-mono bg-blue-50 text-blue-700 border-blue-200">
                            {entry.carry_over_to_next}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground font-mono">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Legende */}
          <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
            <p><strong>Anspruch:</strong> Jährlicher Urlaubsanspruch basierend auf Arbeitsvertrag</p>
            <p><strong>Übertrag:</strong> Nicht verbrauchter Urlaub aus dem Vorjahr (verfällt am 31.03)</p>
            <p><strong>Verfallen:</strong> Resturlaub der nach dem 31.03 verfallen ist</p>
            <p><strong>Übertrag ins nächste Jahr:</strong> Nicht verbrauchter Urlaub der ins Folgejahr übertragen wird</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default VacationHistoryDialog;
