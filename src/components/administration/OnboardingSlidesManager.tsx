import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Eye, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { OnboardingDialog } from "@/components/onboarding/OnboardingDialog";
import { DEFAULT_SLIDES, type OnboardingSlide } from "@/hooks/useOnboardingGate";

type Row = {
  id: string;
  tenant_id: string;
  position: number;
  title: string;
  body: string;
  icon: string | null;
  accent: string | null;
  active: boolean;
};

const ICON_CHOICES = [
  "Building2", "Sparkles", "Megaphone", "Users", "BookOpen",
  "MessageCircle", "Phone", "Mail", "Calendar", "FileText",
  "ShieldCheck", "Lightbulb", "Heart", "Flag", "Star",
];

export function OnboardingSlidesManager(): React.JSX.Element {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Row>>({});
  const [previewOpen, setPreviewOpen] = useState(false);

  const tenantId = currentTenant?.id ?? null;

  const load = async (): Promise<void> => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("tenant_onboarding_slides")
      .select("id,tenant_id,position,title,body,icon,accent,active")
      .eq("tenant_id", tenantId)
      .order("position", { ascending: true });
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const startEdit = (row?: Row): void => {
    if (row) {
      setEditingId(row.id);
      setDraft({ ...row });
    } else {
      setEditingId("new");
      setDraft({
        title: "",
        body: "",
        icon: "Building2",
        accent: "#155EEF",
        active: true,
        position: rows.length,
      });
    }
  };

  const cancelEdit = (): void => {
    setEditingId(null);
    setDraft({});
  };

  const save = async (): Promise<void> => {
    if (!tenantId) return;
    if (!draft.title?.trim()) {
      toast({ title: "Titel fehlt", variant: "destructive" });
      return;
    }
    if (editingId === "new") {
      const { error } = await supabase.from("tenant_onboarding_slides").insert({
        tenant_id: tenantId,
        title: draft.title.trim(),
        body: draft.body?.trim() ?? "",
        icon: draft.icon ?? "Building2",
        accent: draft.accent ?? "#155EEF",
        active: draft.active ?? true,
        position: draft.position ?? rows.length,
      });
      if (error) {
        toast({ title: "Fehler", description: error.message, variant: "destructive" });
        return;
      }
    } else if (editingId) {
      const { error } = await supabase
        .from("tenant_onboarding_slides")
        .update({
          title: draft.title.trim(),
          body: draft.body?.trim() ?? "",
          icon: draft.icon ?? "Building2",
          accent: draft.accent ?? "#155EEF",
          active: draft.active ?? true,
        })
        .eq("id", editingId);
      if (error) {
        toast({ title: "Fehler", description: error.message, variant: "destructive" });
        return;
      }
    }
    cancelEdit();
    await load();
    toast({ title: "Gespeichert" });
  };

  const remove = async (id: string): Promise<void> => {
    if (!confirm("Slide wirklich löschen?")) return;
    const { error } = await supabase.from("tenant_onboarding_slides").delete().eq("id", id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    await load();
  };

  const move = async (id: string, dir: -1 | 1): Promise<void> => {
    const idx = rows.findIndex((r) => r.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= rows.length) return;
    const a = rows[idx];
    const b = rows[target];
    await supabase.from("tenant_onboarding_slides").update({ position: b.position }).eq("id", a.id);
    await supabase.from("tenant_onboarding_slides").update({ position: a.position }).eq("id", b.id);
    await load();
  };

  const toggleActive = async (row: Row): Promise<void> => {
    await supabase.from("tenant_onboarding_slides").update({ active: !row.active }).eq("id", row.id);
    await load();
  };

  const previewSlides: OnboardingSlide[] = [
    ...DEFAULT_SLIDES,
    ...rows.filter((r) => r.active).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      icon: r.icon || "Building2",
      accent: r.accent || "#155EEF",
      source: "tenant" as const,
      tenantName: currentTenant?.name ?? "",
    })),
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Büro-Onboarding</CardTitle>
            <CardDescription>
              Ergänze die allgemeinen Einführungsslides um eigene Inhalte für dein Büro. Diese erscheinen am Ende der Onboarding-Sequenz für alle Mitglieder.
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
              <Eye className="w-4 h-4 mr-2" />
              Vorschau
            </Button>
            <Button size="sm" onClick={() => startEdit()}>
              <Plus className="w-4 h-4 mr-2" />
              Slide hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine büro-spezifischen Slides. Nutzer:innen sehen aktuell nur die Standard-Einführung.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div
                  key={row.id}
                  className="flex items-start gap-3 rounded-lg border bg-card p-3"
                >
                  <div
                    className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-semibold"
                    style={{ backgroundColor: row.accent || "#155EEF" }}
                  >
                    {row.position + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{row.title}</span>
                      {!row.active && <Badge variant="secondary">Inaktiv</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{row.body || "—"}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={row.active} onCheckedChange={() => toggleActive(row)} aria-label="Aktiv" />
                    <Button variant="ghost" size="icon" onClick={() => move(row.id, -1)} disabled={i === 0}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => move(row.id, 1)} disabled={i === rows.length - 1}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(row)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(row.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editingId && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-lg">{editingId === "new" ? "Neuer Slide" : "Slide bearbeiten"}</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={cancelEdit}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ob-title">Titel</Label>
              <Input
                id="ob-title"
                value={draft.title ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="z. B. Unsere Bürozeiten"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-body">Text</Label>
              <Textarea
                id="ob-body"
                value={draft.body ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                rows={4}
                placeholder="Kurz und konkret – ein bis drei Sätze."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ob-icon">Icon</Label>
                <select
                  id="ob-icon"
                  value={draft.icon ?? "Building2"}
                  onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {ICON_CHOICES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-accent">Akzentfarbe</Label>
                <Input
                  id="ob-accent"
                  type="color"
                  value={draft.accent ?? "#155EEF"}
                  onChange={(e) => setDraft((d) => ({ ...d, accent: e.target.value }))}
                  className="h-10 w-full"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="ob-active"
                checked={draft.active ?? true}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, active: v }))}
              />
              <Label htmlFor="ob-active" className="cursor-pointer">Aktiv</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={cancelEdit}>Abbrechen</Button>
              <Button onClick={save}>
                <Save className="w-4 h-4 mr-2" />
                Speichern
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <OnboardingDialog
        open={previewOpen}
        slides={previewSlides}
        onComplete={() => setPreviewOpen(false)}
        onSkip={() => setPreviewOpen(false)}
      />
    </div>
  );
}
