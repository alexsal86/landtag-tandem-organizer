import React, { useCallback, useMemo } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { StructuredHeaderEditor } from '@/components/letters/StructuredHeaderEditor';
import { LayoutSettingsEditor } from '@/components/letters/LayoutSettingsEditor';
import { LetterLayoutCanvasDesigner } from '@/components/letters/LetterLayoutCanvasDesigner';
import { SenderInformationManager } from '@/components/administration/SenderInformationManager';
import { BlockLineEditor, type BlockLine } from '@/components/letters/BlockLineEditor';
import { parseFooterLinesForEditor, toFooterLineData } from '@/components/letters/footerBlockUtils';
import { getLetterAssetPublicUrl } from '@/components/letters/letterAssetUrls';
import {
  type BlockEditorKey,
  isLineModeBlockData,
  type LayoutEditorTab,
  type LetterCanvasElement,
  type LetterLayoutSettings,
  type MarginKey,
  type TemplateFormData,
  type TabRect,
  type SenderInformation,
  type InformationBlock,
} from '@/types/letterLayout';

interface TenantLike {
  id: string;
}

interface ToastLike {
  (payload: { title: string; description?: string; variant?: 'default' | 'destructive' }): void;
}

interface TemplateFormTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  formData: TemplateFormData;
  setFormData: React.Dispatch<React.SetStateAction<TemplateFormData>>;
  editingTemplate: unknown;
  senderInfos: SenderInformation[];
  infoBlocks: InformationBlock[];
  handleCreateTemplate: () => void;
  resetForm: () => void;
  setShowCreateDialog: (v: boolean) => void;
  getBlockItems: (key: BlockEditorKey) => unknown;
  setBlockItems: (key: BlockEditorKey, items: unknown) => void;
  currentTenant: TenantLike | null;
  toast: ToastLike;
}

export const useTemplateFormTabs = ({
  activeTab, setActiveTab, formData, setFormData,
  editingTemplate, senderInfos, infoBlocks,
  handleCreateTemplate, resetForm, setShowCreateDialog,
  getBlockItems, setBlockItems, currentTenant, toast,
}: TemplateFormTabsProps) => {
  const isMobile = useIsMobile();
  const signaturePreviewUrl = useMemo(
    () => getLetterAssetPublicUrl(formData.layout_settings.closing?.signatureImagePath),
    [formData.layout_settings.closing?.signatureImagePath],
  );

  const getMarginsForRect = useCallback((rect: TabRect): MarginKey[] => {
    const { pageWidth, pageHeight, margins } = formData.layout_settings;
    return [
      ...(rect.x < margins.left ? (['left'] as MarginKey[]) : []),
      ...(rect.x + rect.width > pageWidth - margins.right ? (['right'] as MarginKey[]) : []),
      ...(rect.y < margins.top ? (['top'] as MarginKey[]) : []),
      ...(rect.y + rect.height > pageHeight - margins.bottom ? (['bottom'] as MarginKey[]) : []),
    ];
  }, [formData.layout_settings]);

  const tabMarginMap: Record<string, MarginKey[]> = {
    'canvas-designer': ['left', 'right', 'top', 'bottom'],
    'header-designer': getMarginsForRect({ x: 0, y: 0, width: formData.layout_settings.pageWidth, height: formData.layout_settings.header.height }),
    'footer-designer': getMarginsForRect({ x: 0, y: formData.layout_settings.footer.top, width: formData.layout_settings.pageWidth, height: formData.layout_settings.footer.height }),
    'block-address': getMarginsForRect({ x: formData.layout_settings.addressField.left, y: formData.layout_settings.addressField.top, width: formData.layout_settings.addressField.width, height: formData.layout_settings.addressField.height }),
    'block-info': getMarginsForRect({ x: formData.layout_settings.infoBlock.left, y: formData.layout_settings.infoBlock.top, width: formData.layout_settings.infoBlock.width, height: formData.layout_settings.infoBlock.height }),
    'block-subject': getMarginsForRect({ x: 0, y: formData.layout_settings.subject.top, width: formData.layout_settings.pageWidth, height: formData.layout_settings.subject.marginBottom }),
    'block-attachments': getMarginsForRect({ x: 0, y: formData.layout_settings.attachments.top, width: formData.layout_settings.pageWidth, height: Math.max(0, formData.layout_settings.pageHeight - formData.layout_settings.attachments.top) }),
    'layout-settings': ['left', 'right', 'top', 'bottom'],
    'general': [],
  };

  const marginLabelMap: Record<MarginKey, string> = { top: 'O', right: 'R', bottom: 'U', left: 'L' };

  const renderTabTrigger = (value: string, label: string, mobileLabel?: string) => {
    const margins = tabMarginMap[value] || [];
    return (
      <TabsTrigger className="shrink-0" value={value}>
        <span className="inline-flex items-center gap-1">
          <span>{isMobile && mobileLabel ? mobileLabel : label}</span>
          {margins.length > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-sm border px-1 py-0.5 text-[10px] leading-none text-muted-foreground" title={`Betroffene Seitenränder: ${margins.join(', ')}`}>
              {margins.map((m) => marginLabelMap[m]).join('·')}
            </span>
          )}
        </span>
      </TabsTrigger>
    );
  };

  const tabDefinitions: ReadonlyArray<{ value: string; label: string; mobileLabel?: string }> = [
    { value: 'canvas-designer', label: 'Canvas' },
    { value: 'header-designer', label: 'Header' },
    { value: 'footer-designer', label: 'Footer' },
    { value: 'block-address', label: 'Adressfeld', mobileLabel: 'Adresse' },
    { value: 'block-info', label: 'Info-Block', mobileLabel: 'Info' },
    { value: 'block-subject', label: 'Betreff, Anrede & Abschluss', mobileLabel: 'Betreff' },
    { value: 'block-attachments', label: 'Anlagen' },
    { value: 'layout-settings', label: 'Layout' },
    { value: 'general', label: 'Allgemein' },
  ];

  const activeTabDefinition = tabDefinitions.find((tab) => tab.value === activeTab);

  const extractBlockLines = (raw: unknown): BlockLine[] => {
    if (isLineModeBlockData(raw)) return raw.lines as BlockLine[];
    if (Array.isArray(raw) && raw.length > 0 && (raw[0]?.type === 'label-value' || raw[0]?.type === 'spacer' || raw[0]?.type === 'text-only')) {
      return raw as BlockLine[];
    }
    return [];
  };

  const renderSharedElementsEditor = (blockKey: BlockEditorKey, canvasWidthMm: number, canvasHeightMm: number) => {
    const initialElements = getBlockItems(blockKey);
    return (
      <StructuredHeaderEditor
        initialElements={Array.isArray(initialElements) ? (initialElements as HeaderElement[]) : []}
        onElementsChange={(elements) => setBlockItems(blockKey, elements)}
        layoutSettings={formData.layout_settings}
        canvasWidthMm={canvasWidthMm}
        canvasHeightMm={Math.max(8, canvasHeightMm)}
        blockKey={blockKey}
      />
    );
  };

  const renderTabsNavigation = () => (
    <>
      <div className="sm:hidden">
        <Label htmlFor="letter-template-tab-select" className="mb-2 block text-sm font-medium">Bereich</Label>
        <Select value={activeTab} onValueChange={setActiveTab}>
          <SelectTrigger id="letter-template-tab-select" className="w-full">
            <SelectValue>{activeTabDefinition ? (activeTabDefinition.mobileLabel ?? activeTabDefinition.label) : 'Bereich auswählen'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tabDefinitions.map((tab) => (
              <SelectItem key={tab.value} value={tab.value}>{tab.mobileLabel ?? tab.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <TabsList className="hidden w-full justify-start gap-1 overflow-x-auto whitespace-nowrap sm:flex">
        {tabDefinitions.map((tab) => renderTabTrigger(tab.value, tab.label, tab.mobileLabel))}
      </TabsList>
    </>
  );

  const renderCommonTabsContent = () => (
    <>
      <TabsContent value="canvas-designer" className="space-y-4">
        <LetterLayoutCanvasDesigner
          layoutSettings={formData.layout_settings}
          onLayoutChange={(settings) => setFormData((prev) => ({ ...prev, layout_settings: settings }))}
          onJumpToTab={setActiveTab as (tab: LayoutEditorTab) => void}
          headerElements={formData.header_elements}
          actionButtons={editingTemplate ? undefined : (
            <>
              <Button onClick={handleCreateTemplate}><Save className="h-4 w-4 mr-2" />Speichern</Button>
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); setActiveTab('canvas-designer'); resetForm(); }}><X className="h-4 w-4 mr-2" />Abbrechen</Button>
            </>
          )}
        />
      </TabsContent>

      <TabsContent value="header-designer" className="space-y-4 min-w-0">
        <StructuredHeaderEditor
          initialElements={formData.header_elements as HeaderElement[]}
          onElementsChange={(elements) => setFormData((prev) => ({ ...prev, header_elements: elements as LetterCanvasElement[] }))}
          layoutSettings={formData.layout_settings}
          actionButtons={editingTemplate ? undefined : (
            <div className="flex flex-col gap-2">
              <Button onClick={handleCreateTemplate}><Save className="h-4 w-4 mr-2" />Speichern</Button>
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); setActiveTab('canvas-designer'); resetForm(); }}><X className="h-4 w-4 mr-2" />Abbrechen</Button>
            </div>
          )}
        />
      </TabsContent>

      <TabsContent value="footer-designer" className="space-y-4">
        <BlockLineEditor
          blockType="footer"
          lines={parseFooterLinesForEditor(formData.footer_blocks)}
          onChange={(newLines) => {
            const footerData = toFooterLineData(newLines);
            setFormData((prev) => ({
              ...prev, footer_blocks: footerData,
              layout_settings: { ...prev.layout_settings, blockContent: { ...(prev.layout_settings.blockContent || {}), footer: footerData } },
            }));
          }}
        />
      </TabsContent>

      <TabsContent value="layout-settings" className="space-y-4">
        <LayoutSettingsEditor
          layoutSettings={formData.layout_settings}
          onLayoutChange={(settings) => setFormData((prev) => ({ ...prev, layout_settings: settings }))}
          letterheadHtml={formData.letterhead_html}
          letterheadCss={formData.letterhead_css}
          onLetterheadHtmlChange={(v) => setFormData((prev) => ({ ...prev, letterhead_html: v }))}
          onLetterheadCssChange={(v) => setFormData((prev) => ({ ...prev, letterhead_css: v }))}
        />
        <div className="border-t pt-4 space-y-4">
          <h3 className="text-lg font-semibold">Erweiterte HTML/CSS Bearbeitung</h3>
          <p className="text-sm text-muted-foreground">Für erfahrene Benutzer: Bearbeiten Sie den Briefkopf direkt mit HTML und CSS.</p>
          <div>
            <Label>Briefkopf HTML</Label>
            <Textarea value={formData.letterhead_html} onChange={(e) => setFormData((prev) => ({ ...prev, letterhead_html: e.target.value }))} placeholder="HTML für den Briefkopf..." rows={8} />
          </div>
          <div>
            <Label>Briefkopf CSS</Label>
            <Textarea value={formData.letterhead_css} onChange={(e) => setFormData((prev) => ({ ...prev, letterhead_css: e.target.value }))} placeholder="CSS-Stile für den Briefkopf..." rows={8} />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="general" className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder="Template-Name eingeben..." />
        </div>
        <div>
          <Label>Antwortzeit (Tage)</Label>
          <Input type="number" value={formData.response_time_days} onChange={(e) => setFormData((prev) => ({ ...prev, response_time_days: parseInt(e.target.value) || 21 }))} min="1" max="365" />
        </div>
        <div>
          <Label>Standard-Absenderinformation</Label>
          <Select value={formData.default_sender_id || "none"} onValueChange={(value) => setFormData((prev) => ({ ...prev, default_sender_id: value === "none" ? "" : value }))}>
            <SelectTrigger><SelectValue placeholder="Absenderinformation auswählen..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keine Auswahl</SelectItem>
              {senderInfos.map((sender) => (
                <SelectItem key={sender.id} value={sender.id}>{sender.name} - {sender.organization}{sender.is_default && " (Standard)"}</SelectItem>
              ))}
            </SelectContent>
        </Select>
        </div>
        <div className="border-t pt-4"><SenderInformationManager /></div>
        <div>
          <Label>Standard-Informationsblöcke</Label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {infoBlocks.map((block) => (
              <div key={block.id} className="flex items-center space-x-2">
                <Checkbox id={`block-${block.id}`} checked={formData.default_info_blocks.includes(block.id)} onCheckedChange={(checked) => {
                  if (checked) { setFormData((prev) => ({ ...prev, default_info_blocks: [...prev.default_info_blocks, block.id] })); }
                  else { setFormData((prev) => ({ ...prev, default_info_blocks: prev.default_info_blocks.filter((id: string) => id !== block.id) })); }
                }} />
                <Label htmlFor={`block-${block.id}`} className="text-sm">{block.label} {block.is_default && "(Standard)"}</Label>
              </div>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="block-address" className="space-y-6">
        <div>
          <h4 className="text-sm font-semibold mb-2">Rücksendezeile (Zusatz- und Vermerkzone – {formData.layout_settings.addressField.returnAddressHeight || 17.7}mm)</h4>
          <BlockLineEditor
            blockType="returnAddress"
            lines={extractBlockLines(getBlockItems('returnAddress'))}
            onChange={(newLines) => setBlockItems('returnAddress', { mode: 'lines', lines: newLines })}
          />
        </div>
        <div className="border-t" />
        <div>
          <h4 className="text-sm font-semibold mb-2">Empfängeranschrift (Anschriftzone – {formData.layout_settings.addressField.addressZoneHeight || 27.3}mm)</h4>
          <BlockLineEditor
            blockType="addressField"
            lines={extractBlockLines(getBlockItems('addressField'))}
            onChange={(newLines) => setBlockItems('addressField', { mode: 'lines', lines: newLines })}
          />
        </div>
      </TabsContent>

      <TabsContent value="block-info">
        <BlockLineEditor
          blockType="infoBlock"
          lines={extractBlockLines(getBlockItems('infoBlock'))}
          onChange={(newLines) => setBlockItems('infoBlock', { mode: 'lines', lines: newLines })}
        />
      </TabsContent>

      <TabsContent value="block-subject" className="space-y-4">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">Betreff-Darstellung</h4>
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={formData.layout_settings.subject?.integrated !== false}
                  onCheckedChange={(checked) => {
                    setFormData((prev) => ({ ...prev, layout_settings: { ...prev.layout_settings, subject: { ...prev.layout_settings.subject, integrated: !!checked } } }));
                  }}
                />
                Betreff in Inhaltsbereich integrieren (DIN 5008)
              </label>
            </div>

            <div className="mb-3">
              <Label className="text-xs mb-1 block">Betreffzeile</Label>
              <BlockLineEditor
                blockType="subject"
                lines={(() => {
                  const subjectLine = formData.layout_settings.blockContent?.subjectLine;
                  const configuredShape = formData.layout_settings.subject?.prefixShape || 'none';
                  if (isLineModeBlockData(subjectLine)) {
                    return (subjectLine.lines || []).map((line) => ({ ...line, prefixShape: line.prefixShape || configuredShape })) as BlockLine[];
                  }
                  if (Array.isArray(subjectLine) && subjectLine.length > 0) {
                    return [{ id: 'subject-1', type: 'text-only', value: subjectLine[0]?.content || '{{betreff}}', isVariable: true, prefixShape: configuredShape } as BlockLine];
                  }
                  return [{ id: 'subject-1', type: 'text-only', value: '{{betreff}}', isVariable: true, prefixShape: configuredShape } as BlockLine];
                })()}
                onChange={(newLines) => {
                  const firstShape = newLines.find((line) => line.type === 'text-only')?.prefixShape || 'none';
                  setFormData((prev) => ({
                    ...prev,
                    layout_settings: {
                      ...prev.layout_settings,
                      subject: { ...prev.layout_settings.subject, prefixShape: firstShape },
                      blockContent: { ...(prev.layout_settings.blockContent || {}), subjectLine: { mode: 'lines', lines: newLines } },
                    },
                  }));
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">Verwenden Sie {'{{betreff}}'} als Variable für den dynamischen Betreff des Briefes.</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Anrede-Vorlage</h4>
            <p className="text-xs text-muted-foreground mb-2">Die Variable {'{{anrede}}'} wird automatisch basierend auf dem Empfänger generiert.</p>
            <Select
              value={formData.layout_settings.salutation?.template || 'Sehr geehrte Damen und Herren,'}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, layout_settings: { ...prev.layout_settings, salutation: { ...(prev.layout_settings.salutation || { fontSize: 11 }), template: value } } }));
              }}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="{{anrede}}">Automatisch (basierend auf Empfänger)</SelectItem>
                <SelectItem value="Sehr geehrte Damen und Herren,">Sehr geehrte Damen und Herren,</SelectItem>
                <SelectItem value="Guten Tag,">Guten Tag,</SelectItem>
                <SelectItem value="Liebe Kolleginnen und Kollegen,">Liebe Kolleginnen und Kollegen,</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-2">Abschlussformel & Unterschrift</h4>
            <div className="space-y-3">
              <div>
                <Label>Abschlussformel</Label>
                <Input value={formData.layout_settings.closing?.formula || ''} onChange={(e) => { setFormData((prev) => ({ ...prev, layout_settings: { ...prev.layout_settings, closing: { ...(prev.layout_settings.closing || { formula: '', signatureName: '' }), formula: e.target.value } } })); }} placeholder="z.B. Mit freundlichen Grüßen" />
              </div>
              <div>
                <Label>Unterschrift-Name</Label>
                <Input value={formData.layout_settings.closing?.signatureName || ''} onChange={(e) => { setFormData((prev) => ({ ...prev, layout_settings: { ...prev.layout_settings, closing: { ...(prev.layout_settings.closing || { formula: '', signatureName: '' }), signatureName: e.target.value } } })); }} placeholder="z.B. Max Mustermann" />
              </div>
              <div>
                <Label>Unterschrift-Titel</Label>
                <Input value={formData.layout_settings.closing?.signatureTitle || ''} onChange={(e) => { setFormData((prev) => ({ ...prev, layout_settings: { ...prev.layout_settings, closing: { ...(prev.layout_settings.closing || { formula: '', signatureName: '' }), signatureTitle: e.target.value } } })); }} placeholder="z.B. Referent" />
              </div>
              <div>
                <Label>Unterschriftsbild</Label>
                {signaturePreviewUrl && (
                  <div className="mb-2 p-2 border rounded-lg bg-muted/30">
                    <img src={signaturePreviewUrl} alt="Unterschrift" className="max-h-16 max-w-[200px] object-contain" />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file'; input.accept = 'image/*';
                    input.onchange = async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (!file || !currentTenant) return;
                      const filePath = `signatures/${currentTenant.id}/${Date.now()}-${file.name}`;
                      const { error } = await supabase.storage.from('letter-assets').upload(filePath, file);
                      if (error) { toast({ title: 'Upload fehlgeschlagen', description: error.message, variant: 'destructive' }); return; }
                      setFormData((prev) => ({ ...prev, layout_settings: { ...prev.layout_settings, closing: { ...(prev.layout_settings.closing || { formula: '', signatureName: '' }), signatureImagePath: filePath } } }));
                      toast({ title: 'Unterschriftsbild hochgeladen' });
                    };
                    input.click();
                  }}>Bild hochladen</Button>
                  {formData.layout_settings.closing?.signatureImagePath && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                      setFormData((prev) => ({ ...prev, layout_settings: { ...prev.layout_settings, closing: { ...(prev.layout_settings.closing || { formula: '', signatureName: '' }), signatureImagePath: '' } } }));
                    }}>Entfernen</Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Laden Sie ein Bild Ihrer Unterschrift hoch (PNG, JPG).</p>
              </div>
            </div>
          </div>

          {formData.layout_settings.subject?.integrated === false && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Betreff als Canvas-Element</h4>
              {renderSharedElementsEditor('subject',
                formData.layout_settings.pageWidth - formData.layout_settings.margins.left - formData.layout_settings.margins.right,
                Math.max(8, formData.layout_settings.subject.marginBottom + 4)
              )}
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="block-attachments" className="space-y-4">
        {renderSharedElementsEditor('attachments',
          formData.layout_settings.pageWidth - formData.layout_settings.margins.left - formData.layout_settings.margins.right, 20
        )}
      </TabsContent>
    </>
  );

  return { renderTabsNavigation, renderCommonTabsContent, tabDefinitions };
};
