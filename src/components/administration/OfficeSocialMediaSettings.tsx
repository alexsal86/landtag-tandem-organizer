import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Globe } from "lucide-react";
import { Facebook, Instagram, Linkedin, Twitter, YouTube, TikTok, Threads, Mastodon } from "@/components/icons/SocialIcons";
import { debugConsole } from "@/utils/debugConsole";
import type { ReactNode } from "react";

const OFFICE_SOCIAL_MEDIA_KEY = "office_social_media_channels";

type SocialChannelKey =
  | "facebook"
  | "x"
  | "instagram"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "threads"
  | "mastodon";

type SocialChannelValues = Record<SocialChannelKey, string>;

const EMPTY_CHANNELS: SocialChannelValues = {
  facebook: "",
  x: "",
  instagram: "",
  linkedin: "",
  youtube: "",
  tiktok: "",
  threads: "",
  mastodon: "",
};

const CHANNEL_FIELDS: Array<{ key: SocialChannelKey; label: string; placeholder: string; icon: ReactNode }> = [
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/...", icon: <Facebook size={18} className="text-[#1877F2]" /> },
  { key: "x", label: "X", placeholder: "https://x.com/...", icon: <Twitter size={18} className="text-foreground" /> },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/...", icon: <Instagram size={18} className="text-[#E4405F]" /> },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/...", icon: <Linkedin size={18} className="text-[#0A66C2]" /> },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@...", icon: <YouTube size={18} className="text-[#FF0000]" /> },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@...", icon: <TikTok size={18} className="text-foreground" /> },
  { key: "threads", label: "Threads", placeholder: "https://threads.net/@...", icon: <Threads size={18} className="text-foreground" /> },
  { key: "mastodon", label: "Mastodon", placeholder: "https://mastodon.social/@...", icon: <Mastodon size={18} className="text-[#6364FF]" /> },
];

const parseChannels = (rawValue: string | null): SocialChannelValues => {
  if (!rawValue) return EMPTY_CHANNELS;

  try {
    const parsed = JSON.parse(rawValue) as Partial<SocialChannelValues> | null;
    if (!parsed || typeof parsed !== "object") return EMPTY_CHANNELS;

    return {
      facebook: typeof parsed.facebook === "string" ? parsed.facebook : "",
      x: typeof parsed.x === "string" ? parsed.x : "",
      instagram: typeof parsed.instagram === "string" ? parsed.instagram : "",
      linkedin: typeof parsed.linkedin === "string" ? parsed.linkedin : "",
      youtube: typeof parsed.youtube === "string" ? parsed.youtube : "",
      tiktok: typeof parsed.tiktok === "string" ? parsed.tiktok : "",
      threads: typeof parsed.threads === "string" ? parsed.threads : "",
      mastodon: typeof parsed.mastodon === "string" ? parsed.mastodon : "",
    };
  } catch (error) {
    debugConsole.warn("Could not parse office social media settings:", error);
    return EMPTY_CHANNELS;
  }
};

export function OfficeSocialMediaSettings() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<SocialChannelValues>(EMPTY_CHANNELS);

  const hasChanges = useMemo(
    () => Object.values(channels).some((value) => value.trim().length > 0),
    [channels],
  );

  const loadSettings = useCallback(async () => {
    if (!currentTenant?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("tenant_id", currentTenant.id)
        .eq("setting_key", OFFICE_SOCIAL_MEDIA_KEY)
        .maybeSingle();

      if (error) throw error;
      setChannels(parseChannels(data?.setting_value ?? null));
    } catch (error) {
      debugConsole.error("Error loading office social media settings:", error);
      toast({
        title: "Fehler",
        description: "Social-Media-Kanäle konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id, toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async () => {
    if (!currentTenant?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          [{
            tenant_id: currentTenant.id,
            setting_key: OFFICE_SOCIAL_MEDIA_KEY,
            setting_value: JSON.stringify(channels),
          }],
          { onConflict: "tenant_id,setting_key" },
        );

      if (error) throw error;
      toast({ title: "Gespeichert", description: "Social-Media-Kanäle wurden aktualisiert." });
    } catch (error) {
      debugConsole.error("Error saving office social media settings:", error);
      toast({
        title: "Fehler",
        description: "Social-Media-Kanäle konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Lade Social-Media-Kanäle…</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Social-Media-Kanäle des Büros
        </CardTitle>
        <CardDescription>
          Hinterlegen Sie die offiziellen Kanäle für Facebook, X, Instagram, LinkedIn, YouTube, TikTok, Threads und Mastodon.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {CHANNEL_FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={`office-social-${field.key}`} className="flex items-center gap-2">
                {field.icon}
                {field.label}
              </Label>
              <Input
                id={`office-social-${field.key}`}
                value={channels[field.key]}
                onChange={(event) =>
                  setChannels((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
                placeholder={field.placeholder}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => setChannels(EMPTY_CHANNELS)} disabled={saving || !hasChanges}>
            Leeren
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
