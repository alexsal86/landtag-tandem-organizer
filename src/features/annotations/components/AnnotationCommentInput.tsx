import { useAnnotationMembers } from "../useAnnotationMembers";
import { useId, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { annotationMentionToken } from "../mentions";

/** Mentions carry an unambiguous member ID; Enter/Tab confirms a suggestion. */
export function AnnotationCommentInput({ tenantId, value, onChange, ...props }: {
  tenantId: string; value: string; onChange: (value: string) => void;
  placeholder?: string; rows?: number; maxLength?: number; autoFocus?: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const [cursor, setCursor] = useState(value.length);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const match = !dismissed && value.slice(0, cursor).match(/(?:^|\s)@([^@\n\[\]]*)$/);
  const users = useAnnotationMembers(tenantId, !!match);
  const suggestions = match ? (users.data ?? []).filter(u => u.display_name?.toLocaleLowerCase('de').includes(match[1].toLocaleLowerCase('de'))).slice(0, 8) : [];
  const selectedIndex = Math.min(active, Math.max(0, suggestions.length - 1));
  const insert = (user: { user_id: string; display_name: string | null }) => {
    if (!match) return;
    const start = cursor - match[1].length - 1;
    const token = `${annotationMentionToken(user.display_name ?? 'Mitarbeiter', user.user_id)} `;
    const next = value.slice(0, start) + token + value.slice(cursor);
    if (next.length > (props.maxLength ?? 5000)) return;
    onChange(next); setCursor(start + token.length); setDismissed(false); setActive(0);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + token.length, start + token.length); });
  };
  return <div>
    <Textarea {...props} ref={input} value={value} aria-autocomplete="list" aria-expanded={!!match} aria-controls={match ? listId : undefined}
      aria-activedescendant={match && suggestions.length ? `${listId}-${selectedIndex}` : undefined}
      onChange={e => { onChange(e.target.value); setCursor(e.target.selectionStart); setActive(0); setDismissed(false); }}
      onSelect={e => { setCursor(e.currentTarget.selectionStart); }}
      onKeyDown={e => {
        if (!match || e.nativeEvent.isComposing) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDismissed(true); return; }
        if (!suggestions.length) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); e.stopPropagation(); setActive((selectedIndex + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length);
        }
        if ((e.key === 'Enter' || e.key === 'Tab') && !e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); insert(suggestions[selectedIndex]); }
      }} />
    {match && <div id={listId} role="listbox" className="max-h-40 overflow-auto rounded-md border bg-popover p-xs" aria-label="Person erwähnen">
      {users.isLoading && <p className="text-caption">Personen werden geladen …</p>}
      {users.isError && <p className="text-caption">Personen konnten nicht geladen werden.</p>}
      {!users.isLoading && !users.isError && !suggestions.length && <p className="text-caption">Keine passende Person gefunden.</p>}
      {suggestions.map((user, index) => <Button type="button" key={user.user_id} id={`${listId}-${index}`} role="option" aria-selected={index === selectedIndex}
        variant={index === selectedIndex ? 'secondary' : 'ghost'} size="sm" className="block w-full text-left" onMouseDown={e => e.preventDefault()} onClick={() => insert(user)}>{user.display_name}</Button>)}
    </div>}
  </div>;
}
