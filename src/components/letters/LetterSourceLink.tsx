import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

interface LetterPreview {
  id: string;
  title: string;
  recipient_name: string | null;
  content: string;
  updated_at: string;
}

interface LetterSourceLinkProps {
  letterId: string;
  className?: string;
}

export function LetterSourceLink({ letterId, className }: LetterSourceLinkProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<LetterPreview | null>(null);

  const loadPreview = async () => {
    if (preview || loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("letters")
        .select("id, title, recipient_name, content, updated_at")
        .eq("id", letterId)
        .single();

      if (error) throw error;
      setPreview(data as LetterPreview);
    } catch (error) {
      console.error("Error loading letter preview:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLetter = () => {
    navigate(`/?section=documents&tab=letters&letter=${letterId}`);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={className || "h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"}
            onMouseEnter={loadPreview}
            onFocus={loadPreview}
            onClick={handleOpenLetter}
          >
            <Mail className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              Vorschau wird geladen...
            </div>
          ) : preview ? (
            <div className="space-y-1 text-xs">
              <div className="font-medium">{preview.title || "Brief"}</div>
              {preview.recipient_name && <div>An: {preview.recipient_name}</div>}
              <div className="text-muted-foreground line-clamp-4">
                {preview.content || "Kein Inhalt verfügbar"}
              </div>
            </div>
          ) : (
            <div className="text-xs">Zum Brief öffnen</div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

