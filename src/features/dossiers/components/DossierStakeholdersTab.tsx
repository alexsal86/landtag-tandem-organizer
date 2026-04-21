import { useMemo, useState } from "react";
import { useDossierStakeholders, useUpsertStakeholder, useDeleteStakeholder } from "../hooks/useDossierStakeholders";
import { STAKEHOLDER_STANCE_OPTIONS, type StakeholderStance } from "../types";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Users, Pencil } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface DossierStakeholdersTabProps {
  dossierId: string;
}

interface ContactOption {
  id: string;
  name: string;
  organization: string | null;
}

export function DossierStakeholdersTab({ dossierId }: DossierStakeholdersTabProps) {
  const { data: stakeholders, isLoading } = useDossierStakeholders(dossierId);
  const upsert = useUpsertStakeholder();
  const remove = useDeleteStakeholder();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const { data: contacts } = useQuery({
    queryKey: ["stakeholder-contact-options", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, organization")
        .eq("tenant_id", tenantId!)
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ContactOption[];
    },
  });

  const contactMap = useMemo(() => {
    const m = new Map<string, ContactOption>();
    contacts?.forEach((c) => m.set(c.id, c));
    return m;
  }, [contacts]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [contactId, setContactId] = useState<string>("");
  const [stance, setStance] = useState<StakeholderStance>("unklar");
  const [influence, setInfluence] = useState<number>(3);
  const [note, setNote] = useState<string>("");
  const [search, setSearch] = useState("");

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = contacts ?? [];
    if (!q) return list.slice(0, 100);
    return list
      .filter((c) => c.name.toLowerCase().includes(q) || (c.organization ?? "").toLowerCase().includes(q))
      .slice(0, 100);
  }, [contacts, search]);

  const openNew = () => {
    setEditId(undefined);
    setContactId("");
    setStance("unklar");
    setInfluence(3);
    setNote("");
    setSearch("");
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    const s = stakeholders?.find((x) => x.id === id);
    if (!s) return;
    setEditId(s.id);
    setContactId(s.contact_id);
    setStance(s.stance);
    setInfluence(s.influence);
    setNote(s.note ?? "");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!contactId) return;
    upsert.mutate(
      { id: editId, dossier_id: dossierId, contact_id: contactId, stance, influence, note: note || null },
      { onSuccess: () => setDialogOpen(false) }
    );
  };

  // Quadrant matrix: x = influence (1..5), y = stance (pro top, contra bottom)
  const stanceY: Record<StakeholderStance, number> = { pro: 0.8, neutral: 0.5, unklar: 0.5, contra: 0.2 };
  const stanceColor: Record<StakeholderStance, string> = {
    pro: "fill-emerald-500",
    contra: "fill-rose-500",
    neutral: "fill-muted-foreground",
    unklar: "fill-amber-500",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-1.5">
            <Users className="h-4 w-4 text-primary" /> Akteure
          </h3>
          <p className="text-xs text-muted-foreground">Wer steht wo und wie viel Einfluss hat er/sie?</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5" /> Akteur</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Akteur bearbeiten" : "Akteur hinzufügen"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {!editId && (
                <>
                  <Input
                    placeholder="Kontakt suchen…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Select value={contactId} onValueChange={setContactId}>
                    <SelectTrigger><SelectValue placeholder="Kontakt wählen" /></SelectTrigger>
                    <SelectContent>
                      {filteredContacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.organization ? ` · ${c.organization}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Position</p>
                  <Select value={stance} onValueChange={(v) => setStance(v as StakeholderStance)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAKEHOLDER_STANCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Einfluss (1–5)</p>
                  <Select value={String(influence)} onValueChange={(v) => setInfluence(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea placeholder="Notiz (Forderung, letzte Berührung, …)" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[80px]" />
              <Button onClick={handleSave} disabled={upsert.isPending || !contactId} className="w-full">
                {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Speichern
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quadrant matrix */}
      {stakeholders && stakeholders.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Einfluss × Position
          </p>
          <div className="relative w-full" style={{ aspectRatio: "5 / 2" }}>
            <svg viewBox="0 0 500 200" className="w-full h-full">
              {/* axes */}
              <line x1="0" y1="100" x2="500" y2="100" className="stroke-border" strokeDasharray="2 3" />
              <line x1="0" y1="0" x2="0" y2="200" className="stroke-border" />
              {/* labels */}
              <text x="6" y="14" className="fill-muted-foreground" fontSize="10">Pro</text>
              <text x="6" y="196" className="fill-muted-foreground" fontSize="10">Contra</text>
              <text x="490" y="116" textAnchor="end" className="fill-muted-foreground" fontSize="10">hoher Einfluss →</text>
              {stakeholders.map((s) => {
                const cx = ((s.influence - 0.5) / 5) * 500;
                const cy = (1 - stanceY[s.stance]) * 200;
                const c = contactMap.get(s.contact_id);
                return (
                  <g key={s.id}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={6 + s.influence}
                      className={`${stanceColor[s.stance]} opacity-70`}
                    />
                    <text x={cx + 10} y={cy + 4} fontSize="10" className="fill-foreground">
                      {c?.name ?? "?"}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>
      ) : !stakeholders?.length ? (
        <p className="text-sm text-muted-foreground italic text-center py-6">Noch keine Akteure erfasst.</p>
      ) : (
        <div className="space-y-1.5">
          {stakeholders.map((s) => {
            const c = contactMap.get(s.contact_id);
            const tone = STAKEHOLDER_STANCE_OPTIONS.find((o) => o.value === s.stance)?.tone ?? "";
            return (
              <div key={s.id} className="rounded-md border border-border bg-card p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{c?.name ?? "Unbekannt"}</span>
                    {c?.organization && <span className="text-xs text-muted-foreground">· {c.organization}</span>}
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${tone}`}>
                      {STAKEHOLDER_STANCE_OPTIONS.find((o) => o.value === s.stance)?.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">Einfluss {s.influence}/5</span>
                  </div>
                  {s.note && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{s.note}</p>}
                  {s.last_touch_at && (
                    <p className="text-[11px] text-muted-foreground">
                      Letzte Berührung: {format(new Date(s.last_touch_at), "dd.MM.yyyy", { locale: de })}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s.id)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive" onClick={() => remove.mutate(s.id)}>
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
