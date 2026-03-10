import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendarHeaderProps {
  onShowPolls: () => void;
}

export function CalendarHeader({ onShowPolls }: CalendarHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="h-full border-r bg-muted/30 p-4">
      <div className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold text-foreground mb-1">Terminkalender</h1>
      </div>

      <div className="space-y-2">
        <Button className="w-full justify-start gap-2 min-h-[44px]" onClick={() => navigate("/calendar?action=create-appointment")}>
          <Plus className="h-4 w-4" />
          Neuer Termin
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2 min-h-[44px]" onClick={onShowPolls}>
          Abstimmungen
        </Button>
      </div>
    </div>
  );
}
