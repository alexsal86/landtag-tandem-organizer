import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, Archive, Search, X } from "lucide-react";
import { QuickNotesList } from "@/components/shared/QuickNotesList";
import { GlobalNoteShareDialog } from "@/components/shared/GlobalNoteShareDialog";
import { NotesArchiveDialog } from "@/components/shared/NotesArchiveDialog";
import { Input } from "@/components/ui/input";

interface MyWorkNotesListProps {
  refreshTrigger?: number;
}

export function MyWorkNotesList({ refreshTrigger }: MyWorkNotesListProps) {
  const [globalShareOpen, setGlobalShareOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [localRefreshTrigger, setLocalRefreshTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [counts, setCounts] = useState({ filteredCount: 0, totalCount: 0 });

  const handleArchiveRestore = () => {
    // Trigger refresh of the notes list when restoring from archive/trash
    setLocalRefreshTrigger(prev => prev + 1);
  };

  return (
    <>
      <Card className="flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Meine Notizen</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Notizen durchsuchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-8 text-sm"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
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
          {searchQuery && (
            <p className="text-xs text-muted-foreground mt-2">
              {counts.filteredCount} von {counts.totalCount} Notizen gefunden
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <QuickNotesList 
            refreshTrigger={(refreshTrigger || 0) + localRefreshTrigger} 
            showHeader={false}
            maxHeight="none"
            searchPlacement="hidden"
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onCountsChange={setCounts}
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
        refreshTrigger={localRefreshTrigger}
        onRestore={handleArchiveRestore}
      />
    </>
  );
}
