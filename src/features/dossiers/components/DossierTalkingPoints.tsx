import { useState } from "react";
import { useTalkingPoints, useUpsertTalkingPoint, useDeleteTalkingPoint } from "../hooks/useTalkingPoints";
import type { TalkingPointsContent } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2, Mic, X, Save, Copy } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

interface DossierTalkingPointsProps {
  dossierId: string;
  dossierTitle: string;
}

const EMPTY: TalkingPointsContent = { key_messages: ["", "", ""], qa: [{ q: "", a: "" }], do_not_say: "", sources: "" };

export function DossierTalkingPoints({ dossierId, dossierTitle }: DossierTalkingPointsProps) {
  const { data: list, isLoading } = useTalkingPoints(dossierId);
  const upsert = useUpsertTalkingPoint();
  const remove = useDeleteTalkingPoint();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<TalkingPointsContent>(EMPTY);
  const [isNew, setIsNew] = useState(false);

  const startNew = () => {
    setIsNew(true);
    setEditingId(null);
    setTitle(`Sprechzettel ${format(new Date(), "dd.MM.yyyy", { locale: de })}`);
    setContent({ ...EMPTY, key_messages: ["", "", ""], qa: [{ q: "", a: "" }] });
  };

  const startEdit = (id: string) => {
    const tp = list?.find((t) => t.id === id);
    if (!tp) return;
    setIsNew(false);
    setEditingId(id);
    setTitle(tp.title ?? "");
    setContent({
      key_messages: tp.content.key_messages ?? ["", "", ""],
      qa: tp.content.qa?.length ? tp.content.qa : [{ q: "", a: "" }],
      do_not_say: tp.content.do_not_say ?? "",
      sources: tp.content.sources ?? "",
    });
  };

  const cancel = () => {
    setIsNew(false);
    setEditingId(null);
  };

  const handleSave = () => {
    upsert.mutate(
      { id: editingId ?? undefined, dossier_id: dossierId, title, content },
      { onSuccess: () => cancel() }
    );
  };

  const setKeyMessage = (i: number, v: string) => {
    const km = [...(content.key_messages ?? [])];
    km[i] = v;
    setContent({ ...content, key_messages: km });
  };
  const addKeyMessage = () => setContent({ ...content, key_messages: [...(content.key_messages ?? []), ""] });
  const removeKeyMessage = (i: number) => {
    const km = [...(content.key_messages ?? [])];
    km.splice(i, 1);
    setContent({ ...content, key_messages: km });
  };

  const setQA = (i: number, key: "q" | "a", v: string) => {
    const qa = [...(content.qa ?? [])];
    qa[i] = { ...qa[i], [key]: v };
    setContent({ ...content, qa });
  };
  const addQA = () => setContent({ ...content, qa: [...(content.qa ?? []), { q: "", a: "" }] });
  const removeQA = (i: number) => {
    const qa = [...(content.qa ?? [])];
    qa.splice(i, 1);
    setContent({ ...content, qa });
  };

  const copyToClipboard = async (tp: { title: string | null; content: TalkingPointsContent }) => {
    const lines: string[] = [];
    lines.push(`SPRECHZETTEL: ${tp.title ?? dossierTitle}`);
    lines.push("═".repeat(40));
    if (tp.content.key_messages?.length) {
      lines.push("\nKERNBOTSCHAFTEN");
      tp.content.key_messages.filter(Boolean).forEach((m, i) => lines.push(`${i + 1}. ${m}`));
    }
    if (tp.content.qa?.length) {
      lines.push("\nKRITISCHE FRAGEN & ANTWORTEN");
      tp.content.qa.filter((qa) => qa.q || qa.a).forEach((qa, i) => {
        lines.push(`\nQ${i + 1}: ${qa.q}`);
        lines.push(`A: ${qa.a}`);
      });
    }
    if (tp.content.do_not_say?.trim()) {
      lines.push("\nWAS NICHT SAGEN");
      lines.push(tp.content.do_not_say);
    }
    if (tp.content.sources?.trim()) {
      lines.push("\nQUELLEN");
      lines.push(tp.content.sources);
    }
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Sprechzettel kopiert");
  };

  const isEditing = isNew || editingId !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-1.5">
            <Mic className="h-4 w-4 text-primary" /> Sprechzettel
          </h3>
          <p className="text-xs text-muted-foreground">Kernbotschaften, kritische Fragen, Sprachregelung.</p>
        </div>
        {!isEditing && (
          <Button size="sm" onClick={startNew}><Plus className="h-3.5 w-3.5" /> Neuer Sprechzettel</Button>
        )}
      </div>

      {isEditing && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel" />

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kernbotschaften</p>
            {(content.key_messages ?? []).map((m, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground w-5 mt-2">{i + 1}.</span>
                <Textarea value={m} onChange={(e) => setKeyMessage(i, e.target.value)} className="min-h-[40px] text-sm" placeholder="Botschaft …" />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeKeyMessage(i)}><X className="h-3 w-3" /></Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={addKeyMessage}><Plus className="h-3 w-3" /> Botschaft hinzufügen</Button>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kritische Fragen & Antworten</p>
            {(content.qa ?? []).map((qa, i) => (
              <div key={i} className="space-y-1.5 rounded-md border border-border p-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground w-5 mt-2">F{i + 1}</span>
                  <Input value={qa.q} onChange={(e) => setQA(i, "q", e.target.value)} placeholder="Frage" className="text-sm" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeQA(i)}><X className="h-3 w-3" /></Button>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground w-5 mt-2">A</span>
                  <Textarea value={qa.a} onChange={(e) => setQA(i, "a", e.target.value)} placeholder="Antwort" className="min-h-[60px] text-sm" />
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={addQA}><Plus className="h-3 w-3" /> Frage hinzufügen</Button>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Was nicht sagen</p>
            <Textarea value={content.do_not_say ?? ""} onChange={(e) => setContent({ ...content, do_not_say: e.target.value })} className="min-h-[60px] text-sm" placeholder="Sensible Punkte, vermeiden zu …" />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quellenfußnoten</p>
            <Textarea value={content.sources ?? ""} onChange={(e) => setContent({ ...content, sources: e.target.value })} className="min-h-[60px] text-sm" placeholder="Drucksachen-Nrn., Studien, Statistiken …" />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Speichern
            </Button>
            <Button variant="ghost" onClick={cancel}>Abbrechen</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>
      ) : !list?.length && !isEditing ? (
        <p className="text-sm text-muted-foreground italic text-center py-6">Noch kein Sprechzettel angelegt.</p>
      ) : (
        <div className="space-y-2">
          {list?.map((tp) => (
            <div key={tp.id} className="rounded-md border border-border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm flex-1">{tp.title ?? "Sprechzettel"}</span>
                <span className="text-[11px] text-muted-foreground">
                  {format(new Date(tp.created_at), "dd.MM.yyyy", { locale: de })}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(tp)}>
                  <Copy className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => startEdit(tp.id)}>
                  Bearbeiten
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive" onClick={() => remove.mutate(tp.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {tp.content.key_messages && tp.content.key_messages.filter(Boolean).length > 0 && (
                <ul className="text-sm space-y-0.5 pl-1">
                  {tp.content.key_messages.filter(Boolean).map((m, i) => (
                    <li key={i} className="text-muted-foreground">{i + 1}. {m}</li>
                  ))}
                </ul>
              )}
              {tp.content.qa && tp.content.qa.filter((q) => q.q || q.a).length > 0 && (
                <p className="text-xs text-muted-foreground">{tp.content.qa.filter((q) => q.q || q.a).length} Q&A</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
