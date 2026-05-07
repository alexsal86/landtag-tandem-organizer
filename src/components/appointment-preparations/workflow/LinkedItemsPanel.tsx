import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, BookOpen, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import {
  getConversationPartnersFromPreparationData,
  type AppointmentPreparation,
} from "@/hooks/useAppointmentPreparation";

interface CaseFile {
  id: string;
  title: string;
  status: string;
  case_type: string;
}

interface Dossier {
  id: string;
  title: string;
  status: string;
  priority: string;
  summary: string | null;
}

interface Props {
  preparation: AppointmentPreparation;
}

export function LinkedItemsPanel({ preparation }: Props) {
  const navigate = useNavigate();
  const partners = useMemo(
    () => getConversationPartnersFromPreparationData(preparation.preparation_data),
    [preparation.preparation_data],
  );
  const linkedContactIds = useMemo(
    () => partners.map((p) => p.contact_id).filter((v): v is string => Boolean(v)),
    [partners],
  );

  const [caseFiles, setCaseFiles] = useState<CaseFile[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (linkedContactIds.length === 0) {
      setCaseFiles([]); setDossiers([]); return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data: linkRows } = await supabase
          .from("case_file_contacts")
          .select("case_file_id")
          .in("contact_id", linkedContactIds);
        const caseIds = Array.from(new Set((linkRows ?? []).map((r) => r.case_file_id).filter(Boolean) as string[]));
        if (caseIds.length > 0) {
          const { data: cases } = await supabase
            .from("case_files")
            .select("id,title,status,case_type")
            .in("id", caseIds)
            .eq("tenant_id", preparation.tenant_id)
            .limit(20);
          if (active) setCaseFiles((cases as CaseFile[]) ?? []);
        } else if (active) setCaseFiles([]);

        // Dossiers: link via topic/title contains partner names — fallback simple search by tenant
        const { data: dossierRows } = await supabase
          .from("dossiers")
          .select("id,title,status,priority,summary")
          .eq("tenant_id", preparation.tenant_id)
          .neq("status", "archived")
          .order("updated_at", { ascending: false })
          .limit(5);
        if (active) setDossiers((dossierRows as Dossier[]) ?? []);
      } catch (e) {
        debugConsole.error("LinkedItemsPanel", e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [linkedContactIds.join(","), preparation.tenant_id]);

  if (linkedContactIds.length === 0) return null;
  if (!loading && caseFiles.length === 0 && dossiers.length === 0) return null;

  return (
    <Card className="bg-card shadow-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FolderKanban className="h-4 w-4 text-primary" />
          Verknüpfte Vorgänge & Dossiers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {caseFiles.length > 0 && (
          <div className="space-y-1.5">
            <p className="section-label text-muted-foreground">Vorgänge der Gesprächspartner</p>
            {caseFiles.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <FolderKanban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{c.title}</span>
                <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => navigate(`/casefiles?caseFileId=${c.id}`)}
                  aria-label="Vorgang öffnen"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {dossiers.length > 0 && (
          <div className="space-y-1.5">
            <p className="section-label text-muted-foreground">Aktuelle Dossiers</p>
            {dossiers.map((d) => (
              <div key={d.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{d.title}</div>
                  {d.summary && <div className="text-xs text-muted-foreground line-clamp-2">{d.summary}</div>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => navigate(`/dossiers?id=${d.id}`)}
                  aria-label="Dossier öffnen"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
