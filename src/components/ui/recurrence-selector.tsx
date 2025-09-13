import { useState } from "react";
import { Repeat, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface RecurrenceData {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  weekdays: number[];
  endDate?: string;
}

interface RecurrenceSelectorProps {
  value: RecurrenceData;
  onChange: (data: RecurrenceData) => void;
  startDate: string;
}

export function RecurrenceSelector({ value, onChange, startDate }: RecurrenceSelectorProps) {
  const weekdayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  
  const handleEnabledChange = (enabled: boolean) => {
    onChange({ ...value, enabled });
  };
  
  const handleFrequencyChange = (frequency: "daily" | "weekly" | "monthly" | "yearly") => {
    onChange({ ...value, frequency, weekdays: [] });
  };
  
  const handleIntervalChange = (interval: number) => {
    onChange({ ...value, interval: Math.max(1, interval) });
  };
  
  const handleWeekdayToggle = (day: number) => {
    const weekdays = value.weekdays.includes(day)
      ? value.weekdays.filter(d => d !== day)
      : [...value.weekdays, day].sort();
    onChange({ ...value, weekdays });
  };
  
  const handleEndDateChange = (endDate: string) => {
    onChange({ ...value, endDate: endDate || undefined });
  };
  
  const getFrequencyLabel = () => {
    const labels = {
      daily: `täglich`,
      weekly: `wöchentlich`,
      monthly: `monatlich`,
      yearly: `jährlich`
    };
    
    if (value.interval > 1) {
      const plurals = {
        daily: `alle ${value.interval} Tage`,
        weekly: `alle ${value.interval} Wochen`,
        monthly: `alle ${value.interval} Monate`,
        yearly: `alle ${value.interval} Jahre`
      };
      return plurals[value.frequency];
    }
    
    return labels[value.frequency];
  };
  
  // Calculate minimum end date (at least one day after start date)
  const minEndDate = new Date(startDate);
  minEndDate.setDate(minEndDate.getDate() + 1);
  const minEndDateStr = minEndDate.toISOString().split('T')[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="recurrence-enabled"
            checked={value.enabled}
            onCheckedChange={handleEnabledChange}
          />
          <Label htmlFor="recurrence-enabled" className="flex items-center gap-2 cursor-pointer">
            <Repeat className="h-4 w-4" />
            Wiederholen
          </Label>
        </div>
      </CardHeader>
      
      {value.enabled && (
        <CardContent className="pt-0 space-y-4">
          {/* Frequency Selection */}
          <div className="space-y-2">
            <Label>Häufigkeit</Label>
            <div className="flex items-center space-x-2">
              <span className="text-sm">Alle</span>
              <Input
                type="number"
                min="1"
                max="365"
                value={value.interval}
                onChange={(e) => handleIntervalChange(parseInt(e.target.value) || 1)}
                className="w-20"
              />
              <Select value={value.frequency} onValueChange={handleFrequencyChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Tag(e)</SelectItem>
                  <SelectItem value="weekly">Woche(n)</SelectItem>
                  <SelectItem value="monthly">Monat(e)</SelectItem>
                  <SelectItem value="yearly">Jahr(e)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Weekly: Weekday Selection */}
          {value.frequency === "weekly" && (
            <div className="space-y-2">
              <Label>Wochentage</Label>
              <div className="flex gap-1">
                {weekdayNames.map((name, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleWeekdayToggle(index)}
                    className={`w-8 h-8 rounded-full text-xs font-medium border transition-colors ${
                      value.weekdays.includes(index)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {value.weekdays.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Wählen Sie mindestens einen Wochentag aus
                </p>
              )}
            </div>
          )}
          
          {/* End Date */}
          <div className="space-y-2">
            <Label>Ende der Wiederholung (optional)</Label>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <Input
                type="date"
                value={value.endDate || ""}
                onChange={(e) => handleEndDateChange(e.target.value)}
                min={minEndDateStr}
                className="w-auto"
              />
            </div>
            {value.endDate && (
              <p className="text-sm text-muted-foreground">
                Wiederholung endet am {new Date(value.endDate).toLocaleDateString('de-DE')}
              </p>
            )}
          </div>
          
          {/* Summary */}
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm font-medium mb-1">Zusammenfassung:</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">
                {getFrequencyLabel()}
              </Badge>
              {value.frequency === "weekly" && value.weekdays.length > 0 && (
                <Badge variant="outline">
                  {value.weekdays.map(day => weekdayNames[day]).join(", ")}
                </Badge>
              )}
              {value.endDate && (
                <Badge variant="outline">
                  bis {new Date(value.endDate).toLocaleDateString('de-DE')}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}