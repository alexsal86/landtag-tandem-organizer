import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { usePlanningPreferences } from "@/hooks/usePlanningPreferences";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { Trash2, Users, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

interface PlanningDefaultCollaboratorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PlanningDefaultCollaboratorsDialog = ({
  open,
  onOpenChange,
}: PlanningDefaultCollaboratorsDialogProps) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { defaultCollaborators, loading, addCollaborator, removeCollaborator, updatePermission } =
    usePlanningPreferences();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (open) {
      loadTeamMembers();
    }
  }, [open, currentTenant?.id]);

  const loadTeamMembers = async () => {
    if (!currentTenant?.id || !user) return;

    setLoadingMembers(true);
    try {
      // Step 1: Load all active memberships
      const { data: memberships, error: memberError } = await supabase
        .from("user_tenant_memberships")
        .select("user_id")
        .eq("tenant_id", currentTenant.id)
        .eq("is_active", true);

      if (memberError || !memberships) {
        console.error("Error loading memberships:", memberError);
        return;
      }

      // Step 2: Get user IDs excluding current user
      const userIds = memberships
        .map(m => m.user_id)
        .filter(id => id !== user.id);

      if (userIds.length === 0) {
        setTeamMembers([]);
        return;
      }

      // Step 3: Load profiles for these user IDs in current tenant
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .eq("tenant_id", currentTenant.id)
        .in("user_id", userIds);

      if (profileError) {
        console.error("Error loading profiles:", profileError);
        return;
      }

      const members = (profiles || []).map(p => ({
        id: p.user_id,
        display_name: p.display_name || "Unbekannt",
        avatar_url: p.avatar_url,
      }));

      setTeamMembers(members);
    } catch (error) {
      console.error("Error loading team members:", error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isSelected = (memberId: string) => {
    return defaultCollaborators.some((c) => c.user_id === memberId);
  };

  const getCollaborator = (memberId: string) => {
    return defaultCollaborators.find((c) => c.user_id === memberId);
  };

  const handleToggle = async (member: TeamMember) => {
    const existing = getCollaborator(member.id);
    if (existing) {
      await removeCollaborator(member.id);
    } else {
      await addCollaborator(member.id, false);
    }
  };

  const filteredMembers = teamMembers.filter((member) =>
    member.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Standard-Mitarbeiter
          </DialogTitle>
          <DialogDescription>
            Diese Mitarbeiter werden bei neuen Planungen automatisch hinzugefügt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Teammitglieder suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Team Members List */}
          {loadingMembers || loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {searchTerm ? "Keine Teammitglieder gefunden" : "Keine Teammitglieder verfügbar"}
            </p>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {filteredMembers.map((member) => {
                  const selected = isSelected(member.id);
                  const collab = getCollaborator(member.id);

                  return (
                    <div
                      key={member.id}
                      className={cn(
                        "flex items-center justify-between gap-2 p-2 rounded-md transition-colors",
                        selected ? "bg-primary/10" : "bg-muted/50 hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => handleToggle(member)}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.display_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate">{member.display_name}</span>
                      </div>

                      {selected && collab && (
                        <div className="flex items-center gap-1">
                          <Select
                            value={collab.can_edit ? "edit" : "view"}
                            onValueChange={(v) =>
                              updatePermission(member.id, v === "edit")
                            }
                          >
                            <SelectTrigger className="h-8 w-[100px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view">Ansehen</SelectItem>
                              <SelectItem value="edit">Bearbeiten</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeCollaborator(member.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Summary */}
          {defaultCollaborators.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
              <Users className="h-4 w-4" />
              <span>
                {defaultCollaborators.length}{" "}
                {defaultCollaborators.length === 1 ? "Mitarbeiter wird" : "Mitarbeiter werden"} automatisch hinzugefügt
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
