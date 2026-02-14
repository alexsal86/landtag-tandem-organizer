import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserBadge } from "@/components/ui/user-badge";
import { getHashedColor } from "@/utils/userColors";
import { NewItemIndicator } from "../NewItemIndicator";
import { CheckCircle, Clock, Archive } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { EventPlanning, Collaborator, Profile } from "./types";

interface EventPlanningTableProps {
  plannings: EventPlanning[];
  allProfiles: Profile[];
  collaborators: Collaborator[];
  user: any;
  isItemNew: (id: string, createdAt: string) => boolean;
  setSelectedPlanning: (planning: EventPlanning) => void;
  togglePlanningCompleted: (id: string, completed: boolean) => void;
  archivePlanning: (id: string) => void;
}

export function EventPlanningTable({
  plannings, allProfiles, collaborators, user, isItemNew,
  setSelectedPlanning, togglePlanningCompleted, archivePlanning,
}: EventPlanningTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10"></TableHead>
          <TableHead>Titel</TableHead>
          <TableHead>Verantwortlich</TableHead>
          <TableHead>Mitarbeiter</TableHead>
          <TableHead>Datum</TableHead>
          <TableHead className="w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {plannings.map((planning) => {
          const creatorProfile = allProfiles.find(p => p.user_id === planning.user_id);
          const planningCollabs = collaborators.filter(c => c.event_planning_id === planning.id);
          
          return (
            <TableRow 
              key={planning.id} 
              className="cursor-pointer hover:bg-muted/50 relative"
              onClick={() => setSelectedPlanning(planning)}
            >
              <TableCell className="w-10">
                {planning.confirmed_date ? (
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20">
                    <Clock className="h-4 w-4 text-amber-500" />
                  </div>
                )}
              </TableCell>
              <TableCell className={cn("font-medium relative", planning.is_completed && "line-through text-muted-foreground")}>
                <NewItemIndicator isVisible={isItemNew(planning.id, planning.created_at)} size="sm" />
                {planning.title}
              </TableCell>
              <TableCell>
                <UserBadge userId={planning.user_id} displayName={creatorProfile?.display_name || null} badgeColor={(creatorProfile as any)?.badge_color} size="sm" />
              </TableCell>
              <TableCell>
                {planningCollabs.length > 0 ? (
                  <div className="flex gap-1">
                    {planningCollabs.slice(0, 3).map(collab => {
                      const profile = allProfiles.find(p => p.user_id === collab.user_id);
                      const color = (profile as any)?.badge_color || getHashedColor(collab.user_id);
                      return (
                        <TooltipProvider key={collab.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn("text-xs px-2 py-0.5 rounded-full text-white", color)}>
                                {(profile?.display_name || "?")[0]}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{profile?.display_name || "Unbekannt"}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                    {planningCollabs.length > 3 && <span className="text-xs text-muted-foreground">+{planningCollabs.length - 3}</span>}
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                {planning.confirmed_date ? format(new Date(planning.confirmed_date), "dd.MM.yyyy", { locale: de }) : "-"}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  {(planning.user_id === user?.id || collaborators.some(c => c.event_planning_id === planning.id && c.user_id === user?.id && c.can_edit)) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className={cn("h-7 w-7", planning.is_completed && "text-green-600")}
                            onClick={() => togglePlanningCompleted(planning.id, !planning.is_completed)}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{planning.is_completed ? "Als unerledigt markieren" : "Als erledigt markieren"}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {planning.user_id === user?.id && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => archivePlanning(planning.id)}>
                            <Archive className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Archivieren</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
