import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Save, Users, Eye, AlertTriangle, FileText, MessageSquare, Paperclip, Settings, Layout, Building, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import LetterAttachmentManager from './LetterAttachmentManager';
import type { Letter, LetterTemplate } from './types';

interface LetterEditorToolbarProps {
  letter?: Letter;
  editedLetter: Partial<Letter>;
  setEditedLetter: React.Dispatch<React.SetStateAction<Partial<Letter>>>;
  currentTemplate: LetterTemplate | null;
  canEdit: boolean;
  saving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  activeUsers: string[];
  showDINPreview: boolean;
  setShowDINPreview: (v: boolean) => void;
  showBriefDetails: boolean;
  setShowBriefDetails: (v: boolean) => void;
  showPagination: boolean;
  setShowPagination: (v: boolean) => void;
  attachments: any[];
  fetchAttachments: () => void;
  senderInfos: any[];
  informationBlocks: any[];
  templates: LetterTemplate[];
  computedSalutation: string;
  onTemplateChange: (templateId: string) => void;
  onAutoSaveSchedule: () => void;
}

export const LetterEditorToolbar: React.FC<LetterEditorToolbarProps> = React.memo(({
  letter, editedLetter, setEditedLetter, currentTemplate, canEdit,
  saving, lastSaved, hasUnsavedChanges, activeUsers,
  showDINPreview, setShowDINPreview, showBriefDetails, setShowBriefDetails,
  showPagination, setShowPagination,
  attachments, fetchAttachments, senderInfos, informationBlocks, templates,
  computedSalutation, onTemplateChange, onAutoSaveSchedule,
}) => {
  return (
    <div className="flex-none border-b bg-card/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <div className="flex items-center gap-2">
            <span className="font-medium">{letter ? 'Brief bearbeiten' : 'Neuer Brief'}</span>
            {activeUsers.length > 0 && (
              <Badge variant="secondary" className="text-xs"><Users className="h-3 w-3 mr-1" />{activeUsers.length}</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Badge variant="outline" className="text-xs animate-pulse">•••</Badge>}
          {lastSaved && !saving && (
            <Badge variant="outline" className="text-xs opacity-60">✓ {lastSaved.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</Badge>
          )}
          {hasUnsavedChanges && !saving && (
            <Badge variant="outline" className="text-xs border-amber-200 text-amber-700">
              <AlertTriangle className="h-3 w-3 mr-1" />Wird gespeichert...
            </Badge>
          )}

          <Button variant={showDINPreview ? 'default' : 'outline'} size="sm" onClick={() => setShowDINPreview(!showDINPreview)}>
            <Eye className="h-4 w-4 mr-2" />Druckvorschau
          </Button>
          <Button variant={showBriefDetails ? 'default' : 'outline'} size="sm" onClick={() => setShowBriefDetails(!showBriefDetails)}>
            <FileText className="h-4 w-4 mr-2" />Briefdetails
          </Button>

          {/* Anlagen Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><Paperclip className="h-4 w-4 mr-2" />Anlagen</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[420px] p-3">
              {letter?.id ? (
                <LetterAttachmentManager letterId={letter.id} attachments={attachments as any} onAttachmentUpdate={fetchAttachments} readonly={!canEdit} />
              ) : (
                <div className="p-4 text-center text-muted-foreground border border-dashed rounded-lg">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">Anlagen verfügbar nach dem Speichern</p>
                  <p className="text-sm">Speichern Sie den Brief zuerst, um Anlagen hinzufügen zu können.</p>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Basisinformationen Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-2" />Basisinformationen</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[520px] p-3 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="subject">Betreff</Label>
                  <Input id="subject" value={editedLetter.subject || ''} onChange={(e) => setEditedLetter(prev => ({ ...prev, subject: e.target.value, title: e.target.value }))} disabled={!canEdit} placeholder="Betreff des Briefes" />
                </div>
                <div>
                  <Label htmlFor="salutation-override">Anrede</Label>
                  <Input id="salutation-override" value={editedLetter.salutation_override || ''} onChange={(e) => setEditedLetter(prev => ({ ...prev, salutation_override: e.target.value }))} disabled={!canEdit} placeholder={computedSalutation} />
                  <p className="text-xs text-muted-foreground mt-1">Leer lassen für automatische Anrede</p>
                </div>
                <div>
                  <Label htmlFor="closing-formula">Abschlussformel</Label>
                  <Input id="closing-formula" value={editedLetter.closing_formula || ''} onChange={(e) => setEditedLetter(prev => ({ ...prev, closing_formula: e.target.value }))} disabled={!canEdit} placeholder={currentTemplate?.layout_settings?.closing?.formula || 'Mit freundlichen Grüßen'} />
                </div>
                <div>
                  <Label htmlFor="closing-name">Unterschrift</Label>
                  <Input id="closing-name" value={editedLetter.closing_name || ''} onChange={(e) => setEditedLetter(prev => ({ ...prev, closing_name: e.target.value }))} disabled={!canEdit} placeholder={currentTemplate?.layout_settings?.closing?.signatureName || 'Name'} />
                </div>
                <div>
                  <Label htmlFor="reference-number">Aktenzeichen</Label>
                  <Input id="reference-number" value={editedLetter.reference_number || ''} onChange={(e) => setEditedLetter(prev => ({ ...prev, reference_number: e.target.value }))} disabled={!canEdit} placeholder="z.B. AZ-2024-001" />
                </div>
                <div>
                  <Label htmlFor="letter-date">Briefdatum</Label>
                  <Input id="letter-date" type="date" value={editedLetter.letter_date || ''} onChange={(e) => setEditedLetter(prev => ({ ...prev, letter_date: e.target.value }))} disabled={!canEdit} />
                </div>
                <div>
                  <Label htmlFor="expected-response-date">Erwartete Antwort bis</Label>
                  <Input id="expected-response-date" type="date" value={editedLetter.expected_response_date || ''} onChange={(e) => setEditedLetter(prev => ({ ...prev, expected_response_date: e.target.value }))} disabled={!canEdit} />
                </div>
                <div>
                  <Label htmlFor="recipient-name">Empfänger</Label>
                  <Input id="recipient-name" value={editedLetter.recipient_name || ''} onChange={(e) => setEditedLetter(prev => ({ ...prev, recipient_name: e.target.value }))} disabled={!canEdit} placeholder="Name des Empfängers" />
                </div>
                <div>
                  <Label htmlFor="recipient-address">Empfängeradresse</Label>
                  <Textarea id="recipient-address" value={editedLetter.recipient_address || ''} onChange={(e) => setEditedLetter(prev => ({ ...prev, recipient_address: e.target.value }))} disabled={!canEdit} placeholder="Adresse des Empfängers" rows={3} />
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Layout Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-2" />Layout</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[520px] p-3 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch id="pagination" checked={showPagination} onCheckedChange={(checked) => { setShowPagination(checked); onAutoSaveSchedule(); }} disabled={!canEdit} />
                  <Label htmlFor="pagination">Paginierung anzeigen</Label>
                </div>
                <div>
                  <Label htmlFor="sender-info">Absenderinformation</Label>
                  <Select value={editedLetter.sender_info_id || 'none'} onValueChange={(value) => setEditedLetter(prev => ({ ...prev, sender_info_id: value === 'none' ? undefined : value }))} disabled={!canEdit}>
                    <SelectTrigger><SelectValue placeholder="Absender auswählen..." /></SelectTrigger>
                    <SelectContent className="z-[100]">
                      <SelectItem value="none">Kein Absender</SelectItem>
                      {senderInfos.map((info: any) => (
                        <SelectItem key={info.id} value={info.id}>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />{info.name}
                            {info.is_default && <Badge variant="secondary" className="text-xs">Standard</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Informationsblöcke</Label>
                  <div className="space-y-2 mt-2">
                    {informationBlocks.map((block: any) => (
                      <div key={block.id} className="flex items-center space-x-2">
                        <input type="checkbox" id={`block-${block.id}`} checked={editedLetter.information_block_ids?.includes(block.id) || false}
                          onChange={(e) => {
                            const currentIds = editedLetter.information_block_ids || [];
                            const newIds = e.target.checked ? [...currentIds, block.id] : currentIds.filter((id: string) => id !== block.id);
                            setEditedLetter(prev => ({ ...prev, information_block_ids: newIds }));
                          }} disabled={!canEdit} className="rounded border border-input" />
                        <Label htmlFor={`block-${block.id}`} className="text-sm">
                          <div className="flex items-center gap-2">
                            <Info className="h-4 w-4" />{block.label}
                            {block.is_default && <Badge variant="secondary" className="text-xs">Standard</Badge>}
                          </div>
                        </Label>
                      </div>
                    ))}
                    {informationBlocks.length === 0 && <p className="text-sm text-muted-foreground">Keine Informationsblöcke verfügbar</p>}
                  </div>
                </div>
                <div>
                  <Label htmlFor="template-select">Brief-Template</Label>
                  <div className="flex items-center gap-2 mb-2">
                    <Layout className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{currentTemplate ? currentTemplate.name : 'Kein Template ausgewählt'}</span>
                  </div>
                  <Select value={editedLetter.template_id || 'none'} onValueChange={onTemplateChange} disabled={!canEdit}>
                    <SelectTrigger><SelectValue placeholder="Template auswählen..." /></SelectTrigger>
                    <SelectContent className="z-[100]">
                      <SelectItem value="none">Kein Template</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{template.name}</span>
                            {template.is_default && <Badge variant="secondary" className="ml-2 text-xs">Standard</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Workflow Buttons */}
          <Button variant="outline" size="sm" onClick={() => {}}>
            <MessageSquare className="h-4 w-4 mr-2" />Kommentare
          </Button>
        </div>
      </div>
    </div>
  );
});

LetterEditorToolbar.displayName = 'LetterEditorToolbar';
