import { useNavigate } from "react-router-dom";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendarHeaderProps {
  currentDate: Date;
  view: string;
  onNavigateDate: (direction: "prev" | "next") => void;
  onToday: () => void;
  onViewChange: (view: string) => void;
  onShowPolls: () => void;
}

const formatDate = (date: Date) =>
  date.toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

const formatMonth = (date: Date) =>
  date.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

export function CalendarHeader({ currentDate, view, onNavigateDate, onToday, onViewChange, onShowPolls }: CalendarHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="h-full border-r bg-muted/30 p-4">
      <div className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold text-foreground mb-1">Terminkalender</h1>
        <p className="text-muted-foreground text-sm">{formatDate(currentDate)}</p>
      </div>

      <div className="space-y-2 mb-6">
        <Button className="w-full justify-start gap-2 min-h-[44px]" onClick={() => navigate("/calendar?action=create-appointment")}>
          <Plus className="h-4 w-4" />
          Neuer Termin
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2 min-h-[44px]" onClick={onShowPolls}>
          Abstimmungen
        </Button>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium capitalize">{formatMonth(currentDate)}</p>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onNavigateDate("prev")} className="min-h-[38px] min-w-[38px] px-2">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onToday} className="min-h-[38px] flex-1">
            Heute
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigateDate("next")} className="min-h-[38px] min-w-[38px] px-2">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant={view === "day" ? "default" : "outline"} size="sm" onClick={() => onViewChange("day")}>
            Tag
          </Button>
          <Button variant={view === "week" ? "default" : "outline"} size="sm" onClick={() => onViewChange("week")}>
            Woche
          </Button>
          <Button variant={view === "month" ? "default" : "outline"} size="sm" onClick={() => onViewChange("month")}>
            Monat
          </Button>
          <Button variant={view === "agenda" ? "default" : "outline"} size="sm" onClick={() => onViewChange("agenda")}>
            Agenda
          </Button>
        </div>
      </div>
    </div>
  );
}
