import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { loadTopicSuggestions } from "./page";

export function TopicFilter({ period, value, onChange }: {
  period: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const search = input.trim().toLocaleLowerCase("de-DE");

  useEffect(() => {
    if (!open || search.length < 2) return;
    const timer = window.setTimeout(() => setTerm(search), 250);
    return () => window.clearTimeout(timer);
  }, [open, search]);

  const ready = search.length >= 2 && search === term;
  const suggestions = useQuery({
    queryKey: ["parlis-topic-suggestions", period, term],
    queryFn: ({ signal }) => loadTopicSuggestions(period, term, signal),
    enabled: open && ready,
    staleTime: 60 * 60 * 1000,
  });

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setInput("");
      setTerm("");
    }
  }

  function select(topic: string) {
    onChange(topic);
    changeOpen(false);
  }

  const status = search.length < 2 ? "Mindestens zwei Zeichen eingeben."
    : !ready || suggestions.isPending ? "Schlagwörter werden gesucht …"
    : suggestions.isError ? "Schlagwörter konnten nicht geladen werden."
    : suggestions.data?.length === 0 ? "Keine passenden Schlagwörter." : "";

  return <div className="parlis-topic-filter">
    <span>Schlagwort</span>
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={`Schlagwort: ${value || "Alle"}`} className="parlis-topic-trigger">
          <span className="truncate">{value || "Alle Schlagwörter"}</span>
          <ChevronDown size={14} className="shrink-0" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-[calc(100vw-2rem)] p-0" aria-label="Schlagwortfilter">
        <Command shouldFilter={false} label="Schlagwort suchen">
          <CommandInput value={input} onValueChange={setInput} placeholder="Schlagwort suchen …" aria-label="Schlagwort suchen" />
          {status && <p role="status" className="px-3 py-2 text-sm text-muted-foreground">{status}</p>}
          {ready && suggestions.isError && <Button variant="link" onClick={() => void suggestions.refetch()}>Erneut suchen</Button>}
          <CommandList className="max-h-60">
            {value && <CommandItem value="__clear_topic" onSelect={() => select("")}>Schlagwortfilter entfernen</CommandItem>}
            {ready && suggestions.data?.map(topic => <CommandItem key={topic} value={topic} onSelect={() => select(topic)}>{topic}</CommandItem>)}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>;
}
