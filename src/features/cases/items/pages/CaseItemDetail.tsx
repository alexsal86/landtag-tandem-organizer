import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Archive, ArrowLeft, Briefcase, CalendarClock, CheckSquare, Clock3, Loader2, MessageSquareText, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { classifyCaseScale } from "@/features/cases/shared/utils";
import { useCaseFileDetails } from "@/features/cases/files/hooks";
import {
  CaseFileAppointmentsTab,
  CaseFileContactsTab,
  CaseFileDocumentsTab,
  CaseFileLettersTab,
  CaseFileTasksTab,
  CaseFileTimelineTab,
} from "@/features/cases/files/components/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppNavigation, getNavigationGroups } from "@/components/navigation/AppNavigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { SubNavigation } from "@/components/layout/SubNavigation";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { MobileSubNavigation } from "@/components/layout/MobileSubNavigation";

type CaseScale = "small" | "large";

type TimelineEntry = { id: string; created_at: string; subject: string | null };

type CaseItemRecord = {
  id: string;
  source_channel: "phone" | "email" | "social" | "in_person" | "other";
  status: "neu" | "in_klaerung" | "antwort_ausstehend" | "erledigt" | "archiviert";
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

const CASE_ITEM_STATUS_META: Record<CaseItemRecord["status"], { label: string; className: string }> = {
  neu: { label: "Neu", className: "border-sky-500/40 text-sky-700 bg-sky-500/10" },
  in_klaerung: { label: "In Klärung", className: "border-amber-500/40 text-amber-700 bg-amber-500/10" },
  antwort_ausstehend: { label: "Antwort ausstehend", className: "border-violet-500/40 text-violet-700 bg-violet-500/10" },
  erledigt: { label: "Erledigt", className: "border-emerald-500/40 text-emerald-700 bg-emerald-500/10" },
  archiviert: { label: "Archiviert", className: "border-slate-400/40 text-slate-600 bg-slate-400/10" },
};

const CaseItemDetail = () => {
  const { caseItemId } = useParams<{ caseItemId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { toast } = useToast();

  const [caseItem, setCaseItem] = useState<CaseItemRecord | null>(null);
  const [caseFile, setCaseFile] = useState<CaseFileRecord | null>(null);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [assignableFiles, setAssignableFiles] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedCaseFileId, setSelectedCaseFileId] = useState<string>("");
  const [newCaseFileTitle, setNewCaseFileTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const requestedCaseFileId = searchParams.get("caseFileId");
  const allowedFocusSections = ["timeline", "contacts", "documents", "tasks", "appointments", "letters"] as const;
  const focusSection = allowedFocusSections.includes((searchParams.get("focus") || "timeline") as (typeof allowedFocusSections)[number])
    ? (searchParams.get("focus") as (typeof allowedFocusSections)[number]) || "timeline"
    : "timeline";

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
  const activeCaseFileId = requestedCaseFileId || caseItem?.case_file_id || null;
  const caseFileDetails = useCaseFileDetails(activeCaseFileId);

  const compactFacts = useMemo(() => {
    if (!caseItem) return [];
    const latestInteraction = timelineEntries[0]?.created_at
      ? new Date(timelineEntries[0].created_at).toLocaleString("de-DE")
      : "Noch keine Interaktion";

    return [
      {
        key: "eingang",
        title: "Eingang",
        value: caseItem.source_channel,
        icon: MessageSquareText,
      },
      {
        key: "naechste-aktion",
        title: "Nächste Aktion",
        value: caseItem.follow_up_at ? `Follow-up am ${new Date(caseItem.follow_up_at).toLocaleDateString("de-DE")}` : "Follow-up setzen",
        icon: CheckSquare,
      },
      {
        key: "frist",
        title: "Frist",
        value: caseItem.due_at ? new Date(caseItem.due_at).toLocaleDateString("de-DE") : "Keine Frist",
        icon: CalendarClock,
      },
      {
        key: "letzte-interaktion",
        title: "Letzte Interaktion",
        value: latestInteraction,
        icon: Clock3,
      },
    ];
  }, [caseItem, timelineEntries]);

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
      supabase.from("case_item_interactions").select("id, created_at, subject").eq("case_item_id", caseItemId).order("created_at", { ascending: false }).limit(20),
    ]);

    setAssignableFiles(files ?? []);
    setTimelineEntries((itemTimeline ?? []) as TimelineEntry[]);

    if (ci?.case_file_id) {
      const { data: cf } = await supabase
        .from("case_files")
        .select("id, title, case_type, case_scale, start_date, target_date, risks_and_opportunities")
        .eq("id", ci.case_file_id)
        .maybeSingle();

      setCaseFile((cf as CaseFileRecord | null) ?? null);
    } else {
      setCaseFile(null);
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
      .insert([{
        tenant_id: currentTenant.id,
        user_id: user.id,
        title: newCaseFileTitle.trim(),
        status: "active",
        case_type: "general",
        case_scale: "large",
      }])
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

  const handleFocusChange = (focus: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("focus", focus);
    if (activeCaseFileId) next.set("caseFileId", activeCaseFileId);
    setSearchParams(next, { replace: true });
  };

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
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => navigate("/mywork")}> <ArrowLeft className="h-4 w-4 mr-2" /> Zurück</Button>
                  {caseItem.status === "archiviert" ? (
                    <Button variant="outline" onClick={async () => {
                      await supabase.from("case_items").update({ status: "neu" }).eq("id", caseItem.id);
                      toast({ title: "Wiederhergestellt", description: "Vorgang wurde wiederhergestellt." });
                      loadData();
                    }}>
                      <RotateCcw className="h-4 w-4 mr-2" /> Wiederherstellen
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={async () => {
                      await supabase.from("case_items").update({ status: "archiviert" }).eq("id", caseItem.id);
                      toast({ title: "Archiviert", description: "Vorgang wurde archiviert." });
                      navigate("/mywork");
                    }}>
                      <Archive className="h-4 w-4 mr-2" /> Archivieren
                    </Button>
                  )}
                </div>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" /> Vorgang {caseItem.id.slice(0, 8)}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={CASE_ITEM_STATUS_META[caseItem.status].className}>
                        Phase: {CASE_ITEM_STATUS_META[caseItem.status].label}
                      </Badge>
                      <Badge variant={isLarge ? "default" : "secondary"}>{isLarge ? "extended" : "compact"}</Badge>
                    </div>
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

                    {activeCaseFileId ? (
                      <div className="text-xs text-muted-foreground">
                        Deep-Link: <code>caseItemId={caseItem.id}</code> · <code>caseFileId={activeCaseFileId}</code> · <code>focus={focusSection}</code>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Deep-Link: <code>caseItemId={caseItem.id}</code> · <code>focus={focusSection}</code>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {!isLarge ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {compactFacts.map((fact) => {
                      const Icon = fact.icon;
                      return (
                        <Card key={fact.key}>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4" /> {fact.title}</CardTitle>
                          </CardHeader>
                          <CardContent>{fact.value}</CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : !activeCaseFileId ? (
                  <Card>
                    <CardHeader><CardTitle>Akte verknüpfen</CardTitle></CardHeader>
                    <CardContent className="text-sm text-muted-foreground">Für den großen Detailmodus zuerst eine Akte zuordnen oder erstellen.</CardContent>
                  </Card>
                ) : (
                  <Tabs value={focusSection} onValueChange={handleFocusChange} className="space-y-4">
                    <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto gap-1">
                      <TabsTrigger value="timeline">Timeline</TabsTrigger>
                      <TabsTrigger value="contacts">Kontakte</TabsTrigger>
                      <TabsTrigger value="documents">Dokumente</TabsTrigger>
                      <TabsTrigger value="tasks">Aufgaben</TabsTrigger>
                      <TabsTrigger value="appointments">Termine</TabsTrigger>
                      <TabsTrigger value="letters">Briefe</TabsTrigger>
                    </TabsList>

                    <TabsContent value="timeline"><CaseFileTimelineTab timeline={caseFileDetails.timeline} onAddEntry={caseFileDetails.addTimelineEntry} onDeleteEntry={caseFileDetails.deleteTimelineEntry} /></TabsContent>
                    <TabsContent value="contacts"><CaseFileContactsTab contacts={caseFileDetails.contacts} onAdd={caseFileDetails.addContact} onRemove={caseFileDetails.removeContact} /></TabsContent>
                    <TabsContent value="documents"><CaseFileDocumentsTab documents={caseFileDetails.documents} onAdd={caseFileDetails.addDocument} onRemove={caseFileDetails.removeDocument} /></TabsContent>
                    <TabsContent value="tasks"><CaseFileTasksTab tasks={caseFileDetails.tasks} onAdd={caseFileDetails.addTask} onRemove={caseFileDetails.removeTask} /></TabsContent>
                    <TabsContent value="appointments"><CaseFileAppointmentsTab appointments={caseFileDetails.appointments} onAdd={caseFileDetails.addAppointment} onRemove={caseFileDetails.removeAppointment} /></TabsContent>
                    <TabsContent value="letters"><CaseFileLettersTab letters={caseFileDetails.letters} onAdd={caseFileDetails.addLetter} onRemove={caseFileDetails.removeLetter} /></TabsContent>
                  </Tabs>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default CaseItemDetail;
