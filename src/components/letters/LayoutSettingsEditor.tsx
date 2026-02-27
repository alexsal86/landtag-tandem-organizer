import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { DEFAULT_DIN5008_LAYOUT, LetterLayoutSettings } from '@/types/letterLayout';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface LayoutSettingsEditorProps {
  layoutSettings: LetterLayoutSettings;
  onLayoutChange: (settings: LetterLayoutSettings) => void;
  letterheadHtml?: string;
  letterheadCss?: string;
  onLetterheadHtmlChange?: (value: string) => void;
  onLetterheadCssChange?: (value: string) => void;
}

export function LayoutSettingsEditor({ layoutSettings, onLayoutChange, letterheadHtml, letterheadCss, onLetterheadHtmlChange, onLetterheadCssChange }: LayoutSettingsEditorProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleResetToDefault = () => {
    onLayoutChange(DEFAULT_DIN5008_LAYOUT);
  };

  const updateSetting = (path: string[], value: number | string | boolean) => {
    const newSettings = JSON.parse(JSON.stringify(layoutSettings));
    let current: any = newSettings;
    
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    
    onLayoutChange(newSettings);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Layout-Einstellungen</h3>
          <p className="text-sm text-muted-foreground">
            Konfigurieren Sie alle Abstände und Positionen für dieses Template (alle Werte in mm)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetToDefault}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          DIN 5008 Standard
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seitenformat */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-bold">Seitenformat</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="page-width">Breite (mm)</Label>
              <Input id="page-width" type="number" value={layoutSettings.pageWidth} onChange={(e) => updateSetting(['pageWidth'], parseFloat(e.target.value))} step="0.1" />
            </div>
            <div>
              <Label htmlFor="page-height">Höhe (mm)</Label>
              <Input id="page-height" type="number" value={layoutSettings.pageHeight} onChange={(e) => updateSetting(['pageHeight'], parseFloat(e.target.value))} step="0.1" />
            </div>
          </div>
        </div>

        {/* Seitenränder */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-bold">Seitenränder</h4>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="margin-left">Links (mm)</Label><Input id="margin-left" type="number" value={layoutSettings.margins.left} onChange={(e) => updateSetting(['margins', 'left'], parseFloat(e.target.value))} step="0.1" /></div>
            <div><Label htmlFor="margin-right">Rechts (mm)</Label><Input id="margin-right" type="number" value={layoutSettings.margins.right} onChange={(e) => updateSetting(['margins', 'right'], parseFloat(e.target.value))} step="0.1" /></div>
            <div><Label htmlFor="margin-top">Oben (mm)</Label><Input id="margin-top" type="number" value={layoutSettings.margins.top} onChange={(e) => updateSetting(['margins', 'top'], parseFloat(e.target.value))} step="0.1" /></div>
            <div><Label htmlFor="margin-bottom">Unten (mm)</Label><Input id="margin-bottom" type="number" value={layoutSettings.margins.bottom} onChange={(e) => updateSetting(['margins', 'bottom'], parseFloat(e.target.value))} step="0.1" /></div>
          </div>
        </div>

        {/* Header */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-bold">Header</h4>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="header-height">Höhe (mm)</Label><Input id="header-height" type="number" value={layoutSettings.header.height} onChange={(e) => updateSetting(['header', 'height'], parseFloat(e.target.value))} step="0.1" /></div>
            <div><Label htmlFor="header-margin-bottom">Abstand unten (mm)</Label><Input id="header-margin-bottom" type="number" value={layoutSettings.header.marginBottom} onChange={(e) => updateSetting(['header', 'marginBottom'], parseFloat(e.target.value))} step="0.1" /></div>
          </div>
        </div>

        {/* Adressfeld (combined: Vermerkzone + Anschriftzone) */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-bold">Adressfeld (inkl. Rücksendezeile)</h4>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="address-top">Von oben (mm)</Label><Input id="address-top" type="number" value={layoutSettings.addressField.top} onChange={(e) => updateSetting(['addressField', 'top'], parseFloat(e.target.value))} step="0.1" /></div>
            <div><Label htmlFor="address-left">Von links (mm)</Label><Input id="address-left" type="number" value={layoutSettings.addressField.left} onChange={(e) => updateSetting(['addressField', 'left'], parseFloat(e.target.value))} step="0.1" /></div>
            <div><Label htmlFor="address-width">Breite (mm)</Label><Input id="address-width" type="number" value={layoutSettings.addressField.width} onChange={(e) => updateSetting(['addressField', 'width'], parseFloat(e.target.value))} step="0.1" /></div>
            <div><Label htmlFor="address-height">Gesamthöhe (mm)</Label><Input id="address-height" type="number" value={layoutSettings.addressField.height} onChange={(e) => updateSetting(['addressField', 'height'], parseFloat(e.target.value))} step="0.1" /></div>
            <div><Label htmlFor="return-address-height">Vermerkzone (mm)</Label><Input id="return-address-height" type="number" value={layoutSettings.addressField.returnAddressHeight || 17.7} onChange={(e) => updateSetting(['addressField', 'returnAddressHeight'], parseFloat(e.target.value))} step="0.1" /></div>
            <div><Label htmlFor="address-zone-height">Anschriftzone (mm)</Label><Input id="address-zone-height" type="number" value={layoutSettings.addressField.addressZoneHeight || 27.3} onChange={(e) => updateSetting(['addressField', 'addressZoneHeight'], parseFloat(e.target.value))} step="0.1" /></div>
          </div>
        </div>

        {/* Infoblock */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-bold">Informationsblock</h4>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="info-top">Von oben (mm)</Label><Input id="info-top" type="number" value={layoutSettings.infoBlock.top} onChange={(e) => updateSetting(['infoBlock', 'top'], parseFloat(e.target.value))} step="0.1" /></div>
            <div><Label htmlFor="info-left">Von links (mm)</Label><Input id="info-left" type="number" value={layoutSettings.infoBlock.left} onChange={(e) => updateSetting(['infoBlock', 'left'], parseFloat(e.target.value))} step="0.1" /></div>
            <div><Label htmlFor="info-width">Breite (mm)</Label><Input id="info-width" type="number" value={layoutSettings.infoBlock.width} onChange={(e) => updateSetting(['infoBlock', 'width'], parseFloat(e.target.value))} step="0.1" /></div>
            <div><Label htmlFor="info-height">Höhe (mm)</Label><Input id="info-height" type="number" value={layoutSettings.infoBlock.height} onChange={(e) => updateSetting(['infoBlock', 'height'], parseFloat(e.target.value))} step="0.1" /></div>
          </div>
        </div>

        {/* Betreffzeile */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-bold">Betreffzeile</h4>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="subject-top">Von oben (mm)</Label><Input id="subject-top" type="number" value={layoutSettings.subject.top} onChange={(e) => updateSetting(['subject', 'top'], parseFloat(e.target.value))} step="0.1" /></div>
            <div><Label htmlFor="subject-margin-bottom">Abstand unten (mm)</Label><Input id="subject-margin-bottom" type="number" value={layoutSettings.subject.marginBottom} onChange={(e) => updateSetting(['subject', 'marginBottom'], parseFloat(e.target.value))} step="0.1" /></div>
          </div>
        </div>

        {/* Inhalt */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-bold">Inhalt</h4>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="content-top">Von oben (mm)</Label><Input id="content-top" type="number" value={layoutSettings.content.top} onChange={(e) => updateSetting(['content', 'top'], parseFloat(e.target.value))} step="0.1" /></div>
            <div><Label htmlFor="content-max-height">Max. Höhe (mm)</Label><Input id="content-max-height" type="number" value={layoutSettings.content.maxHeight} onChange={(e) => updateSetting(['content', 'maxHeight'], parseFloat(e.target.value))} step="0.1" /></div>
            <div><Label htmlFor="content-line-height">Zeilenhöhe (mm)</Label><Input id="content-line-height" type="number" value={layoutSettings.content.lineHeight} onChange={(e) => updateSetting(['content', 'lineHeight'], parseFloat(e.target.value))} step="0.1" /></div>
          </div>
        </div>

        {/* Fußzeile */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-bold">Fußzeile</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="footer-top">Von oben (mm)</Label>
              <Input id="footer-top" type="number" value={layoutSettings.footer.top} onChange={(e) => updateSetting(['footer', 'top'], parseFloat(e.target.value))} step="0.1" />
            </div>
            <div>
              <Label htmlFor="footer-height">Höhe (mm)</Label>
              <Input id="footer-height" type="number" value={layoutSettings.footer.height} onChange={(e) => updateSetting(['footer', 'height'], parseFloat(e.target.value))} step="0.1" />
            </div>
          </div>
        </div>

        {/* Anlagen */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-bold">Anlagen</h4>
          <div>
            <Label htmlFor="attachments-top">Von oben (mm)</Label>
            <Input id="attachments-top" type="number" value={layoutSettings.attachments.top} onChange={(e) => updateSetting(['attachments', 'top'], parseFloat(e.target.value))} step="0.1" />
          </div>
        </div>

        {/* Paginierung */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-bold">Paginierung</h4>
          <div className="flex items-center gap-2 mb-2">
            <Checkbox
              id="pagination-enabled"
              checked={layoutSettings.pagination?.enabled ?? true}
              onCheckedChange={(checked) => updateSetting(['pagination', 'enabled'], !!checked)}
            />
            <Label htmlFor="pagination-enabled" className="cursor-pointer">Seitenzahlen anzeigen</Label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pagination-top">Von oben (mm)</Label>
              <Input id="pagination-top" type="number" value={layoutSettings.pagination?.top ?? 263.54} onChange={(e) => updateSetting(['pagination', 'top'], parseFloat(e.target.value))} step="0.1" />
            </div>
            <div>
              <Label htmlFor="pagination-align">Ausrichtung</Label>
              <Select value={layoutSettings.pagination?.align || 'right'} onValueChange={(value) => updateSetting(['pagination', 'align'], value)}>
                <SelectTrigger id="pagination-align">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Links</SelectItem>
                  <SelectItem value="center">Mittig</SelectItem>
                  <SelectItem value="right">Rechts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pagination-fontSize">Schriftgröße (pt)</Label>
              <Input id="pagination-fontSize" type="number" value={layoutSettings.pagination?.fontSize ?? 8} onChange={(e) => updateSetting(['pagination', 'fontSize'], parseFloat(e.target.value))} step="0.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Erweitert (HTML/CSS) - collapsible */}
      {onLetterheadHtmlChange && onLetterheadCssChange && (
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 text-sm font-medium">
              {advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Erweitert (HTML/CSS)
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Für erfahrene Benutzer: Bearbeiten Sie den Briefkopf direkt mit HTML und CSS.
            </p>
            <div>
              <Label htmlFor="letterhead-html">Briefkopf HTML</Label>
              <Textarea id="letterhead-html" value={letterheadHtml || ''} onChange={(e) => onLetterheadHtmlChange(e.target.value)} placeholder="HTML für den Briefkopf..." rows={8} />
            </div>
            <div>
              <Label htmlFor="letterhead-css">Briefkopf CSS</Label>
              <Textarea id="letterhead-css" value={letterheadCss || ''} onChange={(e) => onLetterheadCssChange(e.target.value)} placeholder="CSS-Stile für den Briefkopf..." rows={8} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
