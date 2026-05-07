import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import { Users2, Loader2, Merge, RefreshCcw, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DupRow {
  contact1_id: string;
  contact2_id: string;
  contact1_name: string | null;
  contact2_name: string | null;
  contact1_email: string | null;
  contact2_email: string | null;
  match_score: number;
  match_reasons: string[];
}

export function DuplicateScanDashboard() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<DupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState(0.6);

  const scan = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("find_contact_duplicates_trgm", {
      _tenant_id: currentTenant.id,
      _threshold: threshold,
      _limit: 200,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    setRows((data ?? []) as DupRow[]);
  }, [currentTenant?.id, threshold, toast]);

  useEffect(() => { void scan(); }, [scan]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users2 className="h-5 w-5" />
            Kontakt-Duplikate
          </CardTitle>
          <CardDescription>
            Server-seitige Trigramm-Suche. Schwellwert: <strong>{Math.round(threshold * 100)}%</strong>
            {" · "}<strong>{rows.length}</strong> Paare gefunden.
          </CardDescription>
        </div>
        <Button onClick={scan} disabled={loading} size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
          Erneut scannen
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 max-w-sm">
          <label className="text-sm text-muted-foreground mb-2 block">Schwellwert</label>
          <Slider
            value={[threshold]}
            onValueChange={(v) => setThreshold(v[0])}
            min={0.4}
            max={0.95}
            step={0.05}
          />
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Scanne…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Keine Duplikate über dem Schwellwert.</div>
        ) : (
          <ScrollArea className="h-[60vh]">
            <div className="space-y-2 pr-4">
              {rows.map((r) => (
                <div key={`${r.contact1_id}-${r.contact2_id}`}
                     className="flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-muted/40">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <button
                        onClick={() => navigate(`/contacts/${r.contact1_id}`)}
                        className="font-medium truncate hover:underline text-left"
                      >
                        {r.contact1_name ?? "(ohne Name)"}
                      </button>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <button
                        onClick={() => navigate(`/contacts/${r.contact2_id}`)}
                        className="font-medium truncate hover:underline text-left"
                      >
                        {r.contact2_name ?? "(ohne Name)"}
                      </button>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.contact1_email ?? "—"} · {r.contact2_email ?? "—"}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.match_reasons?.map((reason, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{reason}</Badge>
                      ))}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {Math.round(Number(r.match_score) * 100)}%
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/contacts/${r.contact1_id}?merge=${r.contact2_id}`)}
                  >
                    <Merge className="h-3.5 w-3.5 mr-1" /> Zusammenführen
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
