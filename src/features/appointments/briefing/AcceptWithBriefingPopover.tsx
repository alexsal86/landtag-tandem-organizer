import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenantUsers } from "@/hooks/useTenantUsers";
import { suggestBriefingDue } from "../briefing";

export type AcceptBriefingChoice =
  | { briefing: undefined }
  | { briefing: "none" }
  | { briefing: "assigned"; assignee: string; due: string; instructions?: string };

interface Props { start: Date; trigger: ReactNode; disabled?: boolean; onAccept: (c: AcceptBriefingChoice) => Promise<void> | void }

/** Accept a request and decide the briefing in the same step. */
export function AcceptWithBriefingPopover({ start, trigger, disabled, onAccept }: Props) {
  const { users } = useTenantUsers();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"later" | "none" | "assigned">("later");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState(() => format(suggestBriefingDue(start), "yyyy-MM-dd'T'HH:mm"));
  const [instructions, setInstructions] = useState("");

  const submit = async () => {
    if (mode === "assigned") {
      if (!assignee) return;
      await onAccept({ briefing: "assigned", assignee, due: new Date(due).toISOString(), instructions: instructions.trim() || undefined });
    } else {
      await onAccept(mode === "none" ? { briefing: "none" } : { briefing: undefined });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <p className="text-label font-medium">Zusagen – und Briefing?</p>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="space-y-1">
          <div className="flex items-center gap-2"><RadioGroupItem id="b-later" value="later" /><Label htmlFor="b-later">Später klären</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem id="b-none" value="none" /><Label htmlFor="b-none">Kein Briefing</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem id="b-assign" value="assigned" /><Label htmlFor="b-assign">Briefing vergeben</Label></div>
        </RadioGroup>
        {mode === "assigned" && (
          <div className="space-y-2">
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger><SelectValue placeholder="Person wählen" /></SelectTrigger>
              <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            <Textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Auftrag / Fokus" />
          </div>
        )}
        <Button className="w-full" onClick={submit} disabled={mode === "assigned" && !assignee}>Zusagen</Button>
      </PopoverContent>
    </Popover>
  );
}
