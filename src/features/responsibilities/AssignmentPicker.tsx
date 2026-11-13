import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  referenceOf,
  type Responsibility,
  type ResponsibilityArea,
} from "./suggest";
export type ChangeResponsibility = (
  userId: string,
  kind: string,
  reference: string,
  level: string | null,
) => Promise<boolean>;
const responsibilityStyle = (level: string) =>
  level === "primary"
    ? "border-primary/40 bg-primary/10 text-foreground"
    : "border-transparent bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200";
export function PersonMark({ name }: { name: string }) {
  return (
    <Avatar className="h-6 w-6">
      <AvatarFallback className="bg-primary/15 text-xs text-primary">
        {name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((n) => n[0])
          .join("")}
      </AvatarFallback>
    </Avatar>
  );
}
export function PersonAssignment({
  person,
  area,
  level,
  canEdit,
  busy,
  onChange,
  label,
}: {
  person: { id: string; name: string };
  area: { id: string; kind: string; name: string };
  level: string;
  canEdit: boolean;
  busy: boolean;
  onChange: ChangeResponsibility;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const content = (
    <>
      <PersonMark name={person.name} />
      <span>{label ?? person.name}</span>
    </>
  );
  const style = cn(
    "inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm",
    responsibilityStyle(level),
  );
  if (!canEdit)
    return (
      <span
        className={style}
        title={`${area.name} · ${level === "primary" ? "Primär" : "Sekundär"}`}
      >
        {content}
      </span>
    );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={busy}
          className={cn(
            style,
            "text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          )}
          aria-label={`${person.name} · ${area.name}: ${level === "primary" ? "Primär" : "Sekundär"} ändern`}
        >
          {content}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-1" align="start">
        <p className="px-2 text-sm font-medium">
          {person.name} · {area.name}
        </p>
        {[
          { value: "primary", label: "Primär" },
          { value: "secondary", label: "Sekundär" },
          { value: null, label: "Nicht zuständig" },
        ].map((option) => (
          <Button
            key={option.label}
            variant="ghost"
            className="w-full justify-between"
            disabled={busy}
            aria-pressed={level === option.value}
            onClick={() => {
              void onChange(person.id, area.kind, area.id, option.value).then(
                (ok) => {
                  if (ok) setOpen(false);
                },
              );
            }}
          >
            {option.label}
            {level === option.value && <Check className="h-4 w-4" />}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
export function AreaAssignmentPicker({
  area,
  level,
  people,
  rows,
  busy,
  onChange,
}: {
  area: ResponsibilityArea;
  level: "primary" | "secondary";
  people: { id: string; name: string }[];
  rows: Responsibility[];
  busy: boolean;
  onChange: ChangeResponsibility;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-dashed"
          aria-label={`${area.name}: ${level === "primary" ? "Primärpersonen" : "Sekundärpersonen"} auswählen`}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="sr-only">
            {level === "primary" ? "Primär" : "Sekundär"}{" "}
          </span>
          Zuweisen
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Person suchen …" />
          <CommandList>
            <CommandEmpty>Keine Person gefunden.</CommandEmpty>
            <CommandGroup
              heading={`${area.name} · ${level === "primary" ? "Primär" : "Sekundär"}`}
            >
              {people.map((person) => {
                const current = rows.find(
                  (r) =>
                    r.user_id === person.id &&
                    r.kind === area.kind &&
                    referenceOf(r) === area.id,
                )?.level;
                return (
                  <CommandItem
                    key={person.id}
                    value={`${person.name} ${person.id}`}
                    disabled={busy}
                    onSelect={() => {
                      void onChange(
                        person.id,
                        area.kind,
                        area.id,
                        current === level ? null : level,
                      );
                    }}
                  >
                    <PersonMark name={person.name} />
                    <span className="flex-1">{person.name}</span>
                    {current === level ? (
                      <Check className="h-4 w-4" />
                    ) : current ? (
                      <span className="text-xs text-muted-foreground">
                        {current === "primary" ? "Primär" : "Sekundär"}
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
