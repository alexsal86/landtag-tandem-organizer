import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StickyNote, Globe, Archive } from "lucide-react";
import { QuickNotesList } from "@/components/shared/QuickNotesList";
import { GlobalNoteShareDialog } from "@/components/shared/GlobalNoteShareDialog";
import { NotesArchiveDialog } from "@/components/shared/NotesArchiveDialog";

interface MyWorkNotesListProps {
  refreshTrigger?: number;
}

export function MyWorkNotesList({ refreshTrigger }: MyWorkNotesListProps) {
  const [globalShareOpen, setGlobalShareOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveRefreshTrigger, setArchiveRefreshTrigger] = useState(0);

  const handleArchiveRestore = () => {
    // Trigger refresh of the notes list
    setArchiveRefreshTrigger(prev => prev + 1);
  };

  return (
    <>
      <Card className="flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Meine Notizen
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setArchiveOpen(true)}
                title="Archiv & Papierkorb"
              >
                <Archive className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setGlobalShareOpen(true)}
                title="Alle Notizen freigeben"
              >
                <Globe className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <QuickNotesList 
            refreshTrigger={refreshTrigger} 
            showHeader={false}
            maxHeight="none"
          />
        </CardContent>
      </Card>

      <GlobalNoteShareDialog
        open={globalShareOpen}
        onOpenChange={setGlobalShareOpen}
      />
      
      <NotesArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        refreshTrigger={archiveRefreshTrigger}
        onRestore={handleArchiveRestore}
      />
    </>
  );
}
