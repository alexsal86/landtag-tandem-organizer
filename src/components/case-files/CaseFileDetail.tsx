import { useState } from "react";
import { useCaseFileDetails, CONTACT_ROLES, DOCUMENT_RELEVANCE } from "@/hooks/useCaseFileDetails";
import { useCaseFiles, CASE_STATUSES } from "@/hooks/useCaseFiles";
import { useCaseFileTypes } from "@/hooks/useCaseFileTypes";
import { icons, LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Edit2, 
  Trash2, 
  Users, 
  FileText, 
  CheckSquare, 
  Calendar, 
  Mail,
  MessageSquare,
  Clock,
  MoreVertical,
  Plus,
  Pin,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { CaseFileEditDialog } from "./CaseFileEditDialog";
import { CaseFileContactsTab } from "./tabs/CaseFileContactsTab";
import { CaseFileDocumentsTab } from "./tabs/CaseFileDocumentsTab";
import { CaseFileTasksTab } from "./tabs/CaseFileTasksTab";
import { CaseFileAppointmentsTab } from "./tabs/CaseFileAppointmentsTab";
import { CaseFileLettersTab } from "./tabs/CaseFileLettersTab";
import { CaseFileNotesTab } from "./tabs/CaseFileNotesTab";
import { CaseFileTimelineTab } from "./tabs/CaseFileTimelineTab";

interface CaseFileDetailProps {
  caseFileId: string;
  onBack: () => void;
}

export function CaseFileDetail({ caseFileId, onBack }: CaseFileDetailProps) {
  const details = useCaseFileDetails(caseFileId);
  const { deleteCaseFile } = useCaseFiles();
  const { caseFileTypes } = useCaseFileTypes();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const { caseFile, contacts, documents, tasks, appointments, letters, notes, timeline, loading } = details;

  const getIconComponent = (iconName?: string | null): LucideIcon | null => {
    if (!iconName) return null;
    const Icon = icons[iconName as keyof typeof icons] as LucideIcon;
    return Icon || null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!caseFile) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">FallAkte nicht gefunden</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = CASE_STATUSES.find(s => s.value === caseFile.status);
  const typeConfig = caseFileTypes.find(t => t.name === caseFile.case_type);
  const TypeIcon = getIconComponent(typeConfig?.icon);

  const handleDelete = async () => {
    const success = await deleteCaseFile(caseFile.id);
    if (success) {
      onBack();
    }
    setDeleteDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zur Übersicht
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Bearbeiten
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Case File Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={cn("text-white", statusConfig?.color || "bg-gray-500")}>
                  {statusConfig?.label || caseFile.status}
                </Badge>
                <Badge 
                  variant="outline"
                  style={{ 
                    borderColor: typeConfig?.color,
                    color: typeConfig?.color
                  }}
                >
                  {TypeIcon && <TypeIcon className="h-3 w-3 mr-1" />}
                  {typeConfig?.label || caseFile.case_type}
                </Badge>
                {caseFile.is_private && (
                  <Badge variant="secondary">
                    <Eye className="h-3 w-3 mr-1" />
                    Privat
                  </Badge>
                )}
              </div>
              <CardTitle className="text-2xl">{caseFile.title}</CardTitle>
              {caseFile.reference_number && (
                <CardDescription className="mt-1">
                  Aktenzeichen: {caseFile.reference_number}
                </CardDescription>
              )}
            </div>
          </div>
          {caseFile.description && (
            <p className="text-muted-foreground mt-4">{caseFile.description}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-2xl font-bold">{contacts.length}</div>
              <p className="text-xs text-muted-foreground">Kontakte</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <FileText className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-2xl font-bold">{documents.length}</div>
              <p className="text-xs text-muted-foreground">Dokumente</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <CheckSquare className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-2xl font-bold">{tasks.length}</div>
              <p className="text-xs text-muted-foreground">Aufgaben</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Calendar className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-2xl font-bold">{appointments.length}</div>
              <p className="text-xs text-muted-foreground">Termine</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Mail className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-2xl font-bold">{letters.length}</div>
              <p className="text-xs text-muted-foreground">Briefe</p>
            </div>
          </div>

          {(caseFile.start_date || caseFile.target_date) && (
            <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
              {caseFile.start_date && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Start: {format(new Date(caseFile.start_date), 'dd.MM.yyyy', { locale: de })}</span>
                </div>
              )}
              {caseFile.target_date && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Ziel: {format(new Date(caseFile.target_date), 'dd.MM.yyyy', { locale: de })}</span>
                </div>
              )}
            </div>
          )}

          {caseFile.tags && caseFile.tags.length > 0 && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {caseFile.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="contacts">
            Kontakte
            {contacts.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {contacts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="documents">
            Dokumente
            {documents.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {documents.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tasks">
            Aufgaben
            {tasks.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {tasks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="appointments">Termine</TabsTrigger>
          <TabsTrigger value="letters">Briefe</TabsTrigger>
          <TabsTrigger value="notes">Notizen</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <CaseFileTimelineTab 
            timeline={timeline}
            onAddEntry={details.addTimelineEntry}
            onDeleteEntry={details.deleteTimelineEntry}
          />
        </TabsContent>

        <TabsContent value="contacts">
          <CaseFileContactsTab 
            contacts={contacts}
            onAdd={details.addContact}
            onRemove={details.removeContact}
          />
        </TabsContent>

        <TabsContent value="documents">
          <CaseFileDocumentsTab 
            documents={documents}
            onAdd={details.addDocument}
            onRemove={details.removeDocument}
          />
        </TabsContent>

        <TabsContent value="tasks">
          <CaseFileTasksTab 
            tasks={tasks}
            onAdd={details.addTask}
            onRemove={details.removeTask}
          />
        </TabsContent>

        <TabsContent value="appointments">
          <CaseFileAppointmentsTab 
            appointments={appointments}
            onAdd={details.addAppointment}
            onRemove={details.removeAppointment}
          />
        </TabsContent>

        <TabsContent value="letters">
          <CaseFileLettersTab 
            letters={letters}
            onAdd={details.addLetter}
            onRemove={details.removeLetter}
          />
        </TabsContent>

        <TabsContent value="notes">
          <CaseFileNotesTab 
            notes={notes}
            onAdd={details.addNote}
            onUpdate={details.updateNote}
            onDelete={details.deleteNote}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <CaseFileEditDialog 
        caseFile={caseFile}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>FallAkte löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die FallAkte und alle Verknüpfungen werden permanent gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
