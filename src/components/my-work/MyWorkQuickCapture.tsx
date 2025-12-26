import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pin, Palette, Save, ListTodo, Vote, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";

const COLORS = [
  { name: "Standard", value: "bg-card" },
  { name: "Gelb", value: "bg-yellow-100 dark:bg-yellow-900/30" },
  { name: "Grün", value: "bg-green-100 dark:bg-green-900/30" },
  { name: "Blau", value: "bg-blue-100 dark:bg-blue-900/30" },
  { name: "Rosa", value: "bg-pink-100 dark:bg-pink-900/30" },
  { name: "Lila", value: "bg-purple-100 dark:bg-purple-900/30" },
];

interface MyWorkQuickCaptureProps {
  onNoteSaved?: () => void;
}

export function MyWorkQuickCapture({ onNoteSaved }: MyWorkQuickCaptureProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [selectedColor, setSelectedColor] = useState("bg-card");
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAsTask, setSavingAsTask] = useState(false);

  const handleSaveNote = async () => {
    if (!content.trim() || !user || !currentTenant) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from("quick_notes").insert({
        user_id: user.id,
        tenant_id: currentTenant.id,
        title: title.trim() || null,
        content: content.trim(),
        color: selectedColor,
        is_pinned: isPinned,
      });

      if (error) throw error;

      toast({ title: "Notiz gespeichert" });
      setContent("");
      setTitle("");
      setSelectedColor("bg-card");
      setIsPinned(false);
      onNoteSaved?.();
    } catch (error) {
      console.error("Error saving note:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsTask = async () => {
    if (!content.trim() || !user || !currentTenant) return;
    
    setSavingAsTask(true);
    try {
      // Strip HTML tags for title
      const plainText = content.replace(/<[^>]*>/g, '').trim();
      const taskTitle = title.trim() || plainText.substring(0, 100);
      
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        tenant_id: currentTenant.id,
        title: taskTitle,
        description: content,
        status: "todo",
        priority: "medium",
        category: "personal",
      });

      if (error) throw error;

      toast({ title: "Als Aufgabe gespeichert" });
      setContent("");
      setTitle("");
      setSelectedColor("bg-card");
      setIsPinned(false);
      onNoteSaved?.();
    } catch (error) {
      console.error("Error saving as task:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    } finally {
      setSavingAsTask(false);
    }
  };

  return (
    <Card className={cn("transition-colors", selectedColor)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Quick Capture</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isPinned && "text-primary")}
              onClick={() => setIsPinned(!isPinned)}
            >
              <Pin className={cn("h-4 w-4", isPinned && "fill-current")} />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Palette className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="end">
                <div className="flex gap-1">
                  {COLORS.map((color) => (
                    <button
                      key={color.value}
                      className={cn(
                        "h-6 w-6 rounded-full border-2",
                        color.value,
                        selectedColor === color.value
                          ? "border-primary"
                          : "border-transparent"
                      )}
                      onClick={() => setSelectedColor(color.value)}
                      title={color.name}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Titel (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-background/50"
        />
        <div className="min-h-[120px]">
          <SimpleRichTextEditor
            initialContent={content}
            onChange={setContent}
            placeholder="Notiz, Idee oder Gedanke..."
            minHeight="100px"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleSaveNote}
            disabled={!content.trim() || saving}
            size="sm"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Speichern
          </Button>
          <Button
            variant="outline"
            onClick={handleSaveAsTask}
            disabled={!content.trim() || savingAsTask}
            size="sm"
          >
            {savingAsTask ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ListTodo className="mr-2 h-4 w-4" />
            )}
            Als Aufgabe
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
