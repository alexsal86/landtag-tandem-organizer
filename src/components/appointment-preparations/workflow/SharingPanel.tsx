import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import type { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { notify } from "@/lib/notify";

interface Member {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Props {
  preparation: AppointmentPreparation;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
}

export function SharingPanel({ preparation, onUpdate }: Props) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const sharedWith = preparation.shared_with ?? [];

  useEffect(() => {
    if (!currentTenant) return;
    (async () => {
      const { data: memberships } = await supabase
        .from("user_tenant_memberships")
        .select("user_id")
        .eq("tenant_id", currentTenant.id)
        .eq("is_active", true);
      const ids = (memberships ?? []).map((m) => m.user_id).filter((id) => id !== user?.id);
      if (ids.length === 0) { setMembers([]); return; }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", ids);
      setMembers((profiles as Member[]) ?? []);
    })();
  }, [currentTenant, user?.id]);

  const sharedMembers = useMemo(
    () => members.filter((m) => sharedWith.includes(m.user_id)),
    [members, sharedWith],
  );

  const toggle = async (uid: string) => {
    const next = sharedWith.includes(uid)
      ? sharedWith.filter((id) => id !== uid)
      : [...sharedWith, uid];
    try {
      await onUpdate({ shared_with: next });
    } catch {
      notify.error("Fehler beim Teilen");
    }
  };

  return (
    <Card className="bg-card shadow-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-primary" />
          Geteilt mit Team ({sharedMembers.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sharedMembers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sharedMembers.map((m) => (
              <button
                key={m.user_id}
                type="button"
                onClick={() => void toggle(m.user_id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-xs hover:bg-muted/70"
                aria-label={`${m.display_name ?? "Nutzer"} entfernen`}
              >
                <Avatar className="h-4 w-4">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[8px]">
                    {(m.display_name ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{m.display_name ?? "Nutzer"}</span>
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Personen hinzufügen
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Suchen…" />
              <CommandList>
                <CommandEmpty>Keine Treffer</CommandEmpty>
                <CommandGroup>
                  {members.map((m) => {
                    const selected = sharedWith.includes(m.user_id);
                    return (
                      <CommandItem
                        key={m.user_id}
                        value={m.display_name ?? m.user_id}
                        onSelect={() => void toggle(m.user_id)}
                      >
                        <Avatar className="h-5 w-5 mr-2">
                          <AvatarImage src={m.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[9px]">
                            {(m.display_name ?? "?").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1">{m.display_name ?? m.user_id}</span>
                        {selected && <Check className="h-4 w-4 text-primary" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
}
