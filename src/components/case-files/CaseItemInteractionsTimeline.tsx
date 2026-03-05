import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Share2, Handshake, NotebookPen, Send, Bot } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { CaseItemInteraction } from "@/hooks/useCaseFileDetails";

const iconByType = {
  call: Phone,
  email: Mail,
  social: Share2,
  meeting: Handshake,
  note: NotebookPen,
  letter: Send,
  system: Bot,
};

export function CaseItemInteractionsTimeline({ interactions }: { interactions: CaseItemInteraction[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Interaktionen (chronologisch)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {interactions.length === 0 ? <p className="text-xs text-muted-foreground">Noch keine Interaktionen erfasst.</p> : interactions.map((item) => {
          const Icon = iconByType[item.interaction_type] ?? NotebookPen;
          return (
            <div key={item.id} className="border rounded-md p-2">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5" />
                <p className="text-sm font-medium">{item.subject}</p>
                <Badge variant="outline" className="text-[10px]">{item.interaction_type}</Badge>
                <Badge variant="outline" className="text-[10px]">{item.direction}</Badge>
                {item.is_resolution && <Badge className="text-[10px]">resolution</Badge>}
              </div>
              {item.details && <p className="text-xs text-muted-foreground mt-1">{item.details}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(item.created_at), "dd.MM.yyyy HH:mm", { locale: de })}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
