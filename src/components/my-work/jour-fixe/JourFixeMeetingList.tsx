import { ChevronDown, ChevronRight } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Meeting } from "@/hooks/useMyWorkJourFixeMeetings";

interface JourFixeMeetingListProps {
  title: string;
  meetings: Meeting[];
  emptyText: string;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  children: ReactNode;
}

export function JourFixeMeetingList({ title, meetings, emptyText, open, setOpen, children }: JourFixeMeetingListProps) {
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-start p-2 h-auto">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-medium">{title}</span>
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-2">
        {meetings.length === 0 ? <p className="text-sm text-muted-foreground px-2">{emptyText}</p> : children}
      </CollapsibleContent>
    </Collapsible>
  );
}
