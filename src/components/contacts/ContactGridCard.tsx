import { MouseEvent, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Phone, MapPin, Building, Star, Trash2 } from "lucide-react";
import { Contact } from "@/hooks/useInfiniteContacts";
import { ContactQuickActions } from "./ContactQuickActions";
import { getPriorityColor } from "./hooks/useContactsViewState";
import { getInitials } from "./utils/contactFormatters";

interface ContactGridCardProps {
  contact: Contact;
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  onToggleFavorite: (id: string, val: boolean) => void;
  onDelete: (id: string, name: string) => void;
}

export function ContactGridCard({
  contact, isSelectionMode, isSelected, onSelect, onClick, onToggleFavorite, onDelete,
}: ContactGridCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setDeleteTarget({ id: contact.id, name: contact.name });
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    onDelete(deleteTarget.id, deleteTarget.name);
    setIsDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleDeleteDialogChange = (open: boolean) => {
    setIsDeleteDialogOpen(open);
    if (!open) {
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <Card
        className={`bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300 cursor-pointer group relative ${getPriorityColor(contact.priority)} ${isSelected ? 'ring-2 ring-primary' : ''}`}
        onClick={() => isSelectionMode ? onSelect() : onClick()}
      >
        {isSelectionMode && (
          <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={isSelected} onCheckedChange={onSelect} />
          </div>
        )}
        {!isSelectionMode && <ContactQuickActions contact={contact} />}

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={contact.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground">{getInitials(contact.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-lg mb0">{contact.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {contact.contact_type === "organization"
                    ? contact.role || ""
                    : contact.role}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onToggleFavorite(contact.id, !contact.is_favorite); }} className="p-2">
              <Star className={`h-4 w-4 transition-colors ${contact.is_favorite ? 'text-yellow-500 fill-current' : 'text-muted-foreground hover:text-yellow-500'}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {contact.contact_type === "person" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Building className="h-4 w-4" /><span className="truncate">{contact.organization || "Keine Organisation"}</span></div>
            ) : null}
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" /><span className="truncate">{contact.email || "Keine E-Mail"}</span></div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" /><span>{contact.phone || "Keine Telefonnummer"}</span></div>
            {contact.location && <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /><span>{contact.location}</span></div>}
            {contact.address && <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /><span className="truncate">{contact.address}</span></div>}
            {contact.last_contact && <div className="pt-2 border-t border-border"><span className="text-xs text-muted-foreground">Letzter Kontakt: {contact.last_contact}</span></div>}
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" variant="outline" className="flex-1"><Mail className="h-4 w-4 mr-1" />E-Mail</Button>
            <Button size="sm" variant="outline" className="flex-1"><Phone className="h-4 w-4 mr-1" />Anrufen</Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeleteClick}
              className="px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kontakt löschen?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Sind Sie sicher, dass Sie "${deleteTarget.name}" löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`
                : "Möchten Sie diesen Kontakt wirklich löschen?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDeleteDialogChange(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
