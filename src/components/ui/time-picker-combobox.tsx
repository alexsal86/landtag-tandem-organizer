import * as React from "react";
import { Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface TimePickerComboboxProps {
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
  
  if (endHour <= 24) {
    times.push(`${endHour.toString().padStart(2, "0")}:00`);
  }
  
  return times;
}

function validateTimeFormat(value: string): boolean {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(value);
}

function formatTimeInput(value: string): string {
  // Remove non-numeric characters except colon
  const cleaned = value.replace(/[^\d:]/g, "");
  
  // Auto-format: if 4 digits without colon, insert colon
  if (/^\d{4}$/.test(cleaned)) {
    return `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`;
  }
  
  // Auto-format: if 3 digits, assume H:MM format
  if (/^\d{3}$/.test(cleaned)) {
    return `0${cleaned.slice(0, 1)}:${cleaned.slice(1, 3)}`;
  }
  
  return cleaned;
}

export function TimePickerCombobox({
  value,
  onChange,
  interval = 15,
  startHour = 0,
  endHour = 24,
  disabled = false,
  placeholder = "Zeit wählen",
}: TimePickerComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value);
  const [isValid, setIsValid] = React.useState(true);
  
  const timeOptions = React.useMemo(
    () => generateTimeOptions(startHour, endHour, interval),
    [startHour, endHour, interval]
  );

  // Sync inputValue with value prop
  React.useEffect(() => {
    setInputValue(value);
    if (value) {
      setIsValid(validateTimeFormat(value));
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTimeInput(e.target.value);
    setInputValue(formatted);
    
    if (formatted.length === 5) {
      const valid = validateTimeFormat(formatted);
      setIsValid(valid);
      if (valid) {
        onChange(formatted);
      }
    }
  };

  const handleInputBlur = () => {
    if (inputValue && !validateTimeFormat(inputValue)) {
      // Reset to last valid value or empty
      setInputValue(value);
      setIsValid(true);
    }
  };

  const handleSelectTime = (time: string) => {
    setInputValue(time);
    onChange(time);
    setIsValid(true);
    setOpen(false);
  };

  return (
    <div className="relative flex items-center gap-1">
      <div className="relative flex-1">
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "pl-9 pr-3",
            !isValid && "border-destructive focus-visible:ring-destructive"
          )}
          maxLength={5}
        />
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-10 w-10 p-0"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="end">
          <Command>
            <CommandList>
              <CommandEmpty>Keine Zeit gefunden.</CommandEmpty>
              <CommandGroup className="max-h-[300px] overflow-y-auto">
                {timeOptions.map((time) => (
                  <CommandItem
                    key={time}
                    value={time}
                    onSelect={() => handleSelectTime(time)}
                  >
                    {time}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
