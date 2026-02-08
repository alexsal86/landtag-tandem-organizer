import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarPlus, ExternalLink, MapPin, CheckSquare, Calendar, CheckCircle, Archive } from "lucide-react";
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
}

export function MyWorkPlanningsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanning, setSelectedPlanning] = useState<Planning | null>(null);

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
            is_completed
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
              is_completed
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
            <div
              key={planning.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => setSelectedPlanning(planning)}
            >
              <CalendarPlus className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "font-medium text-sm",
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
                    <span>
                      {format(new Date(planning.confirmed_date), "dd.MM.yyyy", { locale: de })}
                    </span>
                  )}
                  {planning.checklistProgress.total > 0 && (
                    <span className="flex items-center gap-1">
                      <CheckSquare className="h-3 w-3" />
                      {planning.checklistProgress.completed}/{planning.checklistProgress.total}
                    </span>
                  )}
                </div>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/eventplanning?planningId=${planning.id}`);
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Planning Quick View Dialog */}
      <Dialog open={!!selectedPlanning} onOpenChange={() => setSelectedPlanning(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5" />
              {selectedPlanning?.title}
            </DialogTitle>
          </DialogHeader>
          
          {selectedPlanning && (
            <div className="space-y-4">
              {selectedPlanning.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">Beschreibung</Label>
                  <p className="text-sm mt-1">{selectedPlanning.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Ort</Label>
                  <p className="text-sm mt-1 flex items-center gap-1">
                    {selectedPlanning.location ? (
                      <>
                        <MapPin className="h-3 w-3" />
                        {selectedPlanning.location}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Termin</Label>
                  <p className="text-sm mt-1 flex items-center gap-1">
                    {selectedPlanning.confirmed_date ? (
                      <>
                        <Calendar className="h-3 w-3" />
                        {format(new Date(selectedPlanning.confirmed_date), "dd.MM.yyyy", { locale: de })}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Noch offen</span>
                    )}
                  </p>
                </div>
              </div>

              {selectedPlanning.checklistProgress.total > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Checkliste</Label>
                  <div className="mt-2">
                    <Progress 
                      value={(selectedPlanning.checklistProgress.completed / selectedPlanning.checklistProgress.total) * 100} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedPlanning.checklistProgress.completed} von {selectedPlanning.checklistProgress.total} erledigt
                    </p>
                  </div>
                </div>
              )}

              {selectedPlanning.isCollaborator && (
                <Badge variant="secondary">Mitwirkend</Badge>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setSelectedPlanning(null)}
            >
              Schließen
            </Button>
            <Button 
              onClick={() => {
                navigate(`/eventplanning?planningId=${selectedPlanning?.id}`);
                setSelectedPlanning(null);
              }}
            >
              Zur Planung
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
