import { memo, useCallback, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getColorClasses, type PlannerNote } from "@/features/redaktion/hooks/usePlannerNotes";

interface Props {
  note: PlannerNote;
  onUpdate: (id: string, patch: Partial<Pick<PlannerNote, "content" | "color">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const PlannerNoteCard = memo(function PlannerNoteCard({ note, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const colors = getColorClasses(note.color);

  const save = useCallback(async () => {
    setEditing(false);
    if (content.trim() !== note.content) {
      await onUpdate(note.id, { content: content.trim() });
    }
  }, [content, note.content, note.id, onUpdate]);

  return (
    <div className={`group relative rounded p-1.5 text-[11px] leading-snug border ${colors.bg} ${colors.border}`}>
      {editing ? (
        <textarea
          ref={inputRef}
          className="w-full resize-none bg-transparent outline-none text-[11px] leading-snug min-h-[32px]"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void save(); } }}
          autoFocus
        />
      ) : (
        <p
          className="cursor-pointer whitespace-pre-wrap break-words min-h-[16px]"
          onClick={() => setEditing(true)}
        >
          {note.content || "Klicken zum Bearbeiten…"}
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute -right-1 -top-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 rounded-full shadow-sm"
        onClick={(e) => { e.stopPropagation(); void onDelete(note.id); }}
      >
        <Trash2 className="h-3 w-3 text-destructive" />
      </Button>
    </div>
  );
});
