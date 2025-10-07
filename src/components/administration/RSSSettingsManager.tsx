import { useState, useEffect } from "react";
import { AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

const rssSettingsSchema = z.object({
  articles_per_feed: z.number().min(5).max(50),
  total_articles_limit: z.number().min(10).max(100),
  refresh_interval_minutes: z.number(),
  timeout_seconds: z.number().min(5).max(30),
});

type RSSSettingsFormData = z.infer<typeof rssSettingsSchema>;

export function RSSSettingsManager() {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<RSSSettingsFormData>({
    resolver: zodResolver(rssSettingsSchema),
    defaultValues: {
      articles_per_feed: 10,
      total_articles_limit: 20,
      refresh_interval_minutes: 30,
      timeout_seconds: 10,
    },
  });

  const loadSettings = async () => {
    if (!currentTenant?.id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("rss_settings")
      .select("*")
      .eq("tenant_id", currentTenant.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      toast.error("Fehler beim Laden der Einstellungen");
      console.error(error);
    } else if (data) {
      form.reset({
        articles_per_feed: data.articles_per_feed,
        total_articles_limit: data.total_articles_limit,
        refresh_interval_minutes: data.refresh_interval_minutes,
        timeout_seconds: data.timeout_seconds,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, [currentTenant?.id]);

  const onSubmit = async (data: RSSSettingsFormData) => {
    if (!currentTenant?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("rss_settings")
        .upsert({
          tenant_id: currentTenant.id,
          articles_per_feed: data.articles_per_feed,
          total_articles_limit: data.total_articles_limit,
          refresh_interval_minutes: data.refresh_interval_minutes,
          timeout_seconds: data.timeout_seconds,
        }, {
          onConflict: 'tenant_id'
        });

      if (error) throw error;
      toast.success("Einstellungen gespeichert");
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Speichern");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (!currentTenant) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Kein Mandant ausgewählt. Bitte wählen Sie einen Mandanten aus.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Lädt...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>RSS-Einstellungen</CardTitle>
        <CardDescription>
          Konfigurieren Sie, wie RSS-Feeds geladen und angezeigt werden
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="articles_per_feed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Artikel pro Feed: {field.value}</FormLabel>
                  <FormControl>
                    <Slider
                      min={5}
                      max={50}
                      step={5}
                      value={[field.value]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                    />
                  </FormControl>
                  <FormDescription>
                    Wie viele Artikel sollen maximal von jeder RSS-Quelle geladen werden?
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="total_articles_limit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gesamt-Artikel-Limit: {field.value}</FormLabel>
                  <FormControl>
                    <Slider
                      min={10}
                      max={100}
                      step={10}
                      value={[field.value]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                    />
                  </FormControl>
                  <FormDescription>
                    Wie viele Artikel sollen insgesamt im News-Widget angezeigt werden?
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="refresh_interval_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aktualisierungs-Intervall</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(val) => field.onChange(Number(val))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="15">15 Minuten</SelectItem>
                      <SelectItem value="30">30 Minuten</SelectItem>
                      <SelectItem value="60">60 Minuten</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Wie oft sollen die RSS-Feeds automatisch aktualisiert werden?
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timeout_seconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timeout: {field.value} Sekunden</FormLabel>
                  <FormControl>
                    <Slider
                      min={5}
                      max={30}
                      step={5}
                      value={[field.value]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                    />
                  </FormControl>
                  <FormDescription>
                    Nach wie vielen Sekunden soll ein RSS-Feed-Request abgebrochen werden?
                  </FormDescription>
                </FormItem>
              )}
            />

            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Speichert..." : "Einstellungen speichern"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
