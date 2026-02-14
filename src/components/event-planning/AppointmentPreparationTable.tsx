import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NewItemIndicator } from "../NewItemIndicator";
import { CheckCircle, Clock, FileEdit, Archive } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { AppointmentPreparation } from "./types";

interface AppointmentPreparationTableProps {
  preparations: AppointmentPreparation[];
  isArchived?: boolean;
  isItemNew: (id: string, createdAt: string) => boolean;
  handlePreparationClick: (preparation: AppointmentPreparation) => void;
  archivePreparation: (id: string) => void;
}

export function AppointmentPreparationTable({
  preparations, isArchived = false, isItemNew,
  handlePreparationClick, archivePreparation,
}: AppointmentPreparationTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10"></TableHead>
          <TableHead>Titel</TableHead>
          <TableHead>Notizen</TableHead>
          {isArchived && <TableHead>Archiviert</TableHead>}
          {!isArchived && <TableHead className="w-14">Aktionen</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {preparations.map((preparation) => {
          const statusConfig = {
            completed: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/20' },
            in_progress: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/20' },
            draft: { icon: FileEdit, color: 'text-muted-foreground', bg: 'bg-muted' }
          };
          const config = statusConfig[preparation.status as keyof typeof statusConfig] || statusConfig.draft;
          const StatusIcon = config.icon;
          
          return (
            <TableRow key={preparation.id} className="cursor-pointer hover:bg-muted/50 relative" onClick={() => handlePreparationClick(preparation)}>
              <TableCell className="w-10">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full ${config.bg}`}>
                  <StatusIcon className={`h-4 w-4 ${config.color}`} />
                </div>
              </TableCell>
              <TableCell className="font-medium relative">
                <NewItemIndicator isVisible={isItemNew(preparation.id, preparation.created_at)} size="sm" />
                {preparation.title}
              </TableCell>
              <TableCell className="max-w-xs truncate">{preparation.notes || '-'}</TableCell>
              {isArchived && preparation.archived_at && (
                <TableCell>{format(new Date(preparation.archived_at), "dd.MM.yyyy", { locale: de })}</TableCell>
              )}
              {!isArchived && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => archivePreparation(preparation.id)}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Archivieren</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
