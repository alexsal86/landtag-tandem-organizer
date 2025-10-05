import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { UnsplashImagePicker, UnsplashAttribution } from "./UnsplashImagePicker";
import { useToast } from "@/hooks/use-toast";

interface DashboardCoverImageProps {
  userId: string;
}

export function DashboardCoverImage({ userId }: DashboardCoverImageProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [attribution, setAttribution] = useState<UnsplashAttribution | null>(null);
  const [position, setPosition] = useState<"center" | "top" | "bottom">("center");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadCoverImage();
  }, [userId]);

  const loadCoverImage = async () => {
    try {
      setIsLoading(true);

      // 1. Try to load user's own cover image
      const { data: profile } = await supabase
        .from("profiles")
        .select("dashboard_cover_image_url, dashboard_cover_image_position, dashboard_cover_image_attribution")
        .eq("user_id", userId)
        .single();

      if (profile?.dashboard_cover_image_url) {
        setCoverUrl(profile.dashboard_cover_image_url);
        const pos = profile.dashboard_cover_image_position as "center" | "top" | "bottom";
        setPosition(pos || "center");
        setAttribution((profile.dashboard_cover_image_attribution as unknown as UnsplashAttribution) || null);
        setIsLoading(false);
        return;
      }

      // 2. Try to load admin default
      const { data: settings } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "default_dashboard_cover_url")
        .single();

      if (settings?.setting_value) {
        setCoverUrl(settings.setting_value);
        
        const { data: posSettings } = await supabase
          .from("app_settings")
          .select("setting_value")
          .eq("setting_key", "default_dashboard_cover_position")
          .single();
        const pos = posSettings?.setting_value as "center" | "top" | "bottom";
        setPosition(pos || "center");
        
        const { data: attrSettings } = await supabase
          .from("app_settings")
          .select("setting_value")
          .eq("setting_key", "default_dashboard_cover_attribution")
          .single();
        setAttribution(attrSettings?.setting_value ? JSON.parse(attrSettings.setting_value) : null);
        
        setIsLoading(false);
        return;
      }

      // 3. Fallback: Random Unsplash image
      const randomUrl = await getRandomUnsplashImage();
      setCoverUrl(randomUrl);
      setPosition("center");
    } catch (error) {
      console.error("Error loading cover image:", error);
      // Fallback to a simple gradient
      setCoverUrl(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getRandomUnsplashImage = async (): Promise<string> => {
    const topics = ["nature", "landscape", "minimal", "abstract", "architecture", "workspace"];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    
    // Use Unsplash Source API (no auth required for random images)
    return `https://source.unsplash.com/1600x400/?${randomTopic}`;
  };

  const handleSaveCover = async (
    imageUrl: string, 
    imagePosition: "center" | "top" | "bottom",
    imageAttribution?: UnsplashAttribution
  ) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          dashboard_cover_image_url: imageUrl,
          dashboard_cover_image_position: imagePosition,
          dashboard_cover_image_attribution: imageAttribution ? (imageAttribution as any) : null,
        })
        .eq("user_id", userId);

      if (error) throw error;

      setCoverUrl(imageUrl);
      setPosition(imagePosition);
      setAttribution(imageAttribution || null);
      setIsPickerOpen(false);

      toast({
        title: "Cover gespeichert",
        description: "Dein Dashboard-Cover wurde erfolgreich aktualisiert.",
      });
    } catch (error) {
      console.error("Error saving cover:", error);
      toast({
        title: "Fehler",
        description: "Das Cover konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const objectPositionMap = {
    center: "center",
    top: "top",
    bottom: "bottom",
  };

  if (isLoading) {
    return (
      <div className="w-full h-[20vh] bg-muted animate-pulse" />
    );
  }

  return (
    <>
      <div className="relative w-full h-[20vh] overflow-hidden group">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt="Dashboard Cover"
            className="w-full h-full object-cover"
            style={{ objectPosition: objectPositionMap[position] }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-background" />
        )}

        {/* Attribution Overlay */}
        {attribution && (
          <div className="absolute bottom-0 right-0 text-xs text-white/80 bg-black/40 px-2 py-1 backdrop-blur-sm">
            Photo by{" "}
            <a
              href={attribution.photographer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              {attribution.photographer}
            </a>
            {" "}on{" "}
            <a
              href={attribution.unsplash_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              Unsplash
            </a>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-start justify-end p-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsPickerOpen(true)}
            className="gap-2"
          >
            <Camera className="h-4 w-4" />
            Cover ändern
          </Button>
        </div>
      </div>

      <UnsplashImagePicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSave={handleSaveCover}
        currentUrl={coverUrl || undefined}
        currentPosition={position}
      />
    </>
  );
}
