import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Lock, Trash2, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
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
          className="w-full resize-none bg-transparent outline-none text-sm leading-snug min-h-[80px] max-h-[32vh] overflow-y-auto"
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
        <p className="whitespace-pre-wrap break-words text-sm leading-snug min-h-[80px]">
          {note.content || "Klicken zum Bearbeiten…"}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        {editing && isOwner ? (
          <>
            <div className="flex items-center gap-2">
              <Popover open={colorMenuOpen} onOpenChange={setColorMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-2 rounded-full px-1.5 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Notizfarbe ändern"
                  >
                    <span className={cn("h-5 w-5 rounded-full border-2", NOTE_COLORS.find((c) => c.value === note.color)?.solid || "bg-yellow-200")} />
                    <ChevronDown className={cn("h-3.5 w-3.5", colors.icon)} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto rounded-3xl p-3"
                  align="start"
                  sideOffset={8}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="grid grid-cols-3 gap-3">
                    {NOTE_COLORS.map((colorOption) => (
                      <button
                        key={colorOption.value}
                        type="button"
                        className={cn(
                          "h-9 w-9 rounded-full border-2 transition",
                          colorOption.solid,
                          note.color === colorOption.value ? "ring-2 ring-offset-1 ring-primary" : "opacity-80 hover:opacity-100",
                        )}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          void onUpdate(note.id, { color: colorOption.value });
                          setColorMenuOpen(false);
                        }}
                        aria-label={`Farbe ${colorOption.label}`}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void onUpdate(note.id, { visible_to_all: !note.visible_to_all });
                }}
                onMouseDown={(e) => e.preventDefault()}
                aria-label={note.visible_to_all ? "Notiz privat schalten" : "Notiz öffentlich schalten"}
              >
                {note.visible_to_all ? <Users className={cn("h-4 w-4", colors.icon)} /> : <Lock className={cn("h-4 w-4", colors.icon)} />}
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!window.confirm("Möchtest du diese Notiz wirklich löschen?")) return;
                  void onDelete(note.id);
                }}
                aria-label="Notiz löschen"
              >
                <Trash2 className={cn("h-4 w-4", colors.icon)} />
              </button>
            </div>
          </>
        ) : (
          <>
            {note.visible_to_all ? (
              <Avatar className="h-7 w-7">
                <AvatarImage src={note.created_by_avatar_url || undefined} alt={note.created_by_name || "Ersteller"} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            ) : (
              <Lock className={cn("h-4 w-4", colors.icon)} />
            )}
            <span />
          </>
        )}
      </div>
    </div>
  );
});
