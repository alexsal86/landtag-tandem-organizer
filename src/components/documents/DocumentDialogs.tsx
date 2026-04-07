import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FolderInput, Loader2, Save } from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";
import { ArchivedLetterDetails } from "../letters/ArchivedLetterDetails";
import type { Document, DocumentFolder, ParentTaskOption } from "./types";
import { STATUS_LABELS } from "./types";
import type { DocumentCategoryOption, DocumentTagOption } from "./operationsContract";
import { toArchivedLetterDocumentRow } from "./operationsContract";

interface DocumentDialogsProps {
  showEditDialog: boolean;
  setShowEditDialog: (v: boolean) => void;
  editingDocument: Document | null;
  editTitle: string;
  setEditTitle: (v: string) => void;
  editDescription: string;
  setEditDescription: (v: string) => void;
  editCategory: string;
  setEditCategory: (v: string) => void;
  editTags: string[];
  setEditTags: (v: string[]) => void;
  editStatus: string;
  setEditStatus: (v: string) => void;
  editFolderId: string;
  setEditFolderId: (v: string) => void;
  documentCategories: DocumentCategoryOption[];
  tags: DocumentTagOption[];
  folders: DocumentFolder[];
  loading: boolean;
  onUpdateDocument: () => void | Promise<void>;
  showMoveFolderDialog: boolean;
  setShowMoveFolderDialog: (v: boolean) => void;
  selectedDocument: Document | null;
  setSelectedDocument: (v: Document | null) => void;
  moveToFolderId: string;
  setMoveToFolderId: (v: string) => void;
  onMoveDocument: () => void | Promise<void>;
  taskDialogMode: "task" | "subtask" | null;
  taskTitle: string;
  setTaskTitle: (v: string) => void;
  taskDescription: string;
  setTaskDescription: (v: string) => void;
  parentTaskId: string;
  setParentTaskId: (v: string) => void;
  availableParentTasks: ParentTaskOption[];
  isCreatingTask: boolean;
  onCloseTaskDialog: () => void;
  onCreateTaskFromLetter: () => void | Promise<void>;
  showArchiveSettings: boolean;
  setShowArchiveSettings: (v: boolean) => void;
  autoArchiveDays: number;
  setAutoArchiveDays: (v: number) => void;
  archiveSettingsScopeDescription: string;
  onSaveArchiveSettings: () => void | Promise<void>;
  selectedArchivedDocument: Document | null;
  showArchivedLetterDetails: boolean;
  setShowArchivedLetterDetails: (v: boolean) => void;
  setSelectedArchivedDocument: (v: Document | null) => void;
}

export function DocumentDialogs(props: DocumentDialogsProps) {
  return (
    <>
      <Dialog open={props.showEditDialog} onOpenChange={props.setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Dokument bearbeiten</DialogTitle>
            <DialogDescription>Bearbeiten Sie die Details des Dokuments</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Titel</Label><Input value={props.editTitle} onChange={(e) => props.setEditTitle(e.target.value)} placeholder="Dokumententitel" /></div>
            <div><Label>Beschreibung</Label><Textarea value={props.editDescription} onChange={(e) => props.setEditDescription(e.target.value)} placeholder="Optionale Beschreibung" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Kategorie</Label><Select value={props.editCategory} onValueChange={props.setEditCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{props.documentCategories.map((c) => <SelectItem key={c.id} value={c.name}>{c.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Status</Label><Select value={props.editStatus} onValueChange={props.setEditStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>Tags</Label><MultiSelect options={props.tags.map((t) => ({ value: t.label, label: t.label }))} selected={props.editTags} onChange={props.setEditTags} placeholder="Tags auswählen..." /></div>
            <div><Label>Ordner</Label><Select value={props.editFolderId || undefined} onValueChange={(v) => props.setEditFolderId(v || "")}><SelectTrigger><SelectValue placeholder="Kein Ordner" /></SelectTrigger><SelectContent>{props.folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => props.setShowEditDialog(false)}>Abbrechen</Button>
              <Button onClick={props.onUpdateDocument} disabled={!props.editTitle || props.loading}><Save className="h-4 w-4 mr-2" />Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={props.showMoveFolderDialog} onOpenChange={props.setShowMoveFolderDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Dokument verschieben</DialogTitle>
            <DialogDescription>Wählen Sie einen Zielordner für "{props.selectedDocument?.title}"</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Zielordner</Label><Select value={props.moveToFolderId || undefined} onValueChange={(v) => props.setMoveToFolderId(v || "")}><SelectTrigger><SelectValue placeholder="Kein Ordner (Hauptebene)" /></SelectTrigger><SelectContent>{props.folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { props.setShowMoveFolderDialog(false); props.setSelectedDocument(null); props.setMoveToFolderId(""); }}>Abbrechen</Button>
              <Button onClick={props.onMoveDocument}><FolderInput className="h-4 w-4 mr-2" />Verschieben</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={props.taskDialogMode !== null} onOpenChange={(open) => !open && props.onCloseTaskDialog()}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{props.taskDialogMode === "task" ? "Aufgabe aus Brief erstellen" : "Unteraufgabe aus Brief erstellen"}</DialogTitle>
            <DialogDescription>{props.taskDialogMode === "task" ? "Dieser Brief wird als neue Aufgabe angelegt." : "Wählen Sie eine Hauptaufgabe."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Titel</Label><Input value={props.taskTitle} onChange={(e) => props.setTaskTitle(e.target.value)} placeholder="Aufgabentitel" /></div>
            {props.taskDialogMode === "subtask" && (
              <div className="space-y-2"><Label>Übergeordnete Aufgabe</Label><Select value={props.parentTaskId} onValueChange={props.setParentTaskId}><SelectTrigger><SelectValue placeholder="Aufgabe wählen" /></SelectTrigger><SelectContent><SelectItem value="none">Bitte wählen</SelectItem>{props.availableParentTasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent></Select></div>
            )}
            {props.taskDialogMode === "task" && (
              <div className="space-y-2"><Label>Beschreibung</Label><Textarea value={props.taskDescription} onChange={(e) => props.setTaskDescription(e.target.value)} rows={5} /></div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={props.onCloseTaskDialog} disabled={props.isCreatingTask}>Abbrechen</Button>
            <Button onClick={props.onCreateTaskFromLetter} disabled={props.isCreatingTask}>
              {props.isCreatingTask && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {props.taskDialogMode === "task" ? "Aufgabe erstellen" : "Unteraufgabe erstellen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={props.showArchiveSettings} onOpenChange={props.setShowArchiveSettings}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Auto-Archivierung Einstellungen</DialogTitle>
            <DialogDescription>Konfigurieren Sie die automatische Archivierung von Briefen. {props.archiveSettingsScopeDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Archivierung nach (Tage)</Label>
              <Input type="number" value={props.autoArchiveDays} onChange={(e) => props.setAutoArchiveDays(Math.min(365, Math.max(1, parseInt(e.target.value, 10) || 30)))} min="1" max="365" />
              <p className="text-sm text-muted-foreground mt-1">Gültiger Bereich: 1 bis 365 Tage. Briefe werden nach {props.autoArchiveDays} Tagen nach Versand archiviert.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => props.setShowArchiveSettings(false)}>Abbrechen</Button>
              <Button onClick={props.onSaveArchiveSettings}>Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {props.selectedArchivedDocument && (
        <ArchivedLetterDetails
          document={toArchivedLetterDocumentRow(props.selectedArchivedDocument)}
          isOpen={props.showArchivedLetterDetails}
          onClose={() => {
            props.setShowArchivedLetterDetails(false);
            props.setSelectedArchivedDocument(null);
          }}
        />
      )}
    </>
  );
}
