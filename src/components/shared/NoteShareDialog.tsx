import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { UserSelector } from "@/components/UserSelector";
import { useNoteSharing, NoteShare } from "@/hooks/useNoteSharing";
import { Trash2, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface NoteShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  noteTitle?: string;
}

export const NoteShareDialog = ({
  open,
  onOpenChange,
  noteId,
  noteTitle,
}: NoteShareDialogProps) => {
  const { shares, loading, shareNote, unshareNote, updatePermission } =
    useNoteSharing(noteId);
  const [selectedPermission, setSelectedPermission] = useState<"view" | "edit">("view");
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async (user: { id: string; display_name: string }) => {
    setIsSharing(true);
    await shareNote(noteId, user.id, selectedPermission);
    setIsSharing(false);
  };

  const handlePermissionChange = async (share: NoteShare, newPermission: "view" | "edit") => {
    await updatePermission(share.id, newPermission);
  };

  const handleRemoveShare = async (shareId: string) => {
    await unshareNote(shareId);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Notiz freigeben
          </DialogTitle>
        </DialogHeader>

        {noteTitle && (
          <p className="text-sm text-muted-foreground truncate">
            „{noteTitle}"
          </p>
        )}

        <div className="space-y-4">
          {/* Neue Freigabe */}
          <div className="flex gap-2">
            <div className="flex-1">
              <UserSelector
                onSelect={handleShare}
                placeholder="Teammitglied auswählen..."
                excludeUserIds={shares.map((s) => s.shared_with_user_id)}
                clearAfterSelect
              />
            </div>
            <Select
              value={selectedPermission}
              onValueChange={(v) => setSelectedPermission(v as "view" | "edit")}
            >
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">Ansicht</SelectItem>
                <SelectItem value="edit">Bearbeiten</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Aktuelle Freigaben */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : shares.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Freigegeben für:
              </p>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {shares.map((share) => (
                    <div
                      key={share.id}
                      className={cn(
                        "flex items-center justify-between gap-2 p-2 rounded-md",
                        "bg-muted/50 hover:bg-muted transition-colors"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={share.shared_with_user?.avatar_url || undefined}
                          />
                          <AvatarFallback className="text-xs">
                            {getInitials(share.shared_with_user?.display_name || null)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate">
                          {share.shared_with_user?.display_name || "Unbekannt"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Select
                          value={share.permission_type}
                          onValueChange={(v) =>
                            handlePermissionChange(share, v as "view" | "edit")
                          }
                        >
                          <SelectTrigger className="h-8 w-[100px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">Ansicht</SelectItem>
                            <SelectItem value="edit">Bearbeiten</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveShare(share.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Diese Notiz wurde noch nicht geteilt.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
