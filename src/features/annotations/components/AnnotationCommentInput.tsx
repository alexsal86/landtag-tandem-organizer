import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

/** Mentions are stored as @[display name](user UUID), never ambiguous plain names. */
export function AnnotationCommentInput({ tenantId, value, onChange, ...props }: {
  tenantId: string; value: string; onChange: (value: string) => void;
  placeholder?: string; rows?: number; maxLength?: number; autoFocus?: boolean;
}) {
  const [cursor, setCursor] = useState(value.length);
  const match = value.slice(0, cursor).match(/(?:^|\s)@([^@\n\[\]]*)$/);
  const users = useQuery({
    queryKey: ["annotation-mention-users", tenantId], enabled: !!match,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, display_name").eq("tenant_id", tenantId);
      if (error) throw error;
      return data ?? [];
    },
  });
  return <div>
    <Textarea {...props} value={value} onChange={e => { onChange(e.target.value); setCursor(e.target.selectionStart); }} onSelect={e => setCursor(e.currentTarget.selectionStart)} />
    {match && <div className="max-h-40 overflow-auto rounded-md border bg-popover p-xs" aria-label="Person erwähnen">
      {users.isError && <p className="text-caption">Personen konnten nicht geladen werden.</p>}
      {(users.data ?? []).filter(u => u.display_name?.toLowerCase().includes(match[1].toLowerCase())).slice(0, 8).map(u => <Button type="button" key={u.user_id} variant="ghost" size="sm" className="block w-full text-left" onClick={() => {
        const start = cursor - match[1].length - 1;
        const token = `@[${u.display_name?.replace(/[\[\]]/g, "")}](${u.user_id}) `;
        const next = value.slice(0, start) + token + value.slice(cursor);
        if (next.length <= (props.maxLength ?? 5000)) { onChange(next); setCursor(start + token.length); }
      }}>{u.display_name}</Button>)}
    </div>}
  </div>;
}
