import { useCallback, useMemo, useState } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { Plus, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { PlannerPostCard } from "./PlannerPostCard";
import { PlannerNoteCard } from "./PlannerNoteCard";
import { NOTE_COLORS, type PlannerNote } from "@/features/redaktion/hooks/usePlannerNotes";
import type { SocialPlannerItem } from "@/features/redaktion/hooks/useSocialPlannerItems";
import type { SpecialDay } from "@/utils/dashboard/specialDays";
import { ScrollArea } from "@/components/ui/scroll-area";
import { icons, Sparkles } from "lucide-react";

interface Props {
  view: "week" | "month";
  currentDate: Date;
  items: SocialPlannerItem[];
  specialDays: SpecialDay[];
  notes: PlannerNote[];
  onEditItem: (id: string) => void;
  onCreateAtSlot?: (date: Date) => void;
  onCreateNote: (noteDate: string, content: string, color?: string) => Promise<void>;
  onUpdateNote: (id: string, patch: Partial<Pick<PlannerNote, "content" | "color">>) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}

function getGridDays(view: "week" | "month", currentDate: Date) {
  if (view === "week") {
    const start = startOfWeek(currentDate, { locale: de });
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }
  const monthStart = startOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { locale: de });
  const monthEnd = endOfMonth(currentDate);
  const gridEnd = endOfWeek(monthEnd, { locale: de });
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

function DayCell({
  day,
  view,
  isCurrentMonth,
  items,
  specialDays,
  notes,
  onEditItem,
  onCreateAtSlot,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
}: {
  day: Date;
  view: "week" | "month";
  isCurrentMonth: boolean;
  items: SocialPlannerItem[];
  specialDays: SpecialDay[];
  notes: PlannerNote[];
  onEditItem: (id: string) => void;
  onCreateAtSlot?: (date: Date) => void;
  onCreateNote: (noteDate: string, content: string, color?: string) => Promise<void>;
  onUpdateNote: (id: string, patch: Partial<Pick<PlannerNote, "content" | "color">>) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteColor, setNewNoteColor] = useState("yellow");

  const today = isToday(day);
  const dateKey = format(day, "yyyy-MM-dd");

  const handleAddNote = useCallback(async () => {
    if (!newNoteText.trim()) return;
    try {
      await onCreateNote(dateKey, newNoteText.trim(), newNoteColor);
      setNewNoteText("");
      setNoteOpen(false);
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  }, [dateKey, newNoteColor, newNoteText, onCreateNote]);

  return (
    <div
      className={`group/cell relative flex flex-col border-r border-b ${
        view === "week" ? "min-h-[calc(100vh-280px)]" : "min-h-[120px]"
      } ${isCurrentMonth ? "bg-background" : "bg-muted/30"} ${
        today ? "ring-2 ring-inset ring-primary/30" : ""
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget && onCreateAtSlot) onCreateAtSlot(day);
      }}
    >
      {/* Day label (month view only — week header is separate) */}
      {view === "month" && (
        <div className="flex items-center justify-between px-1.5 py-1">
          <span
            className={`text-xs font-medium ${
              today
                ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                : isCurrentMonth
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {format(day, "d")}
          </span>
          <Popover open={noteOpen} onOpenChange={setNoteOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover/cell:opacity-100 transition-opacity"
              >
                <StickyNote className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-2" onClick={(e) => e.stopPropagation()}>
              <Textarea
                placeholder="Notiz…"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                className="min-h-[60px] text-xs"
              />
              <div className="flex items-center gap-1">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`h-5 w-5 rounded-full border-2 ${c.bg} ${
                      newNoteColor === c.value ? "ring-2 ring-primary ring-offset-1" : ""
                    }`}
                    onClick={() => setNewNoteColor(c.value)}
                  />
                ))}
              </div>
              <Button type="button" size="sm" className="w-full" onClick={() => void handleAddNote()}>
                Notiz hinzufügen
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Week view: add-note button */}
      {view === "week" && (
        <div className="flex justify-end px-1 pt-1">
          <Popover open={noteOpen} onOpenChange={setNoteOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover/cell:opacity-100 transition-opacity"
              >
                <StickyNote className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-2" onClick={(e) => e.stopPropagation()}>
              <Textarea
                placeholder="Notiz…"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                className="min-h-[60px] text-xs"
              />
              <div className="flex items-center gap-1">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`h-5 w-5 rounded-full border-2 ${c.bg} ${
                      newNoteColor === c.value ? "ring-2 ring-primary ring-offset-1" : ""
                    }`}
                    onClick={() => setNewNoteColor(c.value)}
                  />
                ))}
              </div>
              <Button type="button" size="sm" className="w-full" onClick={() => void handleAddNote()}>
                Notiz hinzufügen
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Content area */}
      <ScrollArea className="flex-1 px-1 pb-1">
        <div className="space-y-1.5">
          {/* Special days */}
          {specialDays.map((sd) => {
            const HintIcon = sd.icon ? (icons as any)[sd.icon] : Sparkles;
            return (
              <div
                key={`sd-${sd.month}-${sd.day}`}
                className="rounded-md border border-amber-300 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-700 p-1.5 text-[11px]"
              >
                <div className="flex items-center gap-1">
                  <HintIcon className="h-3 w-3 shrink-0 text-amber-700 dark:text-amber-400" />
                  <span className="font-medium text-amber-900 dark:text-amber-200 truncate">{sd.name}</span>
                </div>
                {sd.hint && (
                  <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 line-clamp-2 mt-0.5">{sd.hint}</p>
                )}
              </div>
            );
          })}

          {/* Notes */}
          {notes.map((note) => (
            <PlannerNoteCard key={note.id} note={note} onUpdate={onUpdateNote} onDelete={onDeleteNote} />
          ))}

          {/* Post cards */}
          {items.map((item) => (
            <PlannerPostCard key={item.id} item={item} onClick={() => onEditItem(item.id)} />
          ))}

          {/* Empty state + button */}
          {items.length === 0 && notes.length === 0 && specialDays.length === 0 && onCreateAtSlot && (
            <div
              className="flex items-center justify-center py-4 opacity-0 group-hover/cell:opacity-60 transition-opacity cursor-pointer"
              onClick={() => onCreateAtSlot(day)}
            >
              <Plus className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function PlannerCalendarGrid({
  view,
  currentDate,
  items,
  specialDays,
  notes,
  onEditItem,
  onCreateAtSlot,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
}: Props) {
  const days = useMemo(() => getGridDays(view, currentDate), [view, currentDate]);

  // Group items by date
  const itemsByDate = useMemo(() => {
    const map = new Map<string, SocialPlannerItem[]>();
    for (const item of items) {
      if (!item.scheduled_for) continue;
      const key = format(new Date(item.scheduled_for), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items]);

  // Group notes by date
  const notesByDate = useMemo(() => {
    const map = new Map<string, PlannerNote[]>();
    for (const note of notes) {
      if (!map.has(note.note_date)) map.set(note.note_date, []);
      map.get(note.note_date)!.push(note);
    }
    return map;
  }, [notes]);

  // Group special days by date
  const specialDaysByDate = useMemo(() => {
    const map = new Map<string, SpecialDay[]>();
    for (const sd of specialDays) {
      // Check if this special day falls in any of our grid days
      for (const day of days) {
        if (day.getMonth() + 1 === sd.month && day.getDate() === sd.day) {
          const key = format(day, "yyyy-MM-dd");
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(sd);
        }
      }
    }
    return map;
  }, [specialDays, days]);

  const weekDayHeaders = useMemo(
    () =>
      days.slice(0, 7).map((d) => ({
        label: format(d, "EEE", { locale: de }),
        day: d,
      })),
    [days],
  );

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {view === "week"
          ? days.map((d) => {
              const today = isToday(d);
              return (
                <div key={d.toISOString()} className="border-r px-2 py-2 text-center last:border-r-0">
                  <span className="text-xs text-muted-foreground">{format(d, "EEE", { locale: de })}</span>
                  <br />
                  <span
                    className={`text-sm font-semibold ${
                      today
                        ? "inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {format(d, "d")}
                  </span>
                </div>
              );
            })
          : weekDayHeaders.map((h) => (
              <div key={h.label} className="border-r px-2 py-2 text-center text-xs font-medium text-muted-foreground last:border-r-0">
                {h.label}
              </div>
            ))}
      </div>

      {/* Grid body */}
      {view === "week" ? (
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            return (
              <DayCell
                key={key}
                day={day}
                view="week"
                isCurrentMonth={true}
                items={itemsByDate.get(key) || []}
                specialDays={specialDaysByDate.get(key) || []}
                notes={notesByDate.get(key) || []}
                onEditItem={onEditItem}
                onCreateAtSlot={onCreateAtSlot}
                onCreateNote={onCreateNote}
                onUpdateNote={onUpdateNote}
                onDeleteNote={onDeleteNote}
              />
            );
          })}
        </div>
      ) : (
        weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              return (
                <DayCell
                  key={key}
                  day={day}
                  view="month"
                  isCurrentMonth={isSameMonth(day, currentDate)}
                  items={itemsByDate.get(key) || []}
                  specialDays={specialDaysByDate.get(key) || []}
                  notes={notesByDate.get(key) || []}
                  onEditItem={onEditItem}
                  onCreateAtSlot={onCreateAtSlot}
                  onCreateNote={onCreateNote}
                  onUpdateNote={onUpdateNote}
                  onDeleteNote={onDeleteNote}
                />
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
