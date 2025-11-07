import * as React from "react";
import { Clock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TimePickerSelectProps {
  value: string;
  onChange: (value: string) => void;
  interval?: 5 | 10 | 15 | 30;
  startHour?: number;
  endHour?: number;
  disabled?: boolean;
  placeholder?: string;
}

function generateTimeOptions(
  startHour: number,
  endHour: number,
  interval: number
): string[] {
  const times: string[] = [];
  
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += interval) {
      const timeString = `${hour.toString().padStart(2, "0")}:${minute
        .toString()
        .padStart(2, "0")}`;
      times.push(timeString);
    }
  }
  
  // Add the end hour at 00 minutes if we haven't exceeded it
  if (endHour <= 24) {
    times.push(`${endHour.toString().padStart(2, "0")}:00`);
  }
  
  return times;
}

export function TimePickerSelect({
  value,
  onChange,
  interval = 15,
  startHour = 0,
  endHour = 24,
  disabled = false,
  placeholder = "Zeit wählen",
}: TimePickerSelectProps) {
  const timeOptions = React.useMemo(
    () => generateTimeOptions(startHour, endHour, interval),
    [startHour, endHour, interval]
  );

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <Clock className="mr-2 h-4 w-4" />
        <SelectValue placeholder={placeholder}>
          {value || placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {timeOptions.map((time) => (
          <SelectItem key={time} value={time}>
            {time}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
