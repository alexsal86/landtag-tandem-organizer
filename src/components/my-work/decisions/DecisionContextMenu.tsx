import { ReactNode, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CalendarDays,
  Globe,
  GlobeLock,
  Users,
  Archive,
  Trash2,
  Star,
  StarOff,
  Clock,
} from "lucide-react";
import { de } from "date-fns/locale";
import { format } from "date-fns";
import { MyWorkDecision } from "./types";
import { TenantUser } from "@/hooks/useTenantUsers";

interface DecisionContextMenuProps {
  children: ReactNode;
  decision: MyWorkDecision;
  isCreator: boolean;
  tenantUsers: TenantUser[];
  existingParticipantIds: string[];
  onUpdateDeadline: (decisionId: string, date: string | null) => void;
  onTogglePublic: (decisionId: string, currentValue: boolean) => void;
  onAddParticipants: (decisionId: string, userIds: string[]) => void;
  onRemoveParticipant: (decisionId: string, userId: string) => void;
  onArchive: (decisionId: string) => void;
  onDelete: (decisionId: string) => void;
  onAddToJourFixe: (decisionId: string) => void;
  onTogglePriority: (decisionId: string, currentPriority: number) => void;
}

export function DecisionContextMenu({
  children,
  decision,
  isCreator,
  tenantUsers,
  existingParticipantIds,
  onUpdateDeadline,
  onTogglePublic,
  onAddParticipants,
  onRemoveParticipant,
  onArchive,
  onDelete,
  onAddToJourFixe,
  onTogglePriority,
}: DecisionContextMenuProps) {
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    decision.response_deadline ? new Date(decision.response_deadline) : undefined
  );
  const [selectedNewUsers, setSelectedNewUsers] = useState<string[]>([]);

  const isPriority = (decision.priority ?? 0) > 0;

  const availableUsers = tenantUsers.filter(
    (u) => !existingParticipantIds.includes(u.id) && u.id !== decision.created_by
  );

  const participantProfiles = tenantUsers.filter((u) =>
    existingParticipantIds.includes(u.id)
  );

  const handleDeadlineSave = () => {
    onUpdateDeadline(decision.id, selectedDate ? selectedDate.toISOString() : null);
    setDeadlineOpen(false);
  };

  const handleAddSelected = () => {
    if (selectedNewUsers.length > 0) {
      onAddParticipants(decision.id, selectedNewUsers);
      setSelectedNewUsers([]);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedNewUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {/* 1. Deadline */}
          {isCreator && (
            <ContextMenuItem
              onClick={() => {
                setSelectedDate(
                  decision.response_deadline ? new Date(decision.response_deadline) : undefined
                );
                setDeadlineOpen(true);
              }}
            >
              <Clock className="h-4 w-4 mr-2" />
              Antwortfrist ändern
              {decision.response_deadline && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {format(new Date(decision.response_deadline), "dd.MM.", { locale: de })}
                </span>
              )}
            </ContextMenuItem>
          )}

          {/* 2. Public toggle */}
          {isCreator && (
            <ContextMenuItem onClick={() => onTogglePublic(decision.id, !!decision.visible_to_all)}>
              {decision.visible_to_all ? (
                <>
                  <GlobeLock className="h-4 w-4 mr-2" />
                  Nicht öffentlich machen
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  Öffentlich machen
                </>
              )}
            </ContextMenuItem>
          )}

          {/* 3. Manage participants */}
          {isCreator && (
            <ContextMenuItem
              onClick={() => {
                setSelectedNewUsers([]);
                setParticipantsOpen(true);
              }}
            >
              <Users className="h-4 w-4 mr-2" />
              Teilnehmer verwalten
            </ContextMenuItem>
          )}

          {isCreator && <ContextMenuSeparator />}

          {/* 5. Jour Fixe – available for ALL tenant members */}
          <ContextMenuItem onClick={() => onAddToJourFixe(decision.id)}>
            <CalendarDays className="h-4 w-4 mr-2" />
            Zum Jour Fixe hinzufügen
          </ContextMenuItem>

          {/* 6. Priority */}
          {isCreator && (
            <ContextMenuItem onClick={() => onTogglePriority(decision.id, decision.priority ?? 0)}>
              {isPriority ? (
                <>
                  <StarOff className="h-4 w-4 mr-2" />
                  Priorität entfernen
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 mr-2" />
                  Prioritär markieren
                </>
              )}
            </ContextMenuItem>
          )}

          {isCreator && <ContextMenuSeparator />}

          {/* 4. Archive & Delete */}
          {isCreator && (
            <>
              <ContextMenuItem onClick={() => onArchive(decision.id)}>
                <Archive className="h-4 w-4 mr-2" />
                Archivieren
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onDelete(decision.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Deadline Dialog */}
      <Dialog open={deadlineOpen} onOpenChange={setDeadlineOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Antwortfrist ändern</DialogTitle>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={de}
            className="rounded-md border"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedDate(undefined);
                onUpdateDeadline(decision.id, null);
                setDeadlineOpen(false);
              }}
            >
              Frist entfernen
            </Button>
            <Button size="sm" onClick={handleDeadlineSave}>
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Participants Dialog */}
      <Dialog open={participantsOpen} onOpenChange={setParticipantsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Teilnehmer verwalten</DialogTitle>
          </DialogHeader>

          {/* Existing participants */}
          {participantProfiles.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Aktuelle Teilnehmer
              </p>
              <ScrollArea className="max-h-40">
                <div className="space-y-1">
                  {participantProfiles.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(u.display_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{u.display_name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-destructive hover:text-destructive"
                        onClick={() => onRemoveParticipant(decision.id, u.id)}
                      >
                        Entfernen
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Add new participants */}
          {availableUsers.length > 0 && (
            <div className="space-y-1 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Teilnehmer hinzufügen
              </p>
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {availableUsers.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedNewUsers.includes(u.id)}
                        onCheckedChange={() => toggleUserSelection(u.id)}
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {getInitials(u.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{u.display_name}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
              <Button
                size="sm"
                className="mt-2"
                disabled={selectedNewUsers.length === 0}
                onClick={handleAddSelected}
              >
                {selectedNewUsers.length} hinzufügen
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
