import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarPlus, ExternalLink, MapPin, CheckSquare, Calendar, CheckCircle, Archive, ChevronDown, ChevronUp, Clock, Plus, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Planning {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  confirmed_date: string | null;
  created_at: string;
  user_id: string;
  isCollaborator: boolean;
  is_completed?: boolean;
  checklistProgress: {
    completed: number;
    total: number;
  };
  checklistItems: {
    id: string;
    title: string;
    is_completed: boolean;
    order_index: number;
  }[];
}

export function MyWorkPlanningsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlanningIds, setExpandedPlanningIds] = useState<Set<string>>(new Set());
  const [newChecklistTitles, setNewChecklistTitles] = useState<Record<string, string>>({});

  // Handle action parameter from URL
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-eventplanning') {
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
      navigate('/eventplanning?action=create');
    }
  }, [searchParams, setSearchParams, navigate]);

  useEffect(() => {
    if (user) {
      loadPlannings();
    }
  }, [user]);

  const loadPlannings = async () => {
    if (!user) return;
    
    try {
      // Load plannings where user is owner
      const { data: ownPlannings, error: ownError } = await supabase
        .from("event_plannings")
        .select(`
          id,
          title,
          description,
          location,
          confirmed_date,
          created_at,
          user_id,
          is_completed,
          event_planning_checklist_items (
            id,
            title,
            is_completed,
            order_index
          )
        `)
        .eq("user_id", user.id)
        .or("is_archived.is.null,is_archived.eq.false")
        .order("created_at", { ascending: false })
        .limit(10);

      if (ownError) throw ownError;

      // Load plannings where user is collaborator
      const { data: collaborations, error: collabError } = await supabase
        .from("event_planning_collaborators")
        .select(`
          event_planning_id,
          event_plannings (
            id,
            title,
            description,
            location,
            confirmed_date,
            created_at,
            user_id,
            is_completed,
            is_archived,
            event_planning_checklist_items (
              id,
              title,
              is_completed,
              order_index
            )
          )
        `)
        .eq("user_id", user.id);

      if (collabError) throw collabError;

      // Format own plannings
      const formattedOwn: Planning[] = (ownPlannings || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        location: p.location,
        confirmed_date: p.confirmed_date,
        created_at: p.created_at,
        user_id: p.user_id,
        isCollaborator: false,
        is_completed: p.is_completed ?? false,
        checklistProgress: {
          completed: (p.event_planning_checklist_items || []).filter((i: any) => i.is_completed).length,
          total: (p.event_planning_checklist_items || []).length,
        },
        checklistItems: (p.event_planning_checklist_items || [])
          .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
          .map((item: any) => ({
            id: item.id,
            title: item.title,
            is_completed: item.is_completed,
            order_index: item.order_index ?? 0,
          })),
      }));

      // Format collaboration plannings (filter out archived)
      const formattedCollab: Planning[] = (collaborations || [])
        .filter((c: any) => c.event_plannings && c.event_plannings.user_id !== user.id && !c.event_plannings.is_archived)
        .map((c: any) => ({
          id: c.event_plannings.id,
          title: c.event_plannings.title,
          description: c.event_plannings.description,
          location: c.event_plannings.location,
          confirmed_date: c.event_plannings.confirmed_date,
          created_at: c.event_plannings.created_at,
          user_id: c.event_plannings.user_id,
          isCollaborator: true,
          is_completed: c.event_plannings.is_completed ?? false,
          checklistProgress: {
            completed: (c.event_plannings.event_planning_checklist_items || []).filter((i: any) => i.is_completed).length,
            total: (c.event_plannings.event_planning_checklist_items || []).length,
          },
          checklistItems: (c.event_plannings.event_planning_checklist_items || [])
            .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
            .map((item: any) => ({
              id: item.id,
              title: item.title,
              is_completed: item.is_completed,
              order_index: item.order_index ?? 0,
            })),
        }));

      // Merge and deduplicate
      const allPlannings = new Map<string, Planning>();
      formattedOwn.forEach(p => allPlannings.set(p.id, p));
      formattedCollab.forEach(p => {
        if (!allPlannings.has(p.id)) {
          allPlannings.set(p.id, p);
        }
      });

      const sorted = Array.from(allPlannings.values()).sort((a, b) => {
        // Erledigte nach unten
        if ((a.is_completed || false) !== (b.is_completed || false)) return a.is_completed ? 1 : -1;
        // Sonst nach Datum
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setPlannings(sorted);
    } catch (error) {
      console.error("Error loading plannings:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDetails = (planningId: string) => {
    setExpandedPlanningIds((prev) => {
      const next = new Set(prev);
      if (next.has(planningId)) {
        next.delete(planningId);
      } else {
        next.add(planningId);
      }
      return next;
    });
  };

  const addChecklistItem = async (planning: Planning) => {
    const title = (newChecklistTitles[planning.id] || "").trim();
    if (!title) return;

    try {
      const maxOrderIndex = planning.checklistItems.reduce((max, item) => Math.max(max, item.order_index ?? 0), 0);

      const { error } = await supabase
        .from("event_planning_checklist_items")
        .insert({
          event_planning_id: planning.id,
          title,
          order_index: maxOrderIndex + 1,
          is_completed: false,
        });

      if (error) throw error;

      setNewChecklistTitles((prev) => ({ ...prev, [planning.id]: "" }));
      toast({ title: "Checklisten-Eintrag hinzugefügt" });
      await loadPlannings();
    } catch (error) {
      console.error("Error adding checklist item:", error);
      toast({ title: "Fehler beim Hinzufügen", variant: "destructive" });
    }
  };

  const toggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from("event_planning_checklist_items")
        .update({ is_completed: isCompleted })
        .eq("id", itemId);

      if (error) throw error;

      await loadPlannings();
    } catch (error) {
      console.error("Error toggling checklist item:", error);
      toast({ title: "Fehler beim Aktualisieren", variant: "destructive" });
    }
  };

  const toggleCompleted = async (planningId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('event_plannings')
        .update({ 
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null
        })
        .eq('id', planningId)
        .select();

      if (error) throw error;
      
      toast({ title: isCompleted ? "Planung als erledigt markiert" : "Markierung entfernt" });
      loadPlannings();
    } catch (error) {
      console.error('Error toggling completed:', error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const archivePlanning = async (planningId: string) => {
    try {
      const { error } = await supabase
        .from('event_plannings')
        .update({ 
          is_archived: true,
          archived_at: new Date().toISOString()
        })
        .eq('id', planningId)
        .select();

      if (error) throw error;
      
      toast({ title: "Planung archiviert" });
      loadPlannings();
    } catch (error) {
      console.error('Error archiving planning:', error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 p-4">
        {plannings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
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
                    <span className={cn(
                      "font-bold text-base",
                      planning.is_completed && "line-through text-muted-foreground"
                    )}>
                      {planning.title}
                    </span>
                    {planning.isCollaborator && (
                      <Badge variant="secondary" className="text-xs">Mitwirkend</Badge>
                    )}
                    {planning.is_completed && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-200">Erledigt</Badge>
                    )}
                  </div>

                  {planning.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {planning.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {planning.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {planning.location}
                      </span>
                    )}
                    {planning.confirmed_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(planning.confirmed_date), "dd.MM.yyyy", { locale: de })}
                      </span>
                    )}
                    {planning.confirmed_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(planning.confirmed_date), "HH:mm", { locale: de })} Uhr
                      </span>
                    )}
                    {planning.checklistProgress.total > 0 && (
                      <span className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                        <CheckSquare className="h-3 w-3" />
                        {planning.checklistProgress.completed}/{planning.checklistProgress.total}
                        </span>
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Details
                            {expandedPlanningIds.has(planning.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        </CollapsibleTrigger>
                      </span>
                    )}
                    {planning.checklistProgress.total === 0 && (
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Details
                          {expandedPlanningIds.has(planning.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      </CollapsibleTrigger>
                    )}
                  </div>

                  <CollapsibleContent className="mt-3 border-t pt-3 space-y-3">
                    {planning.description && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Beschreibung</Label>
                        <p className="text-sm mt-1">{planning.description}</p>
                      </div>
                    )}

                    <div>
                      <Label className="text-xs text-muted-foreground">Checkliste</Label>
                      <div className="mt-2 space-y-2">
                        {planning.checklistItems.length > 0 ? (
                          planning.checklistItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className="text-sm flex items-center gap-2 text-left hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleChecklistItem(item.id, !item.is_completed);
                              }}
                            >
                              {item.is_completed ? (
                                <CheckSquare className="h-4 w-4 text-green-600" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className={cn(item.is_completed && "line-through text-muted-foreground")}>{item.title}</span>
                            </button>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">Noch keine Einträge</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <Input
                          value={newChecklistTitles[planning.id] || ""}
                          onChange={(e) => setNewChecklistTitles((prev) => ({ ...prev, [planning.id]: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Neuer Checklisten-Eintrag"
                          className="h-8"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            addChecklistItem(planning);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Hinzufügen
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                {/* Erledigt-Button - nur für Eigentümer */}
                {planning.user_id === user?.id && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("h-7 w-7", planning.is_completed && "text-green-600")}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCompleted(planning.id, !planning.is_completed);
                          }}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {planning.is_completed ? "Als unerledigt markieren" : "Als erledigt markieren"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                {planning.user_id === user?.id && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            archivePlanning(planning.id);
                          }}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Archivieren</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    navigate(`/eventplanning?planningId=${planning.id}`);
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
                </div>
              </div>
            </Collapsible>
          ))
        )}
      </div>
    </>
  );
}
