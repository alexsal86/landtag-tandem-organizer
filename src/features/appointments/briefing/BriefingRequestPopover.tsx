import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenantUsers } from "@/hooks/useTenantUsers";
import { notify } from "@/lib/notify";
import { suggestBriefingDue } from "../briefing";
import { useBriefingMutations } from "./useBriefing";

interface Props { appointmentId: string; startTime: string; trigger: ReactNode; initialAssignee?: string | null; initialInstructions?: string | null; initialDue?: string | null; initialDepth?: "compact" | "full" }

/** Small form: who, until when, what focus. Creates the briefing task. */
export function BriefingRequestPopover({ appointmentId, startTime, trigger, initialAssignee, initialInstructions, initialDue, initialDepth }: Props) {
  const { users, loading: usersLoading } = useTenantUsers();
  const { setBriefing } = useBriefingMutations();
  const [open, setOpen] = useState(false);
  const [assignee, setAssignee] = useState(initialAssignee ?? "");
  const [due, setDue] = useState(() => format(initialDue ? new Date(initialDue) : suggestBriefingDue(new Date(startTime)), "yyyy-MM-dd'T'HH:mm"));
  const [instructions, setInstructions] = useState(initialInstructions ?? "");
  const [depth, setDepth] = useState<"compact" | "full">(initialDepth ?? "compact");

  const submit = async () => {
    if (!assignee) { notify.warning("Bitte eine Person wählen."); return; }
    try {
      await setBriefing.mutateAsync({ appointmentId, decision: "assigned", assignee, due: new Date(due).toISOString(), instructions: instructions.trim() || undefined, depth });
      notify.success(`Briefing vergeben an ${users.find(u => u.id === assignee)?.display_name ?? assignee}.`);
      setOpen(false);
    } catch (e) { notify.error(e instanceof Error ? e.message : "Briefing konnte nicht vergeben werden."); }
  };

  return (
    <Popover open={open} onOpenChange={nextOpen => {
      if (nextOpen) {
        setAssignee(initialAssignee ?? "");
        setInstructions(initialInstructions ?? "");
        setDepth(initialDepth ?? "compact");
        setDue(format(initialDue ? new Date(initialDue) : suggestBriefingDue(new Date(startTime)), "yyyy-MM-dd'T'HH:mm"));
      }
      setOpen(nextOpen);
    }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="space-y-1">
          <label className="text-caption text-muted-foreground">Tiefe</label>
          <div className="flex rounded-md border p-0.5 text-caption">
              {(["compact", "full"] as const).map((d) => (
                <button key={d} type="button" onClick={() => setDepth(d)} className={`flex-1 rounded-sm px-2 py-1 ${depth === d ? "bg-muted font-medium" : "text-muted-foreground"}`}>{d === "compact" ? "Kurz" : "Umfassend"}</button>
              ))}
            </div>
        </div>
        <div className="space-y-1">
          <label className="text-caption text-muted-foreground">Wer übernimmt?</label>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger><SelectValue placeholder="Person wählen" /></SelectTrigger>
            <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-caption text-muted-foreground">Frist</label>
          <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-caption text-muted-foreground">Auftrag / Fokus</label>
          <Textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Was soll geklärt werden?" />
        </div>
        <Button className="w-full" onClick={submit} disabled={setBriefing.isPending || usersLoading || !assignee || !due}>{setBriefing.isPending ? "Wird vergeben…" : "Briefing vergeben"}</Button>
      </PopoverContent>
    </Popover>
  );
}
