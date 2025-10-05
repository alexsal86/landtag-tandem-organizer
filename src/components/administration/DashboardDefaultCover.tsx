import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { UnsplashImagePicker } from "@/components/dashboard/UnsplashImagePicker";

export const DashboardDefaultCover = () => {
  const [defaultCoverUrl, setDefaultCoverUrl] = useState<string | null>(null);
  const [defaultCoverPosition, setDefaultCoverPosition] = useState<"top" | "bottom" | "center">("center");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDefaultCover();
  }, []);

  const loadDefaultCover = async () => {
    setIsLoading(true);
    try {
      const { data: urlData } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "default_dashboard_cover_url")
        .maybeSingle();

      const { data: positionData } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "default_dashboard_cover_position")
        .maybeSingle();

      setDefaultCoverUrl(urlData?.setting_value || null);
      setDefaultCoverPosition((positionData?.setting_value as "top" | "bottom" | "center") || "center");
    } catch (error) {
      console.error("Error loading default cover:", error);
      toast({
        title: "Fehler",
        description: "Standard-Cover konnte nicht geladen werden",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveDefaultCover = async (url: string, position: string) => {
    try {
      const { error: urlError } = await supabase
        .from("app_settings")
        .upsert(
          { setting_key: "default_dashboard_cover_url", setting_value: url },
          { onConflict: "setting_key" }
        );

      const { error: positionError } = await supabase
        .from("app_settings")
        .upsert(
          { setting_key: "default_dashboard_cover_position", setting_value: position },
          { onConflict: "setting_key" }
        );

      if (urlError || positionError) {
        throw urlError || positionError;
      }

      setDefaultCoverUrl(url);
      setDefaultCoverPosition(position as "top" | "bottom" | "center");
      setIsPickerOpen(false);

      toast({
        title: "Gespeichert",
        description: "Standard-Cover wurde erfolgreich gesetzt",
      });
    } catch (error) {
      console.error("Error saving default cover:", error);
      toast({
        title: "Fehler",
        description: "Standard-Cover konnte nicht gespeichert werden",
        variant: "destructive",
      });
    }
  };

  const removeDefaultCover = async () => {
    try {
      const { error } = await supabase
        .from("app_settings")
        .update({ setting_value: null })
        .eq("setting_key", "default_dashboard_cover_url");

      if (error) throw error;

      setDefaultCoverUrl(null);

      toast({
        title: "Entfernt",
        description: "Standard-Cover wurde entfernt",
      });
    } catch (error) {
      console.error("Error removing default cover:", error);
      toast({
        title: "Fehler",
        description: "Standard-Cover konnte nicht entfernt werden",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Standard Dashboard Cover</CardTitle>
          <CardDescription>Lädt...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Standard Dashboard Cover</CardTitle>
          <CardDescription>
            Dieses Bild wird als Standard-Cover für alle Nutzer verwendet, die noch kein eigenes gewählt haben.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {defaultCoverUrl && (
            <div className="relative w-full h-[150px] rounded-lg overflow-hidden border">
              <img
                src={defaultCoverUrl}
                alt="Standard Dashboard Cover"
                className="w-full h-full object-cover"
                style={{
                  objectPosition: defaultCoverPosition,
                }}
              />
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={() => setIsPickerOpen(true)} className="flex-1">
              <ImageIcon className="h-4 w-4 mr-2" />
              Standard-Cover {defaultCoverUrl ? "ändern" : "festlegen"}
            </Button>

            {defaultCoverUrl && (
              <Button variant="outline" onClick={removeDefaultCover}>
                <X className="h-4 w-4 mr-2" />
                Entfernen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <UnsplashImagePicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSave={saveDefaultCover}
        currentUrl={defaultCoverUrl || undefined}
        currentPosition={defaultCoverPosition}
      />
    </>
  );
};
