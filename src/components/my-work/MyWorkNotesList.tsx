import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StickyNote } from "lucide-react";
import { QuickNotesList } from "@/components/shared/QuickNotesList";

interface MyWorkNotesListProps {
  refreshTrigger?: number;
}

export function MyWorkNotesList({ refreshTrigger }: MyWorkNotesListProps) {
  return (
    <Card className="flex-1">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Meine Notizen
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <QuickNotesList 
          refreshTrigger={refreshTrigger} 
          showHeader={false}
          maxHeight="400px"
        />
      </CardContent>
    </Card>
  );
}
