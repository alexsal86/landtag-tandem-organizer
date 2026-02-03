import { useState } from "react";
import { Plus, AlertTriangle, AlertCircle, Info, CheckCircle, Trash2, Edit, Eye, EyeOff, Archive, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTeamAnnouncements, TeamAnnouncement } from "@/hooks/useTeamAnnouncements";
import { CreateAnnouncementDialog } from "./CreateAnnouncementDialog";
import { AnnouncementProgress } from "./AnnouncementProgress";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const priorityConfig = {
  critical: { label: "Kritisch", icon: AlertTriangle, color: "bg-red-500", textColor: "text-red-700 dark:text-red-300" },
  warning: { label: "Warnung", icon: AlertCircle, color: "bg-orange-500", textColor: "text-orange-700 dark:text-orange-300" },
  info: { label: "Info", icon: Info, color: "bg-blue-500", textColor: "text-blue-700 dark:text-blue-300" },
  success: { label: "Erfolg", icon: CheckCircle, color: "bg-green-500", textColor: "text-green-700 dark:text-green-300" },
};

export function TeamAnnouncementsManager() {
  const { announcements, updateAnnouncement, deleteAnnouncement, loading } = useTeamAnnouncements();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);

  const now = new Date();

  // Separate active and archived announcements
  const activeAnnouncements = announcements.filter(a => {
    if (!a.is_active) return false;
    if (a.expires_at && new Date(a.expires_at) < now) return false;
    return true;
  });

  const archivedAnnouncements = announcements.filter(a => {
    if (!a.is_active) return true;
    if (a.expires_at && new Date(a.expires_at) < now) return true;
    return false;
  });

  const handleToggleActive = async (announcement: TeamAnnouncement) => {
    await updateAnnouncement(announcement.id, { is_active: !announcement.is_active });
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteAnnouncement(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const renderAnnouncementCard = (announcement: TeamAnnouncement, isArchived: boolean = false) => {
    const config = priorityConfig[announcement.priority];
    const Icon = config.icon;
    const isScheduled = announcement.starts_at && new Date(announcement.starts_at) > now;
    const isExpired = announcement.expires_at && new Date(announcement.expires_at) < now;

    return (
      <Card 
        key={announcement.id} 
        className={cn(
          "transition-all",
          isArchived && "opacity-60"
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon className={cn("h-5 w-5", config.textColor)} />
              <CardTitle className="text-base">{announcement.title}</CardTitle>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Badge variant="secondary" className={cn("text-xs text-white", config.color)}>
                {config.label}
              </Badge>
              {isScheduled && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Geplant
                </Badge>
              )}
              {isExpired && (
                <Badge variant="outline" className="text-xs">
                  Abgelaufen
                </Badge>
              )}
            </div>
          </div>
          <CardDescription className="text-xs">
            von {announcement.author_name} • {format(new Date(announcement.created_at), "dd. MMM yyyy, HH:mm", { locale: de })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-3">{announcement.message}</p>

          {/* Time info */}
          {(announcement.starts_at || announcement.expires_at) && (
            <div className="text-xs text-muted-foreground space-y-1">
              {announcement.starts_at && (
                <p>Start: {format(new Date(announcement.starts_at), "dd.MM.yyyy HH:mm", { locale: de })}</p>
              )}
              {announcement.expires_at && (
                <p>Ende: {format(new Date(announcement.expires_at), "dd.MM.yyyy HH:mm", { locale: de })}</p>
              )}
            </div>
          )}

          {/* Progress section - click to expand */}
          {!isArchived && (
            <button
              onClick={() => setSelectedAnnouncementId(
                selectedAnnouncementId === announcement.id ? null : announcement.id
              )}
              className="w-full text-left"
            >
              <AnnouncementProgress 
                announcementId={announcement.id} 
                expanded={selectedAnnouncementId === announcement.id}
              />
            </button>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleToggleActive(announcement)}
            >
              {announcement.is_active ? (
                <>
                  <EyeOff className="h-4 w-4 mr-1" />
                  Deaktivieren
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  Aktivieren
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteConfirmId(announcement.id)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Löschen
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Lade Mitteilungen...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Team-Mitteilungen</h3>
          <p className="text-sm text-muted-foreground">
            Globale Nachrichten für alle Teammitglieder
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Neue Mitteilung
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Eye className="h-4 w-4" />
            Aktiv ({activeAnnouncements.length})
          </TabsTrigger>
          <TabsTrigger value="archived" className="gap-2">
            <Archive className="h-4 w-4" />
            Archiv ({archivedAnnouncements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {activeAnnouncements.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Info className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">Keine aktiven Mitteilungen</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Erste Mitteilung erstellen
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeAnnouncements.map(a => renderAnnouncementCard(a, false))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          {archivedAnnouncements.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Archive className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">Keine archivierten Mitteilungen</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {archivedAnnouncements.map(a => renderAnnouncementCard(a, true))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateAnnouncementDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitteilung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die Mitteilung wird dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
