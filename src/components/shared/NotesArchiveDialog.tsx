import { useState } from "react";
import { Archive } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { NotesArchive } from "@/components/shared/NotesArchive";

interface NotesArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refreshTrigger?: number;
  onRestore?: () => void;
}

export function NotesArchiveDialog({
  open,
  onOpenChange,
  refreshTrigger,
  onRestore,
}: NotesArchiveDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Archiv & Papierkorb
          </SheetTitle>
          <SheetDescription>
            Archivierte und gelöschte Notizen verwalten
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-4">
          <NotesArchive 
            refreshTrigger={refreshTrigger} 
            onRestore={() => {
              onRestore?.();
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
