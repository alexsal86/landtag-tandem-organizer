import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarPlus, ExternalLink, MapPin, CheckSquare, Calendar, CheckCircle, Archive, ChevronDown, ChevronUp, Clock, Plus, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { EventPlanningCollaborationRow, EventPlanningRow, PlanningCard } from "@/components/my-work/types";

export function MyWorkPlanungsKartenSection() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [plannings, setPlannings] = useState<PlanningCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlanningIds, setExpandedPlanningIds] = useState<Set<string>>(new Set());
  const [newChecklistTitles, setNewChecklistTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) void loadPlannings();
  }, [user]);

  useEffect(() => {
    if (!user?.id || !currentTenant?.id) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => { timeout = null; void loadPlannings(); }, 250);
    };
    const channel = supabase
      .channel(`my-work-planungen-karten-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_plannings", filter: `tenant_id=eq.${currentTenant.id}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_planning_checklist_items" }, scheduleRefresh)
      .subscribe();
    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [user?.id, currentTenant?.id]);

  const normalizePlanningCard = (planning: EventPlanningRow, isCollaborator: boolean): PlanningCard => {
    const checklistItems = (planning.event_planning_checklist_items ?? [])
      .map((item) => ({
        id: item.id,
        title: item.title,
        is_completed: Boolean(item.is_completed),
        order_index: item.order_index ?? 0,
      }))
      .sort((a, b) => a.order_index - b.order_index);

    return {
      id: planning.id,
      title: planning.title,
      description: planning.description,
      location: planning.location,
      confirmed_date: planning.confirmed_date,
      created_at: planning.created_at,
      user_id: planning.user_id,
      isCollaborator,
      is_completed: Boolean(planning.is_completed),
      checklistProgress: {
        completed: checklistItems.filter((item) => item.is_completed).length,
        total: checklistItems.length,
      },
      checklistItems,
    };
  };

  const loadPlannings = async () => {
    if (!user) return;
    try {
      const { data: ownPlannings, error: ownError } = await supabase
        .from("event_plannings")
        .select(`id, title, description, location, confirmed_date, created_at, user_id, is_completed,
          event_planning_checklist_items (id, title, is_completed, order_index)`)
        .eq("user_id", user.id)
        .or("is_archived.is.null,is_archived.eq.false")
        .order("created_at", { ascending: false })
        .limit(10);
      if (ownError) throw ownError;

      const { data: collaborations, error: collabError } = await supabase
        .from("event_planning_collaborators")
        .select(`event_planning_id, event_plannings (id, title, description, location, confirmed_date, created_at, user_id, is_completed, is_archived,
          event_planning_checklist_items (id, title, is_completed, order_index))`)
        .eq("user_id", user.id);
      if (collabError) throw collabError;

      const ownPlanningRows = (ownPlannings ?? []) as EventPlanningRow[];
      const collaborationRows = (collaborations ?? []) as EventPlanningCollaborationRow[];

      const allPlannings = new Map<string, PlanningCard>();
      ownPlanningRows.forEach((planning) => allPlannings.set(planning.id, normalizePlanningCard(planning, false)));
      collaborationRows
        .filter((collaboration) =>
          collaboration.event_plannings &&
          collaboration.event_plannings.user_id !== user.id &&
          !collaboration.event_plannings.is_archived,
        )
        .forEach((collaboration) => {
          const planning = collaboration.event_plannings;
          if (!planning || allPlannings.has(planning.id)) return;
          allPlannings.set(planning.id, normalizePlanningCard(planning, true));
        });

      const sorted = Array.from(allPlannings.values()).sort((a, b) => {
        if ((a.is_completed || false) !== (b.is_completed || false)) return a.is_completed ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setPlannings(sorted);
    } catch (error) {
      debugConsole.error("Error loading plannings:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDetails = (planningId: string) => {
    setExpandedPlanningIds((prev) => {
      const next = new Set(prev);
      next.has(planningId) ? next.delete(planningId) : next.add(planningId);
      return next;
    });
  };

  const addChecklistItem = async (planning: PlanningCard) => {
    const title = (newChecklistTitles[planning.id] || "").trim();
    if (!title) return;
    try {
      const maxOrderIndex = planning.checklistItems.reduce((max, item) => Math.max(max, item.order_index ?? 0), 0);
      const { error } = await supabase.from("event_planning_checklist_items").insert([{ event_planning_id: planning.id, title, order_index: maxOrderIndex + 1, is_completed: false }]);
      if (error) throw error;
      setNewChecklistTitles((prev) => ({ ...prev, [planning.id]: "" }));
      toast({ title: "Checklisten-Eintrag hinzugefügt" });
      await loadPlannings();
    } catch (error) {
      debugConsole.error("Error adding checklist item:", error);
      toast({ title: "Fehler beim Hinzufügen", variant: "destructive" });
    }
  };

  const toggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase.from("event_planning_checklist_items").update({ is_completed: isCompleted }).eq("id", itemId);
      if (error) throw error;
      await loadPlannings();
    } catch (error) {
      debugConsole.error("Error toggling checklist item:", error);
      toast({ title: "Fehler beim Aktualisieren", variant: "destructive" });
    }
  };

  const toggleCompleted = async (planningId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase.from("event_plannings").update({ is_completed: isCompleted, completed_at: isCompleted ? new Date().toISOString() : null }).eq("id", planningId).select();
      if (error) throw error;
      toast({ title: isCompleted ? "Planung als erledigt markiert" : "Markierung entfernt" });
      loadPlannings();
    } catch (error) {
      debugConsole.error("Error toggling completed:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const archivePlanning = async (planningId: string) => {
    try {
      const { error } = await supabase.from("event_plannings").update({ is_archived: true, archived_at: new Date().toISOString() }).eq("id", planningId).select();
      if (error) throw error;
      toast({ title: "Planung archiviert" });
      loadPlannings();
    } catch (error) {
      debugConsole.error("Error archiving planning:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />)}
      </div>
    );
  }

  return (
    <section className="space-y-2 p-4">
      <h3 className="text-sm font-semibold text-foreground">Planungs-Karten</h3>
      {plannings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground rounded-lg border bg-card">
          <CalendarPlus className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Keine Planungen</p>
        </div>
      ) : (
        plannings.map((planning) => (
          <Collapsible key={planning.id} open={expandedPlanningIds.has(planning.id)} onOpenChange={() => toggleDetails(planning.id)}>
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
              <CalendarPlus className="h-4 w-4 mt-1 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("font-bold text-base", planning.is_completed && "line-through text-muted-foreground")}>{planning.title}</span>
                  {planning.isCollaborator && <Badge variant="secondary" className="text-xs">Mitwirkend</Badge>}
                  {planning.is_completed && <Badge variant="outline" className="text-xs text-green-600 border-green-200">Erledigt</Badge>}
                </div>
                {planning.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{planning.description}</p>}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  {planning.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{planning.location}</span>}
                  {planning.confirmed_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(planning.confirmed_date), "dd.MM.yyyy", { locale: de })}</span>}
                  {planning.confirmed_date && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(planning.confirmed_date), "HH:mm", { locale: de })} Uhr</span>}
                  {planning.checklistProgress.total > 0 && (
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" />{planning.checklistProgress.completed}/{planning.checklistProgress.total}</span>
                      <CollapsibleTrigger asChild>
                        <button type="button" className="text-primary hover:underline inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          Details {expandedPlanningIds.has(planning.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      </CollapsibleTrigger>
                    </span>
                  )}
                  {planning.checklistProgress.total === 0 && (
                    <CollapsibleTrigger asChild>
                      <button type="button" className="text-primary hover:underline inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        Details {expandedPlanningIds.has(planning.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </CollapsibleTrigger>
                  )}
                </div>
                <CollapsibleContent className="mt-3 border-t pt-3 space-y-3">
                  {planning.description && (
                    <div><Label className="text-xs text-muted-foreground">Beschreibung</Label><p className="text-sm mt-1">{planning.description}</p></div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">Checkliste</Label>
                    <div className="mt-2 space-y-2">
                      {planning.checklistItems.length > 0 ? (
                        planning.checklistItems.map((item) => (
                          <button key={item.id} type="button" className="text-sm flex items-center gap-2 text-left hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); toggleChecklistItem(item.id, !item.is_completed); }}>
                            {item.is_completed ? <CheckSquare className="h-4 w-4 text-green-600" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                            <span className={cn(item.is_completed && "line-through text-muted-foreground")}>{item.title}</span>
                          </button>
                        ))
                      ) : <p className="text-sm text-muted-foreground">Noch keine Einträge</p>}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Input value={newChecklistTitles[planning.id] || ""} onChange={(e) => setNewChecklistTitles((prev) => ({ ...prev, [planning.id]: e.target.value }))}
                        onClick={(e) => e.stopPropagation()} placeholder="Neuer Checklisten-Eintrag" className="h-8" />
                      <Button type="button" size="sm" onClick={(e) => { e.stopPropagation(); addChecklistItem(planning); }}>
                        <Plus className="h-3.5 w-3.5 mr-1" />Hinzufügen
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {planning.user_id === user?.id && (
                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className={cn("h-7 w-7", planning.is_completed && "text-green-600")}
                      onClick={(e) => { e.stopPropagation(); toggleCompleted(planning.id, !planning.is_completed); }}>
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger><TooltipContent>{planning.is_completed ? "Als unerledigt markieren" : "Als erledigt markieren"}</TooltipContent></Tooltip></TooltipProvider>
                )}
                {planning.user_id === user?.id && (
                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); archivePlanning(planning.id); }}>
                      <Archive className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger><TooltipContent>Archivieren</TooltipContent></Tooltip></TooltipProvider>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/eventplanning/${planning.id}`)}>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Collapsible>
        ))
      )}
    </section>
  );
}
