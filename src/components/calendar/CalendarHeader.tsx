import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarSidebarSources, type CalendarSource } from "./CalendarSidebarSources";

interface CalendarHeaderProps {
  onShowPolls: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  hiddenSourceKeys: string[];
  onToggleSourceVisibility: (source: CalendarSource) => void;
}

export function CalendarHeader({
  onShowPolls,
  selectedDate,
  onSelectDate,
  hiddenSourceKeys,
  onToggleSourceVisibility,
}: CalendarHeaderProps) {
  const navigate = useNavigate();

  const changeMonthPreservingDay = (direction: 1 | -1) => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();

    const targetMonthDate = new Date(year, month + direction, 1);
    const targetYear = targetMonthDate.getFullYear();
    const targetMonth = targetMonthDate.getMonth();
    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

    onSelectDate(new Date(targetYear, targetMonth, Math.min(day, daysInTargetMonth)));
  };

  return (
    <div className="h-full border-r bg-muted/30 p-4 overflow-y-auto">
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

      <div className="mt-6 rounded-lg border bg-background/70 p-1.5">
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-sm font-semibold capitalize">
            {selectedDate.toLocaleString("de-DE", { month: "long", year: "numeric" })}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent/60"
              onClick={() => changeMonthPreservingDay(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent/60"
              onClick={() => changeMonthPreservingDay(1)}
            >
              ›
            </button>
          </div>
        </div>

        <Calendar
          mode="single"
          month={selectedDate}
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            onSelectDate(date);
          }}
          onMonthChange={onSelectDate}
          showWeekNumber
          classNames={{
            month_caption: "hidden",
            nav: "hidden",
            month_grid: "w-full border-collapse space-y-0",
            weekdays: "flex",
            weekday: "text-muted-foreground w-6 font-normal text-[0.7rem]",
            week: "flex w-full mt-0",
            day: "h-6 w-6 text-center text-xs p-0 relative focus-within:relative focus-within:z-20",
            day_button: "h-6 w-6 p-0 font-normal text-xs aria-selected:opacity-100",
            week_number: "h-6 w-6 bg-muted text-[0.65rem] font-normal text-muted-foreground flex items-center justify-center",
            week_number_header: "h-6 w-6 bg-muted text-[0.65rem] font-normal text-muted-foreground",
          }}
          className="w-full p-0"
        />
      </div>

      <CalendarSidebarSources
        hiddenSourceKeys={hiddenSourceKeys}
        onToggleVisibility={onToggleSourceVisibility}
      />
    </div>
  );
}
