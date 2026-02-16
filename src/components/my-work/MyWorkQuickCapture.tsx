import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pin, Palette, Save, ListTodo, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";

const COLORS = [
  { name: "Standard", value: "#3b82f6" },
  { name: "Gelb", value: "#f59e0b" },
  { name: "Grün", value: "#10b981" },
  { name: "Blau", value: "#06b6d4" },
  { name: "Rosa", value: "#f472b6" },
  { name: "Lila", value: "#8b5cf6" },
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
  const [selectedColor, setSelectedColor] = useState("#3b82f6");
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAsTask, setSavingAsTask] = useState(false);

  const handleSaveNote = async () => {
    if (!content.trim() || !user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from("quick_notes").insert({
        user_id: user.id,
        title: title.trim() || null,
        content: content.trim(),
        color: selectedColor,
        is_pinned: isPinned,
        category: "general",
      });

      if (error) throw error;

      toast({ title: "Notiz gespeichert" });
      setContent("");
      setTitle("");
      setSelectedColor("#3b82f6");
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
      setSelectedColor("#3b82f6");
      setIsPinned(false);
      onNoteSaved?.();
    } catch (error) {
      console.error("Error saving as task:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    } finally {
      setSavingAsTask(false);
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!saving && content.trim()) {
        void handleSaveNote();
      }
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!saving && content.trim()) {
        void handleSaveNote();
      }
    }
  };

  return (
    <Card className="transition-colors border-l-4" style={{ borderLeftColor: selectedColor }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-1.5">
            Quick Notes
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enter speichert, Shift + Enter erzeugt eine neue Zeile.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
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
                        selectedColor === color.value
                          ? "border-foreground"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: color.value }}
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
          onKeyDown={handleTitleKeyDown}
          className="bg-background/50"
        />
        <div className="min-h-[120px]">
          <SimpleRichTextEditor
            initialContent={content}
            onChange={setContent}
            onKeyDown={handleEditorKeyDown}
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
