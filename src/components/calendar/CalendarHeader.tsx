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

      <div className="mt-6 rounded-lg border bg-background/70 p-2">
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
            month_caption: "flex flex-row items-center justify-between gap-2",
            caption_label: "text-base font-semibold text-left capitalize",
            nav: "flex items-center justify-end gap-1",
            button_previous: "h-7 w-7 border-0 bg-transparent p-0 shadow-none hover:bg-accent/60",
            button_next: "h-7 w-7 border-0 bg-transparent p-0 shadow-none hover:bg-accent/60",
            week_number: "h-9 w-9 rounded-md bg-muted text-sm font-normal text-foreground",
            week_number_header: "h-9 w-9 rounded-md bg-muted text-sm font-normal text-muted-foreground",
          }}
          className="w-full p-0"
        />
      </div>
    </div>
  );
}
