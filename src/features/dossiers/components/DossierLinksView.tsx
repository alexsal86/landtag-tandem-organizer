import { useState } from "react";
import { useDossierLinks, useCreateDossierLink, useDeleteDossierLink } from "../hooks/useDossierLinks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Link2, Users, CheckSquare, Calendar, Briefcase, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

const LINK_TYPES = [
  { value: "contact", label: "Kontakt", icon: Users },
  { value: "task", label: "Aufgabe", icon: CheckSquare },
  { value: "appointment", label: "Termin", icon: Calendar },
  { value: "case_file", label: "Fallakte", icon: Briefcase },
  { value: "document", label: "Dokument", icon: FileText },
] as const;

function getLinkTypeConfig(type: string) {
  return LINK_TYPES.find((t) => t.value === type) ?? { value: type, label: type, icon: Link2 };
}

interface DossierLinksViewProps {
  dossierId: string;
}

export function DossierLinksView({ dossierId }: DossierLinksViewProps) {
  const { data: links, isLoading } = useDossierLinks(dossierId);
  const createLink = useCreateDossierLink();
  const deleteLink = useDeleteDossierLink();
  const [open, setOpen] = useState(false);
  const [linkType, setLinkType] = useState("contact");
  const [searchTerm, setSearchTerm] = useState("");
  const { currentTenant } = useTenant();

  // Search for linkable items based on type
  const { data: searchResults } = useQuery({
    queryKey: ["dossier-link-search", linkType, searchTerm, currentTenant?.id],
    enabled: !!currentTenant?.id && searchTerm.length >= 2,
    queryFn: async () => {
      const tenantId = currentTenant!.id;
      switch (linkType) {
        case "contact": {
          const { data } = await supabase
            .from("contacts")
            .select("id, name, organization")
            .eq("tenant_id", tenantId)
            .ilike("name", `%${searchTerm}%`)
            .limit(10);
          return (data ?? []).map((c: Record<string, any>) => ({ id: c.id, label: c.name, sub: c.organization }));
        }
        case "task": {
          const { data } = await supabase
            .from("tasks")
            .select("id, title")
            .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
            .ilike("title", `%${searchTerm}%`)
            .limit(10);
          return (data ?? []).map((t: Record<string, any>) => ({ id: t.id, label: t.title, sub: null }));
        }
        case "appointment": {
          const { data } = await supabase
            .from("appointments")
            .select("id, title, start_time")
            .eq("tenant_id", tenantId)
            .ilike("title", `%${searchTerm}%`)
            .order("start_time", { ascending: false })
            .limit(10);
          return (data ?? []).map((a: Record<string, any>) => ({ id: a.id, label: a.title, sub: new Date(a.start_time).toLocaleDateString("de-DE") }));
        }
        case "case_file": {
          const { data } = await supabase
            .from("case_files")
            .select("id, title, file_number")
            .eq("tenant_id", tenantId)
            .ilike("title", `%${searchTerm}%`)
            .limit(10);
          return (data ?? []).map((c: Record<string, any>) => ({ id: c.id, label: c.title, sub: c.file_number }));
        }
        case "document": {
          const { data } = await supabase
            .from("documents")
            .select("id, title")
            .eq("tenant_id", tenantId)
            .ilike("title", `%${searchTerm}%`)
            .limit(10);
          return (data ?? []).map((d: Record<string, any>) => ({ id: d.id, label: d.title, sub: null }));
        }
        default:
          return [];
      }
    },
  });

  const handleLink = (linkedId: string) => {
    createLink.mutate(
      { dossier_id: dossierId, linked_type: linkType, linked_id: linkedId },
      { onSuccess: () => { setSearchTerm(""); setOpen(false); } }
    );
  };

  // Resolve linked item names
  const linkedItemIds = links?.map((l) => l.linked_id) ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Link2 className="h-4 w-4" /> Verknüpfungen
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5" /> Verknüpfen</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Verknüpfung hinzufügen</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={linkType} onValueChange={(v) => { setLinkType(v); setSearchTerm(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LINK_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Suchen …"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchResults && searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {searchResults.map((r: Record<string, any>) => (
                    <button
                      key={r.id}
                      onClick={() => handleLink(r.id)}
                      disabled={linkedItemIds.includes(r.id)}
                      className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors disabled:opacity-40"
                    >
                      <span className="font-medium">{r.label}</span>
                      {r.sub && <span className="ml-2 text-xs text-muted-foreground">{r.sub}</span>}
                    </button>
                  ))}
                </div>
              )}
              {searchTerm.length >= 2 && searchResults?.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Keine Ergebnisse</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Loader2 className="animate-spin h-5 w-5 text-muted-foreground mx-auto" />
      ) : !links?.length ? (
        <p className="text-xs text-muted-foreground">Keine Verknüpfungen</p>
      ) : (
        <div className="space-y-1">
          {links.map((link) => {
            const config = getLinkTypeConfig(link.linked_type);
            const Icon = config.icon;
            return (
              <div key={link.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">
                  <LinkedItemName linkedType={link.linked_type} linkedId={link.linked_id} />
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(link.created_at), { addSuffix: true, locale: de })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => deleteLink.mutate({ id: link.id, dossierId })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Resolves a linked item's display name */
function LinkedItemName({ linkedType, linkedId }: { linkedType: string; linkedId: string }) {
  const { data: name } = useQuery({
    queryKey: ["dossier-linked-name", linkedType, linkedId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      switch (linkedType) {
        case "contact": {
          const { data } = await supabase.from("contacts").select("name").eq("id", linkedId).maybeSingle();
          return data?.name ?? linkedId;
        }
        case "task": {
          const { data } = await supabase.from("tasks").select("title").eq("id", linkedId).maybeSingle();
          return data?.title ?? linkedId;
        }
        case "appointment": {
          const { data } = await supabase.from("appointments").select("title").eq("id", linkedId).maybeSingle();
          return data?.title ?? linkedId;
        }
        case "case_file": {
          const { data } = await supabase.from("case_files").select("title").eq("id", linkedId).maybeSingle();
          return data?.title ?? linkedId;
        }
        case "document": {
          const { data } = await supabase.from("documents").select("title").eq("id", linkedId).maybeSingle();
          return data?.title ?? linkedId;
        }
        default:
          return linkedId;
      }
    },
  });
  return <>{name ?? linkedId}</>;
}
