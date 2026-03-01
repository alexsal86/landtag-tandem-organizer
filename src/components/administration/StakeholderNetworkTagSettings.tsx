import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const SETTINGS_KEY = "stakeholder_network_tag_synonyms";

const DEFAULT_SYNONYMS: Record<string, string> = {
  verkehrspolitik: "verkehr",
  "verkehrs-politik": "verkehr",
  mobilitaet: "verkehr",
  wirtschaftspolitik: "wirtschaft",
  "wirtschafts-politik": "wirtschaft",
  "bildungs-politik": "bildung",
  schule: "bildung",
  schulen: "bildung",
};

export function StakeholderNetworkTagSettings() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingId, setSettingId] = useState<string | null>(null);
  const [jsonValue, setJsonValue] = useState(JSON.stringify(DEFAULT_SYNONYMS, null, 2));

  useEffect(() => {
    if (!currentTenant?.id) return;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_settings")
        .select("id, setting_value")
        .eq("tenant_id", currentTenant.id)
        .eq("setting_key", SETTINGS_KEY)
        .maybeSingle();

      if (error) {
        toast({
          title: "Fehler",
          description: "Tag-Synonyme konnten nicht geladen werden.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      setSettingId(data?.id || null);
      if (data?.setting_value) {
        setJsonValue(data.setting_value);
      }
      setLoading(false);
    };

    load();
  }, [currentTenant?.id, toast]);

  const validationError = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonValue);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return "JSON muss ein Objekt mit Schlüssel/Wert-Paaren sein.";
      }

      for (const [key, value] of Object.entries(parsed)) {
        if (!key.trim() || typeof value !== "string" || !value.trim()) {
          return "Alle Synonyme müssen String-Schlüssel mit String-Zielwerten sein.";
        }
      }

      return null;
    } catch {
      return "Ungültiges JSON-Format.";
    }
  }, [jsonValue]);

  const handleSave = async () => {
    if (!currentTenant?.id || validationError) return;

    setSaving(true);
    try {
      const payload = {
        tenant_id: currentTenant.id,
        setting_key: SETTINGS_KEY,
        setting_value: jsonValue,
      };

      const { error } = settingId
        ? await supabase.from("app_settings").update({ setting_value: jsonValue }).eq("id", settingId)
        : await supabase.from("app_settings").insert(payload);

      if (error) throw error;

      toast({ title: "Gespeichert", description: "Tag-Synonyme wurden aktualisiert." });
    } catch (error) {
      console.error("Error saving stakeholder network tag synonyms:", error);
      toast({
        title: "Fehler",
        description: "Tag-Synonyme konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stakeholder-Netzwerk: Tag-Synonyme</CardTitle>
        <CardDescription>
          Pflege Synonyme für die Netzwerk-Clustering-Logik. Beispiel: "mobilität" → "verkehr".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="synonyms-json">Synonyme (JSON)</Label>
          <Textarea
            id="synonyms-json"
            className="min-h-[320px] font-mono text-xs"
            value={jsonValue}
            disabled={loading}
            onChange={(event) => setJsonValue(event.target.value)}
          />
          {validationError ? (
            <p className="text-sm text-destructive">{validationError}</p>
          ) : (
            <p className="text-sm text-muted-foreground">JSON ist valide und speicherbar.</p>
          )}
        </div>

        <Button onClick={handleSave} disabled={loading || saving || !!validationError}>
          {saving ? "Speichere…" : "Synonyme speichern"}
        </Button>
      </CardContent>
    </Card>
  );
}
