import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Eye } from "lucide-react";
import { useCelebrationSettings } from "@/hooks/useCelebrationSettings";
import { CelebrationAnimationSystem } from "@/components/celebrations";

const ANIMATION_OPTIONS = [
  { key: 'unicorn', emoji: '🦄', label: 'Einhorn' },
  { key: 'confetti', emoji: '🎊', label: 'Konfetti' },
  { key: 'fireworks', emoji: '🎆', label: 'Feuerwerk' },
  { key: 'stars', emoji: '⭐', label: 'Sterne' },
  { key: 'thumbsup', emoji: '👍', label: 'Daumen hoch' },
];

export function CelebrationSettingsCard() {
  const { settings, loading, updateSettings } = useCelebrationSettings();
  const [showPreview, setShowPreview] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Erfolgs-Animationen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Laden...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Erfolgs-Animationen
          </CardTitle>
          <CardDescription>
            Konfigurieren Sie die Animationen, die bei erledigten Aufgaben angezeigt werden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Aktivierung */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Animationen aktiviert</Label>
              <p className="text-sm text-muted-foreground">
                Zeigt Animationen bei erfolgreichen Aktionen
              </p>
            </div>
            <Switch 
              checked={settings.enabled}
              onCheckedChange={(checked) => updateSettings({ enabled: checked })}
            />
          </div>
          
          <Separator />
          
          {/* Modus */}
          <div className="space-y-2">
            <Label>Animations-Modus</Label>
            <Select 
              value={settings.mode}
              onValueChange={(value: 'random' | 'sequential' | 'specific') => updateSettings({ mode: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="random">Zufällige Auswahl</SelectItem>
                <SelectItem value="sequential">Der Reihe nach</SelectItem>
                <SelectItem value="specific">Feste Animation</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Animation auswählen bei specific */}
          {settings.mode === 'specific' && (
            <div className="space-y-2">
              <Label>Animation</Label>
              <div className="grid grid-cols-5 gap-2">
                {ANIMATION_OPTIONS.map(anim => (
                  <Button
                    key={anim.key}
                    variant={settings.selectedAnimation === anim.key ? "default" : "outline"}
                    className="h-16 flex flex-col items-center justify-center gap-1"
                    onClick={() => updateSettings({ selectedAnimation: anim.key })}
                  >
                    <span className="text-xl">{anim.emoji}</span>
                    <span className="text-xs">{anim.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {/* Häufigkeit */}
          <div className="space-y-2">
            <Label>Häufigkeit</Label>
            <Select 
              value={settings.frequency}
              onValueChange={(value: 'always' | 'sometimes' | 'rarely') => updateSettings({ frequency: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Immer (100%)</SelectItem>
                <SelectItem value="sometimes">Manchmal (50%)</SelectItem>
                <SelectItem value="rarely">Selten (20%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Geschwindigkeit */}
          <div className="space-y-2">
            <Label>Geschwindigkeit</Label>
            <ToggleGroup 
              type="single" 
              value={settings.speed} 
              onValueChange={(v) => v && updateSettings({ speed: v as 'slow' | 'normal' | 'fast' })}
              className="justify-start"
            >
              <ToggleGroupItem value="slow">Langsam</ToggleGroupItem>
              <ToggleGroupItem value="normal">Normal</ToggleGroupItem>
              <ToggleGroupItem value="fast">Schnell</ToggleGroupItem>
            </ToggleGroup>
          </div>
          
          {/* Größe */}
          <div className="space-y-2">
            <Label>Größe</Label>
            <ToggleGroup 
              type="single" 
              value={settings.size} 
              onValueChange={(v) => v && updateSettings({ size: v as 'small' | 'medium' | 'large' })}
              className="justify-start"
            >
              <ToggleGroupItem value="small">Klein</ToggleGroupItem>
              <ToggleGroupItem value="medium">Mittel</ToggleGroupItem>
              <ToggleGroupItem value="large">Groß</ToggleGroupItem>
            </ToggleGroup>
          </div>
          
          {/* Vorschau */}
          <Button 
            variant="outline" 
            onClick={() => setShowPreview(true)}
            className="w-full"
          >
            <Eye className="mr-2 h-4 w-4" />
            Vorschau anzeigen
          </Button>
        </CardContent>
      </Card>

      {/* Preview Animation */}
      <CelebrationAnimationSystem 
        isVisible={showPreview} 
        onAnimationComplete={() => setShowPreview(false)} 
      />
    </>
  );
}
