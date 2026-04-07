import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Lock, Trash2, UserRoundPlus, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { getColorClasses, NOTE_COLORS, type PlannerNote } from "@/features/redaktion/hooks/usePlannerNotes";

interface Props {
  note: PlannerNote;
  onUpdate: (id: string, patch: Partial<Pick<PlannerNote, "content" | "color" | "visible_to_all">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const PlannerNoteCard = memo(function PlannerNoteCard({ note, onUpdate, onDelete }: Props) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const colors = getColorClasses(note.color);
  const isOwner = user?.id === note.created_by;
  const initials = (note.created_by_name || "U").slice(0, 2).toUpperCase();

  useEffect(() => {
    setContent(note.content);
  }, [note.content]);

  const save = useCallback(async () => {
    if (!isOwner) return;
    if (content.trim() !== note.content) {
      await onUpdate(note.id, { content: content.trim() });
    }
  }, [content, isOwner, note.content, note.id, onUpdate]);

  return (
    <div
      className={cn(
        "group relative rounded-2xl border p-3 transition-colors",
        colors.border,
        editing ? colors.bgActive : colors.bg,
      )}
      onClick={() => {
        if (isOwner) {
          setEditing(true);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }
      }}
    >
      {editing && isOwner ? (
        <textarea
          ref={inputRef}
          className="w-full resize-none bg-transparent outline-none text-[20px] leading-tight min-h-[128px]"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => {
            void save();
            setEditing(false);
          }}
          onKeyDown={(e) => { if (e.key === "Escape") { setEditing(false); } }}
          autoFocus
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-[20px] leading-tight min-h-[128px]">
          {note.content || "Klicken zum Bearbeiten…"}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        {editing && isOwner ? (
          <>
            <div className="flex items-center gap-2">
              {NOTE_COLORS.map((colorOption) => (
                <button
                  key={colorOption.value}
                  type="button"
                  className={cn(
                    "h-6 w-6 rounded-full border-2",
                    colorOption.solid,
                    note.color === colorOption.value ? "ring-2 ring-offset-1 ring-primary" : "opacity-70",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onUpdate(note.id, { color: colorOption.value });
                  }}
                />
              ))}
              <ChevronDown className={cn("h-4 w-4", colors.icon)} />
            </div>
            <div className="flex items-center gap-2">
              <UserRoundPlus className={cn("h-5 w-5", colors.icon)} />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void onUpdate(note.id, { visible_to_all: !note.visible_to_all });
                }}
              >
                {note.visible_to_all ? <Users className={cn("h-5 w-5", colors.icon)} /> : <Lock className={cn("h-5 w-5", colors.icon)} />}
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); void onDelete(note.id); }}>
                <Trash2 className={cn("h-5 w-5", colors.icon)} />
              </button>
            </div>
          </>
        ) : (
          <>
            {note.visible_to_all ? (
              <Avatar className="h-8 w-8">
                <AvatarImage src={note.created_by_avatar_url || undefined} alt={note.created_by_name || "Ersteller"} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            ) : (
              <Lock className={cn("h-5 w-5", colors.icon)} />
            )}
            <span />
          </>
        )}
      </div>
    </div>
  );
});
