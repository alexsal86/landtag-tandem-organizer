import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

interface CalendarHeaderProps {
  onShowPolls: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function CalendarHeader({ onShowPolls, selectedDate, onSelectDate }: CalendarHeaderProps) {
  const navigate = useNavigate();

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
            month_caption: "flex w-full flex-row items-center justify-between gap-1 px-1 mb-1",
            caption_label: "text-sm font-semibold text-left capitalize",
            nav: "flex w-auto items-center gap-0.5",
            button_previous: "h-6 w-6 border-0 bg-transparent p-0 shadow-none hover:bg-accent/60",
            button_next: "h-6 w-6 border-0 bg-transparent p-0 shadow-none hover:bg-accent/60",
            month_grid: "w-full border-collapse space-y-0",
            weekdays: "flex",
            weekday: "text-muted-foreground w-7 font-normal text-[0.7rem]",
            week: "flex w-full mt-0",
            day: "h-7 w-7 text-center text-xs p-0 relative focus-within:relative focus-within:z-20",
            day_button: "h-7 w-7 p-0 font-normal text-xs aria-selected:opacity-100",
            week_number: "h-7 w-7 bg-muted text-[0.65rem] font-normal text-muted-foreground flex items-center justify-center",
            week_number_header: "h-7 w-7 bg-muted text-[0.65rem] font-normal text-muted-foreground",
          }}
          className="w-full p-0"
        />
      </div>
    </div>
  );
}
