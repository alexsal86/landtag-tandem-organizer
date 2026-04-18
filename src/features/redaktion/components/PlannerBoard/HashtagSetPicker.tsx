import { useState } from "react";
import { Hash, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";
import { useToast } from "@/hooks/use-toast";
import { useHashtagSets } from "@/features/redaktion/hooks/useHashtagSets";

interface HashtagSetPickerProps {
  currentHashtags: string[];
  onApply: (hashtags: string[]) => void;
}

export function HashtagSetPicker({ currentHashtags, onApply }: HashtagSetPickerProps) {
  const { sets, createSet, deleteSet } = useHashtagSets();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({ title: "Bitte Name angeben", variant: "destructive" });
      return;
    }
    if (newTags.length === 0) {
      toast({ title: "Mindestens ein Hashtag eintragen", variant: "destructive" });
      return;
    }
    try {
      await createSet({ name: newName.trim(), hashtags: newTags });
      setNewName("");
      setNewTags([]);
      setCreating(false);
      toast({ title: "Hashtag-Set gespeichert" });
    } catch {
      toast({ title: "Set konnte nicht gespeichert werden", variant: "destructive" });
    }
  };

  const handleSaveCurrent = async () => {
    const name = window.prompt("Name für dieses Hashtag-Set:");
    if (!name) return;
    try {
      await createSet({ name: name.trim(), hashtags: currentHashtags });
      toast({ title: "Aktuelle Hashtags als Set gespeichert" });
    } catch {
      toast({ title: "Set konnte nicht gespeichert werden", variant: "destructive" });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Hash className="h-3.5 w-3.5 mr-1" />
          Hashtag-Sets
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Sets einsetzen</span>
          {currentHashtags.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={() => void handleSaveCurrent()}>
              Aktuelle speichern
            </Button>
          )}
        </div>

        <div className="space-y-1 max-h-48 overflow-y-auto">
          {sets.length === 0 && (
            <p className="text-xs text-muted-foreground">Noch keine Sets gespeichert.</p>
          )}
          {sets.map((set) => (
            <div key={set.id} className="flex items-center justify-between gap-2 text-xs rounded border p-2">
              <button
                type="button"
                className="flex-1 text-left hover:underline"
                onClick={() => {
                  const merged = Array.from(new Set([...currentHashtags, ...set.hashtags]));
                  onApply(merged);
                  toast({ title: `${set.hashtags.length} Hashtags eingefügt` });
                }}
              >
                <span className="font-medium">{set.name}</span>
                <span className="text-muted-foreground"> · {set.hashtags.length}</span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={async () => {
                  if (window.confirm(`Set „${set.name}" löschen?`)) {
                    await deleteSet(set.id);
                  }
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {creating ? (
          <div className="space-y-2 border-t pt-2">
            <Label className="text-xs">Name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="z. B. Wahlkreis" />
            <Label className="text-xs">Hashtags</Label>
            <TagInput tags={newTags} onTagsChange={setNewTags} placeholder="#hashtag…" />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => void handleCreate()}>Speichern</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>Abbrechen</Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Neues Set anlegen
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
