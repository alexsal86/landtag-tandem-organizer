import { useState } from "react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { describeTaskCommand, parseTaskCommand, type TaskCommand } from "@/features/tasks/stafette";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle?: string;
  people: Array<{ user_id: string; display_name: string | null }>;
  onSubmit: (command: TaskCommand) => void;
}

const EXAMPLES = ["frist +1w", "frist +3t", "an Max", "wartet auf Ministerium", "prio hoch", "erledigt"];

/** Tippen statt klicken: „frist +1w", „an Max", „wartet auf …". */
export function TaskCommandPalette({ open, onOpenChange, taskTitle, people, onSubmit }: Props) {
  const [query, setQuery] = useState("");
  const command = parseTaskCommand(query);

  const close = () => {
    setQuery("");
    onOpenChange(false);
  };

  const matches =
    command?.kind === "assign"
      ? people.filter((person) => (person.display_name ?? "").toLocaleLowerCase("de").includes(command.query.toLocaleLowerCase("de"))).slice(0, 8)
      : [];

  return (
    <CommandDialog open={open} onOpenChange={(next) => { if (!next) close(); else onOpenChange(true); }}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={taskTitle ? `Befehl für „${taskTitle}"` : "Aufgabe auswählen und Befehl tippen …"}
      />
      <CommandList>
        <CommandEmpty>Kein Befehl erkannt. Beispiele stehen unten.</CommandEmpty>

        {command && (
          <CommandGroup heading="Befehl">
            <CommandItem
              value={`run-${query}`}
              onSelect={() => { onSubmit(command); close(); }}
            >
              {describeTaskCommand(command, (personQuery) =>
                people.find((person) => (person.display_name ?? "").toLocaleLowerCase("de").includes(personQuery.toLocaleLowerCase("de")))?.display_name ?? undefined,
              )}
            </CommandItem>
          </CommandGroup>
        )}

        {matches.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Personen">
              {matches.map((person) => (
                <CommandItem
                  key={person.user_id}
                  value={`person-${person.user_id}`}
                  onSelect={() => { onSubmit({ kind: "assign", query: person.display_name ?? "" }); close(); }}
                >
                  {person.display_name ?? "Unbenannt"}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {!command && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Beispiele">
              {EXAMPLES.map((example) => (
                <CommandItem key={example} value={`example-${example}`} onSelect={() => setQuery(example)}>
                  {example}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
