import React from 'react';
import { Edit3, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LetterTemplate, DEFAULT_ATTACHMENT_PREVIEW_LINES } from './types';
import { sanitizeRichHtml } from '@/utils/htmlSanitizer';
import { type LetterCanvasElement, isLetterCanvasElementArray } from '@/types/letterLayout';

interface TemplateGridProps {
  templates: LetterTemplate[];
  showPreview: string | null;
  setShowPreview: (id: string | null) => void;
  startEditing: (template: LetterTemplate) => void;
  handleDeleteTemplate: (template: LetterTemplate) => void;
}

export const TemplateGrid: React.FC<TemplateGridProps> = ({
  templates, showPreview, setShowPreview, startEditing, handleDeleteTemplate,
}) => {
  const previewAttachments = DEFAULT_ATTACHMENT_PREVIEW_LINES.map((line) => line.replace(/^-\s*/, ''));
  const previewContent = `<div style="margin-top: 20px; padding: 20px; border: 1px dashed #ccc; font-size: 11pt; line-height: 1.4;"><p><em>Hier würde der Briefinhalt stehen...</em></p><div style="height: 13.5mm;"></div><div style="font-weight: 700;">Anlagen</div>${previewAttachments.map((name) => `<div style=\"font-weight: 700; margin-top: 1mm;\">- ${name}</div>`).join('')}</div>`;

  const renderPreview = (template: LetterTemplate) => {
    let previewHtml = '';
    let headerElements: LetterCanvasElement[] = [];
    if (template.header_text_elements) {
      if (typeof template.header_text_elements === 'string') {
        try {
          const parsed = JSON.parse(template.header_text_elements) as unknown;
          headerElements = isLetterCanvasElementArray(parsed) ? parsed : [];
        } catch {
          headerElements = [];
        }
      } else if (isLetterCanvasElementArray(template.header_text_elements)) {
        headerElements = template.header_text_elements;
      }
    }
    if (template.header_layout_type === 'structured' && headerElements.length > 0) {
      const structuredElements = headerElements.map((element) => {
        if (element.type === 'text') {
          return `<div style="position: absolute; left: ${(element.x / 595) * 100}%; top: ${(element.y / 200) * 100}%; width: ${((element.width || 50) / 595) * 100}%; font-size: ${element.fontSize || 16}px; font-family: ${element.fontFamily || 'Arial'}, sans-serif; font-weight: ${element.fontWeight || 'normal'}; color: ${element.color || '#000000'}; line-height: 1.2;">${element.content || ''}</div>`;
        } else if (element.type === 'image' && element.imageUrl) {
          return `<img src="${element.imageUrl}" style="position: absolute; left: ${(element.x / 595) * 100}%; top: ${(element.y / 200) * 100}%; width: ${((element.width || 50) / 595) * 100}%; height: ${((element.height || 50) / 200) * 100}%; object-fit: contain;" alt="Header Image" />`;
        }
        return '';
      }).join('');
      previewHtml = `<div style="position: relative; width: 100%; height: 200px; background: white; border: 1px solid #e0e0e0; margin-bottom: 20px;">${structuredElements}</div>${previewContent}`;
    } else if (template.letterhead_html) {
      previewHtml = `<style>${template.letterhead_css || ''}</style>${template.letterhead_html}${previewContent}`;
    } else {
      previewHtml = `<div style="padding: 20px; text-align: center; color: #666;"><p>Kein Header definiert</p></div>${previewContent}`;
    }
    return (
      <Dialog open={showPreview === template.id} onOpenChange={(open) => !open && setShowPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Vorschau: {template.name}</DialogTitle></DialogHeader>
          <div className="border rounded-lg p-4 bg-white" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(previewHtml) }} />
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((template) => (
        <Card key={template.id} className="relative">
          {renderPreview(template)}
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm break-words">{template.name}</CardTitle>
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(template.id)} title="Vorschau"><Eye className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => startEditing(template)} title="Template bearbeiten"><Edit3 className="h-4 w-4" /></Button>
                {!template.is_default && (<Button variant="ghost" size="sm" onClick={() => handleDeleteTemplate(template)}><Trash2 className="h-4 w-4 text-destructive" /></Button>)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Badge variant="outline" className="text-xs">{template.response_time_days} Tage</Badge>
              {template.is_default && (<Badge variant="default" className="text-xs">Standard</Badge>)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
