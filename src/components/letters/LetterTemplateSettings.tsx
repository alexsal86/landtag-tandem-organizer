import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_DIN5008_LAYOUT } from '@/types/letterLayout';

interface LetterTemplateSettingsProps {
  onBack: () => void;
}

interface VariableEntry {
  key: string;
  label: string;
  value: string;
  source: string;
}

const AVAILABLE_VARIABLES: { key: string; label: string; source: string }[] = [
  { key: '{{bearbeiter}}', label: 'Bearbeiter', source: 'Absenderinformation' },
  { key: '{{telefon}}', label: 'Telefon', source: 'Absenderinformation' },
  { key: '{{email}}', label: 'E-Mail', source: 'Absenderinformation' },
  { key: '{{datum}}', label: 'Datum', source: 'Automatisch' },
  { key: '{{aktenzeichen}}', label: 'Aktenzeichen', source: 'Briefdaten' },
  { key: '{{unser_zeichen}}', label: 'Unser Zeichen', source: 'Info-Block' },
  { key: '{{anrede}}', label: 'Anrede', source: 'Automatisch (Empfänger)' },
  { key: '{{anrede_name}}', label: 'Anrede Name', source: 'Automatisch (Empfänger)' },
  { key: '{{betreff}}', label: 'Betreff', source: 'Briefdaten' },
  { key: '{{absender_name}}', label: 'Absender Name', source: 'Absenderinformation' },
  { key: '{{absender_organisation}}', label: 'Absender Organisation', source: 'Absenderinformation' },
  { key: '{{absender_strasse}}', label: 'Absender Straße', source: 'Absenderinformation' },
  { key: '{{absender_plz_ort}}', label: 'Absender PLZ/Ort', source: 'Absenderinformation' },
  { key: '{{empfaenger_name}}', label: 'Empfänger Name', source: 'Kontakt' },
  { key: '{{empfaenger_anrede}}', label: 'Empfänger Anrede (Herrn/Frau)', source: 'Kontakt (Geschlecht)' },
  { key: '{{empfaenger_briefanrede}}', label: 'Empfänger Briefanrede (Herr/Frau)', source: 'Kontakt (Geschlecht)' },
  { key: '{{empfaenger_nachname}}', label: 'Empfänger Nachname', source: 'Kontakt' },
  { key: '{{empfaenger_strasse}}', label: 'Empfänger Straße', source: 'Kontakt' },
  { key: '{{empfaenger_plz}}', label: 'Empfänger PLZ', source: 'Kontakt' },
  { key: '{{empfaenger_ort}}', label: 'Empfänger Ort', source: 'Kontakt' },
  { key: '{{empfaenger_land}}', label: 'Empfänger Land', source: 'Kontakt' },
  { key: '{{anlagen_liste}}', label: 'Anlagenliste', source: 'Automatisch' },
];

const DIN5008_FIELDS = [
  { path: ['pageWidth'], label: 'Seitenbreite', section: 'Seite' },
  { path: ['pageHeight'], label: 'Seitenhöhe', section: 'Seite' },
  { path: ['margins', 'left'], label: 'Rand links', section: 'Ränder' },
  { path: ['margins', 'right'], label: 'Rand rechts', section: 'Ränder' },
  { path: ['margins', 'top'], label: 'Rand oben', section: 'Ränder' },
  { path: ['margins', 'bottom'], label: 'Rand unten', section: 'Ränder' },
  { path: ['header', 'height'], label: 'Header Höhe', section: 'Header' },
  { path: ['header', 'marginBottom'], label: 'Header Abstand unten', section: 'Header' },
  { path: ['addressField', 'top'], label: 'Adressfeld von oben', section: 'Adressfeld' },
  { path: ['addressField', 'left'], label: 'Adressfeld von links', section: 'Adressfeld' },
  { path: ['addressField', 'width'], label: 'Adressfeld Breite', section: 'Adressfeld' },
  { path: ['addressField', 'height'], label: 'Adressfeld Höhe', section: 'Adressfeld' },
  { path: ['addressField', 'returnAddressHeight'], label: 'Vermerkzone Höhe', section: 'Adressfeld' },
  { path: ['addressField', 'addressZoneHeight'], label: 'Anschriftzone Höhe', section: 'Adressfeld' },
  { path: ['infoBlock', 'top'], label: 'Info-Block von oben', section: 'Info-Block' },
  { path: ['infoBlock', 'left'], label: 'Info-Block von links', section: 'Info-Block' },
  { path: ['infoBlock', 'width'], label: 'Info-Block Breite', section: 'Info-Block' },
  { path: ['infoBlock', 'height'], label: 'Info-Block Höhe', section: 'Info-Block' },
  { path: ['subject', 'top'], label: 'Betreff von oben', section: 'Betreff' },
  { path: ['subject', 'marginBottom'], label: 'Betreff Abstand unten', section: 'Betreff' },
  { path: ['content', 'top'], label: 'Inhalt von oben', section: 'Inhalt' },
  { path: ['content', 'maxHeight'], label: 'Inhalt max. Höhe', section: 'Inhalt' },
  { path: ['content', 'lineHeight'], label: 'Zeilenhöhe', section: 'Inhalt' },
  { path: ['footer', 'top'], label: 'Footer von oben', section: 'Footer' },
  { path: ['footer', 'height'], label: 'Footer Höhe', section: 'Footer' },
  { path: ['attachments', 'top'], label: 'Anlagen von oben', section: 'Anlagen' },
];

const getNestedValue = (obj: any, path: string[]): number => {
  let current = obj;
  for (const key of path) {
    current = current?.[key];
  }
  return typeof current === 'number' ? current : 0;
};

const setNestedValue = (obj: any, path: string[], value: number): any => {
  const result = JSON.parse(JSON.stringify(obj));
  let current = result;
  for (let i = 0; i < path.length - 1; i++) {
    if (!current[path[i]]) current[path[i]] = {};
    current = current[path[i]];
  }
  current[path[path.length - 1]] = value;
  return result;
};

export const LetterTemplateSettings: React.FC<LetterTemplateSettingsProps> = ({ onBack }) => {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [variableDefaults, setVariableDefaults] = useState<Record<string, string>>({});
  const [din5008Defaults, setDin5008Defaults] = useState<Record<string, any>>(DEFAULT_DIN5008_LAYOUT as any);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentTenant) fetchSettings();
  }, [currentTenant]);

  const fetchSettings = async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('letter_template_settings' as any)
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setVariableDefaults((data as any).variable_defaults || {});
        if ((data as any).din5008_defaults && Object.keys((data as any).din5008_defaults).length > 0) {
          setDin5008Defaults((data as any).din5008_defaults);
        }
      }

      // Load sender info defaults
      const { data: senderData } = await supabase
        .from('sender_information')
        .select('name, organization, wahlkreis_street, wahlkreis_house_number, wahlkreis_postal_code, wahlkreis_city, phone, wahlkreis_email')
        .eq('tenant_id', currentTenant.id)
        .eq('is_default', true)
        .maybeSingle();

      if (senderData) {
        setVariableDefaults(prev => ({
          ...prev,
          '{{bearbeiter}}': prev['{{bearbeiter}}'] || senderData.name || '',
          '{{telefon}}': prev['{{telefon}}'] || senderData.phone || '',
          '{{email}}': prev['{{email}}'] || senderData.wahlkreis_email || '',
          '{{absender_name}}': prev['{{absender_name}}'] || senderData.name || '',
          '{{absender_organisation}}': prev['{{absender_organisation}}'] || senderData.organization || '',
          '{{absender_strasse}}': prev['{{absender_strasse}}'] || [senderData.wahlkreis_street, senderData.wahlkreis_house_number].filter(Boolean).join(' '),
          '{{absender_plz_ort}}': prev['{{absender_plz_ort}}'] || [senderData.wahlkreis_postal_code, senderData.wahlkreis_city].filter(Boolean).join(' '),
        }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentTenant) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('letter_template_settings' as any)
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('letter_template_settings' as any)
          .update({
            variable_defaults: variableDefaults,
            din5008_defaults: din5008Defaults,
          } as any)
          .eq('id', (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('letter_template_settings' as any)
          .insert({
            tenant_id: currentTenant.id,
            variable_defaults: variableDefaults,
            din5008_defaults: din5008Defaults,
          } as any);
        if (error) throw error;
      }

      toast({ title: 'Einstellungen gespeichert' });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({ title: 'Fehler', description: 'Einstellungen konnten nicht gespeichert werden.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDIN = () => {
    setDin5008Defaults(DEFAULT_DIN5008_LAYOUT as any);
  };

  const sections = [...new Set(DIN5008_FIELDS.map(f => f.section))];

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-2 text-muted-foreground">Einstellungen werden geladen...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <h2 className="text-xl font-semibold">Einstellungen für Briefvorlagen</h2>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Speichern...' : 'Speichern'}
        </Button>
      </div>

      {/* Variables Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Variablen-Übersicht</CardTitle>
          <p className="text-sm text-muted-foreground">
            Alle verfügbaren Variablen und ihre Standardwerte. Änderungen gelten als Fallback-Werte für neue Briefe.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Variable</TableHead>
                <TableHead className="w-40">Bezeichnung</TableHead>
                <TableHead>Standardwert</TableHead>
                <TableHead className="w-48">Quelle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {AVAILABLE_VARIABLES.map(v => (
                <TableRow key={v.key}>
                  <TableCell className="font-mono text-xs text-amber-700 dark:text-amber-400">{v.key}</TableCell>
                  <TableCell className="text-sm">{v.label}</TableCell>
                  <TableCell>
                    {v.source === 'Automatisch' || v.source === 'Automatisch (Empfänger)' ? (
                      <span className="text-muted-foreground text-sm italic">{v.source}</span>
                    ) : (
                      <Input
                        value={variableDefaults[v.key] || ''}
                        onChange={(e) => setVariableDefaults(prev => ({ ...prev, [v.key]: e.target.value }))}
                        className="h-8 text-sm"
                        placeholder="Standardwert..."
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{v.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Standardtext */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Standardtext für Briefinhalt</CardTitle>
          <p className="text-sm text-muted-foreground">
            Dieser Text wird als Standardinhalt für neue Briefe vorausgefüllt.
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            value={variableDefaults['default_content'] || ''}
            onChange={(e) => setVariableDefaults(prev => ({ ...prev, default_content: e.target.value }))}
            placeholder="Standardtext für neue Briefe eingeben..."
            rows={6}
          />
        </CardContent>
      </Card>

      {/* DIN 5008 Layout Defaults */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">DIN 5008 Standardmaße</CardTitle>
              <p className="text-sm text-muted-foreground">
                Basis-Layoutwerte für neue Templates. Alle Angaben in Millimetern (mm).
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleResetDIN}>
              <RotateCcw className="h-4 w-4 mr-2" />
              DIN 5008 Standard
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {sections.map(section => (
            <div key={section} className="space-y-3">
              <h4 className="font-semibold text-sm border-b pb-1">{section}</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {DIN5008_FIELDS.filter(f => f.section === section).map(field => (
                  <div key={field.path.join('.')} className="space-y-1">
                    <Label className="text-xs">{field.label}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={getNestedValue(din5008Defaults, field.path)}
                      onChange={(e) => setDin5008Defaults(prev => setNestedValue(prev, field.path, parseFloat(e.target.value) || 0))}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
