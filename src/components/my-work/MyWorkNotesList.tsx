import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StickyNote, Globe } from "lucide-react";
import { QuickNotesList } from "@/components/shared/QuickNotesList";
import { GlobalNoteShareDialog } from "@/components/shared/GlobalNoteShareDialog";

interface MyWorkNotesListProps {
  refreshTrigger?: number;
}

export function MyWorkNotesList({ refreshTrigger }: MyWorkNotesListProps) {
  const [globalShareOpen, setGlobalShareOpen] = useState(false);

  return (
    <>
      <Card className="flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Meine Notizen
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setGlobalShareOpen(true)}
              title="Alle Notizen freigeben"
            >
              <Globe className="h-4 w-4" />
            </Button>
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
    </>
  );
}
