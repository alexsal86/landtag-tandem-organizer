import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ArrowLeft, Briefcase, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { classifyCaseScale } from "@/features/cases/shared/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppNavigation, getNavigationGroups } from "@/components/AppNavigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { SubNavigation } from "@/components/layout/SubNavigation";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileSubNavigation } from "@/components/layout/MobileSubNavigation";

type CaseScale = "small" | "large";

type CaseItemRecord = {
  id: string;
  source_channel: "phone" | "email" | "social" | "in_person" | "other";
  status: "active" | "pending" | "closed" | "archived";
  owner_user_id: string | null;
  due_at: string | null;
  follow_up_at: string | null;
  case_file_id: string | null;
  case_scale: CaseScale | null;
  updated_at: string;
};

type CaseFileRecord = {
  id: string;
  title: string;
  case_type: string;
  case_scale: CaseScale | null;
  start_date: string | null;
  target_date: string | null;
  risks_and_opportunities: unknown;
};

const CaseItemDetail = () => {
  const { caseItemId } = useParams<{ caseItemId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();

  const [caseItem, setCaseItem] = useState<CaseItemRecord | null>(null);
  const [caseFile, setCaseFile] = useState<CaseFileRecord | null>(null);
  const [timelineEntries, setTimelineEntries] = useState<Array<{ id: string; created_at: string; summary: string | null }>>([]);
  const [taskLinks, setTaskLinks] = useState<Array<{ task_id: string }>>([]);
  const [stakeholderLinks, setStakeholderLinks] = useState<Array<{ id: string }>>([]);
  const [assignableFiles, setAssignableFiles] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedCaseFileId, setSelectedCaseFileId] = useState<string>("");
  const [newCaseFileTitle, setNewCaseFileTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const activeSection = "mywork";
  const navGroups = useMemo(() => getNavigationGroups(), []);
  const activeGroup = useMemo(
    () =>
      navGroups.find(
        (g) =>
          g.subItems?.some((item) => item.id === activeSection) ||
          (g.route && g.route.slice(1) === activeSection) ||
          g.id === activeSection,
      ),
    [navGroups],
  );

  const mode = useMemo(() => {
    if (!caseItem) return "compact" as const;
    const scale = classifyCaseScale({
      explicitScale: caseItem.case_scale ?? caseFile?.case_scale,
      caseType: caseFile?.case_type,
    });
    return scale === "large" ? ("extended" as const) : ("compact" as const);
  }, [caseItem, caseFile]);

  const isLarge = mode === "extended";

  const loadData = async () => {
    if (!caseItemId || !currentTenant) return;
    setLoading(true);

    const { data: caseItemData } = await supabase
      .from("case_items")
      .select("id, source_channel, status, owner_user_id, due_at, follow_up_at, case_file_id, case_scale, updated_at")
      .eq("tenant_id", currentTenant.id)
      .eq("id", caseItemId)
      .maybeSingle();

    const ci = (caseItemData as CaseItemRecord | null) ?? null;
    setCaseItem(ci);

    const [{ data: files }, { data: itemTimeline }] = await Promise.all([
      supabase.from("case_files").select("id, title").eq("tenant_id", currentTenant.id).in("status", ["active", "pending"]).order("updated_at", { ascending: false }).limit(20),
      supabase.from("case_item_interactions").select("id, created_at, summary").eq("case_item_id", caseItemId).order("created_at", { ascending: false }).limit(20),
    ]);

    setAssignableFiles(files ?? []);
    setTimelineEntries(itemTimeline ?? []);

    if (ci?.case_file_id) {
      const [{ data: cf }, { data: links }, { data: stakeholders }] = await Promise.all([
        supabase
          .from("case_files")
          .select("id, title, case_type, case_scale, start_date, target_date, risks_and_opportunities")
          .eq("id", ci.case_file_id)
          .maybeSingle(),
        supabase.from("case_file_tasks").select("task_id").eq("case_file_id", ci.case_file_id),
        supabase.from("case_file_contacts").select("id").eq("case_file_id", ci.case_file_id),
      ]);

      setCaseFile((cf as CaseFileRecord | null) ?? null);
      setTaskLinks(links ?? []);
      setStakeholderLinks(stakeholders ?? []);
    } else {
      setCaseFile(null);
      setTaskLinks([]);
      setStakeholderLinks([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (authLoading || tenantLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    loadData();
  }, [caseItemId, user, currentTenant, authLoading, tenantLoading]);

  const assignCaseFile = async (caseFileId: string) => {
    if (!caseItem) return;

    await supabase.from("case_items").update({ case_file_id: caseFileId, case_scale: "large" }).eq("id", caseItem.id);
    await supabase.from("case_files").update({ case_scale: "large" }).eq("id", caseFileId).is("case_scale", null);
    await loadData();
  };

  const createAndAssignLargeCaseFile = async () => {
    if (!caseItem || !currentTenant || !user || !newCaseFileTitle.trim()) return;

    const { data } = await supabase
      .from("case_files")
      .insert({
        tenant_id: currentTenant.id,
        user_id: user.id,
        title: newCaseFileTitle.trim(),
        status: "active",
        case_type: "general",
        case_scale: "large",
      })
      .select("id")
      .single();

    if (data?.id) {
      await assignCaseFile(data.id);
      setNewCaseFileTitle("");
    }
  };

  const handleScaleToggle = async (nextLarge: boolean) => {
    if (!caseItem) return;

    if (!nextLarge) {
      await supabase.from("case_items").update({ case_scale: "small" }).eq("id", caseItem.id);
      await loadData();
      return;
    }

    if (caseItem.case_file_id) {
      await assignCaseFile(caseItem.case_file_id);
      return;
    }

    await supabase.from("case_items").update({ case_scale: "large" }).eq("id", caseItem.id);
    await loadData();
  };

  const handleSectionChange = (section: string) => navigate(section === "dashboard" ? "/" : `/${section}`);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <div className="hidden md:block sticky top-0 h-screen z-30">
          <AppNavigation activeSection={activeSection} onSectionChange={handleSectionChange} />
        </div>
        <div className="flex flex-col flex-1 overflow-y-auto h-screen">
          <div className="hidden md:block sticky top-0 z-40">
            <AppHeader />
            {activeGroup?.subItems && activeGroup.subItems.length > 1 ? (
              <SubNavigation items={activeGroup.subItems} activeItem={activeSection} onItemChange={handleSectionChange} />
            ) : null}
          </div>
          <MobileHeader />
          <div className="md:hidden">
            {activeGroup?.subItems && activeGroup.subItems.length > 1 ? (
              <MobileSubNavigation items={activeGroup.subItems} activeItem={activeSection} onItemChange={handleSectionChange} />
            ) : null}
          </div>

          <main className="flex-1 p-4 md:p-6 bg-gradient-to-b from-background to-muted/20">
            {loading || authLoading || tenantLoading ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : !caseItem ? (
              <Card className="max-w-2xl mx-auto mt-8">
                <CardHeader><CardTitle>Vorgang nicht gefunden</CardTitle></CardHeader>
              </Card>
            ) : (
              <div className="max-w-5xl mx-auto space-y-4">
                <Button variant="outline" onClick={() => navigate("/mywork")}> <ArrowLeft className="h-4 w-4 mr-2" /> Zurück</Button>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" /> Vorgang {caseItem.id.slice(0, 8)}</CardTitle>
                    <Badge variant={isLarge ? "default" : "secondary"}>{isLarge ? "extended" : "compact"}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Button variant={isLarge ? "secondary" : "outline"} onClick={() => handleScaleToggle(false)}>Als kleinen Vorgang behandeln</Button>
                      <Button variant={isLarge ? "outline" : "secondary"} onClick={() => handleScaleToggle(true)}>Als große Akte behandeln</Button>
                    </div>

                    {isLarge && !caseItem.case_file_id ? (
                      <div className="grid gap-4 md:grid-cols-2 border rounded-lg p-3">
                        <div className="space-y-2">
                          <Label>Bestehende Akte zuordnen</Label>
                          <Select value={selectedCaseFileId} onValueChange={setSelectedCaseFileId}>
                            <SelectTrigger><SelectValue placeholder="Akte wählen" /></SelectTrigger>
                            <SelectContent>
                              {assignableFiles.map((cf) => <SelectItem key={cf.id} value={cf.id}>{cf.title}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button disabled={!selectedCaseFileId} onClick={() => assignCaseFile(selectedCaseFileId)}>Zuordnen</Button>
                        </div>
                        <div className="space-y-2">
                          <Label>Oder neue Akte erstellen</Label>
                          <Input value={newCaseFileTitle} onChange={(e) => setNewCaseFileTitle(e.target.value)} placeholder="Titel der Akte" />
                          <Button disabled={!newCaseFileTitle.trim()} onClick={createAndAssignLargeCaseFile}>Akte erstellen & verknüpfen</Button>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card><CardHeader><CardTitle>Status</CardTitle></CardHeader><CardContent>{caseItem.status}</CardContent></Card>
                  <Card><CardHeader><CardTitle>Owner</CardTitle></CardHeader><CardContent>{caseItem.owner_user_id ?? "Nicht zugewiesen"}</CardContent></Card>
                  <Card><CardHeader><CardTitle>Timeline</CardTitle></CardHeader><CardContent>{timelineEntries.length} Einträge</CardContent></Card>
                  <Card><CardHeader><CardTitle>Aufgaben</CardTitle></CardHeader><CardContent>{taskLinks.length} verknüpft</CardContent></Card>
                </div>

                {isLarge ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card><CardHeader><CardTitle>Stakeholder</CardTitle></CardHeader><CardContent>{stakeholderLinks.length} Kontakte verknüpft</CardContent></Card>
                    <Card><CardHeader><CardTitle>Risiken</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{caseFile?.risks_and_opportunities ? JSON.stringify(caseFile.risks_and_opportunities) : "Noch keine Risiken/Chancen gepflegt"}</CardContent></Card>
                    <Card><CardHeader><CardTitle>Meilensteine</CardTitle></CardHeader><CardContent className="text-sm">Start: {caseFile?.start_date ?? "-"}<br />Ziel: {caseFile?.target_date ?? "-"}</CardContent></Card>
                  </div>
                ) : null}
              </div>
            )}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default CaseItemDetail;
