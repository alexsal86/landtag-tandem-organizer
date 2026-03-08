import React from "react";
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

export function CalendarHeader({ currentDate, view, onNavigateDate, onToday, onViewChange, onShowPolls }: CalendarHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Terminkalender</h1>
          <p className="text-muted-foreground text-sm sm:text-base">{formatDate(currentDate)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2 min-h-[44px]" onClick={() => navigate("/calendar?action=create-appointment")}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Neuer Termin</span>
            <span className="sm:hidden">Neu</span>
          </Button>
          <Button variant="outline" className="gap-2 min-h-[44px]" onClick={onShowPolls}>
            Abstimmungen
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onNavigateDate("prev")} className="min-h-[44px] min-w-[44px]">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onToday} className="min-h-[44px]">
            Heute
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigateDate("next")} className="min-h-[44px] min-w-[44px]">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {(["day", "week", "month", "agenda"] as const).map((vt) => (
            <Button key={vt} variant={view === vt ? "default" : "outline"} size="sm" onClick={() => onViewChange(vt)} className="whitespace-nowrap min-h-[44px]">
              {vt === "day" ? "Tag" : vt === "week" ? "Woche" : vt === "month" ? "Monat" : "Agenda"}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
