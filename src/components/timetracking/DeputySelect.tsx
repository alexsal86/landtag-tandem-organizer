import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Users } from "lucide-react";

interface DeputySelectProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  label?: string;
}

interface Colleague {
  user_id: string;
  display_name: string | null;
}

export function DeputySelect({ value, onChange, required = true, label = "Stellvertretung" }: DeputySelectProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !currentTenant?.id) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data: members } = await supabase
          .from("user_tenant_memberships")
          .select("user_id")
          .eq("tenant_id", currentTenant.id)
          .eq("is_active", true)
          .neq("user_id", user.id);

        if (!members || members.length === 0) {
          setColleagues([]);
          return;
        }

        const userIds = members.map(m: Record<string, any> => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);

        setColleagues(
          (profiles || [])
            .map(p: Record<string, any> => ({ user_id: p.user_id, display_name: p.display_name }))
            .sort((a: Record<string, any>, b: Record<string, any>) => (a.display_name || "").localeCompare(b.display_name || ""))
        );
      } catch {
        setColleagues([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id, currentTenant?.id]);

  return (
    <div>
      <Label className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5" />
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={loading}>
        <SelectTrigger className="mt-1">
          <SelectValue placeholder={loading ? "Lade Kollegen…" : "Stellvertretung auswählen"} />
        </SelectTrigger>
        <SelectContent>
          {colleagues.map(c => (
            <SelectItem key={c.user_id} value={c.user_id}>
              {c.display_name || "Unbekannt"}
            </SelectItem>
          ))}
          {colleagues.length === 0 && !loading && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Keine Kollegen verfügbar</div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
