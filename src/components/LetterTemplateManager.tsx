import React, { useState, useEffect } from 'react';
import { Edit3, Trash2, Plus, Save, X, Eye, EyeOff, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { FabricHeaderEditor } from '@/components/letters/FabricHeaderEditor';

interface LetterTemplate {
  id: string;
  name: string;
  letterhead_html: string;
  letterhead_css: string;
  response_time_days: number;
  is_default: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  default_sender_id?: string | null;
  default_info_blocks?: any;
  header_layout_type?: any;
  header_text_elements?: any;
}

interface SenderInformation {
  id: string;
  name: string;
  organization: string;
  is_default: boolean;
}

interface InformationBlock {
  id: string;
  name: string;
  label: string;
  is_default: boolean;
}

const LetterTemplateManager: React.FC = () => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [senderInfos, setSenderInfos] = useState<SenderInformation[]>([]);
  const [infoBlocks, setInfoBlocks] = useState<InformationBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LetterTemplate | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [showHeaderEditor, setShowHeaderEditor] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    letterhead_html: '',
    letterhead_css: '',
    response_time_days: 21,
    default_sender_id: '',
    default_info_blocks: [] as string[]
  });

  useEffect(() => {
    if (currentTenant) {
      fetchTemplates();
      fetchSenderInfos();
      fetchInformationBlocks();
    }
  }, [currentTenant]);

  const fetchTemplates = async () => {
    if (!currentTenant) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('letter_templates')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Fehler",
        description: "Templates konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSenderInfos = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from('sender_information')
        .select('id, name, organization, is_default')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setSenderInfos(data || []);
    } catch (error) {
      console.error('Error fetching sender infos:', error);
    }
  };

  const fetchInformationBlocks = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from('information_blocks')
        .select('id, name, label, is_default')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setInfoBlocks(data || []);
    } catch (error) {
      console.error('Error fetching info blocks:', error);
    }
  };

  const handleCreateTemplate = async () => {
    if (!currentTenant || !user || !formData.name.trim()) return;

    try {
      const { error } = await supabase
        .from('letter_templates')
        .insert({
          tenant_id: currentTenant.id,
          created_by: user.id,
          name: formData.name.trim(),
          letterhead_html: formData.letterhead_html,
          letterhead_css: formData.letterhead_css,
          response_time_days: formData.response_time_days,
          default_sender_id: formData.default_sender_id || null,
          default_info_blocks: formData.default_info_blocks.length > 0 ? formData.default_info_blocks : null
        });

      if (error) throw error;

      toast({
        title: "Template erstellt",
        description: "Das neue Template wurde erfolgreich erstellt.",
      });

      setShowCreateDialog(false);
      resetForm();
      fetchTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      toast({
        title: "Fehler",
        description: "Template konnte nicht erstellt werden.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;

    try {
      const { error } = await supabase
        .from('letter_templates')
        .update({
          name: formData.name.trim(),
          letterhead_html: formData.letterhead_html,
          letterhead_css: formData.letterhead_css,
          response_time_days: formData.response_time_days,
          default_sender_id: formData.default_sender_id || null,
          default_info_blocks: formData.default_info_blocks.length > 0 ? formData.default_info_blocks : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      toast({
        title: "Template aktualisiert",
        description: "Das Template wurde erfolgreich aktualisiert.",
      });

      setEditingTemplate(null);
      resetForm();
      fetchTemplates();
    } catch (error) {
      console.error('Error updating template:', error);
      toast({
        title: "Fehler",
        description: "Template konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async (template: LetterTemplate) => {
    if (!confirm(`Möchten Sie das Template "${template.name}" wirklich löschen?`)) return;

    try {
      const { error } = await supabase
        .from('letter_templates')
        .update({ is_active: false })
        .eq('id', template.id);

      if (error) throw error;

      toast({
        title: "Template gelöscht",
        description: "Das Template wurde erfolgreich gelöscht.",
      });

      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Fehler",
        description: "Template konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      letterhead_html: '',
      letterhead_css: '',
      response_time_days: 21,
      default_sender_id: '',
      default_info_blocks: []
    });
  };

  const startEditing = (template: LetterTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      letterhead_html: template.letterhead_html,
      letterhead_css: template.letterhead_css,
      response_time_days: template.response_time_days,
      default_sender_id: template.default_sender_id || '',
      default_info_blocks: template.default_info_blocks || []
    });
  };

  const cancelEditing = () => {
    setEditingTemplate(null);
    resetForm();
  };

  const handleEditHeader = (template: LetterTemplate) => {
    setShowHeaderEditor(template.id);
  };

  const handleSaveHeader = async (templateId: string, headerData: any) => {
    try {
      const { error } = await supabase
        .from('letter_templates')
        .update({
          header_layout_type: headerData.header_layout_type,
          header_text_elements: headerData.header_text_elements,
          letterhead_html: headerData.letterhead_html,
          letterhead_css: headerData.letterhead_css,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Header aktualisiert",
        description: "Der Header wurde erfolgreich aktualisiert.",
      });

      setShowHeaderEditor(null);
      fetchTemplates();
    } catch (error) {
      console.error('Error updating header:', error);
      toast({
        title: "Fehler",
        description: "Header konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const renderPreview = (template: LetterTemplate) => {
    // Use structured elements if available and layout type is structured
    let previewHtml = '';
    
    // Parse header_text_elements if it's a string (JSON)
    let headerElements: any[] = [];
    if (template.header_text_elements) {
      if (typeof template.header_text_elements === 'string') {
        try {
          headerElements = JSON.parse(template.header_text_elements);
        } catch (e) {
          console.warn('Failed to parse header_text_elements:', e);
          headerElements = [];
        }
      } else if (Array.isArray(template.header_text_elements)) {
        headerElements = template.header_text_elements;
      }
    }
    
    if (template.header_layout_type === 'structured' && headerElements.length > 0) {
      // Render structured elements
      const structuredElements = headerElements.map((element: any) => {
        if (element.type === 'text') {
          return `<div style="position: absolute; left: ${(element.x / 595) * 100}%; top: ${(element.y / 200) * 100}%; width: ${(element.width / 595) * 100}%; font-size: ${element.fontSize || 16}px; font-family: ${element.fontFamily || 'Arial'}, sans-serif; font-weight: ${element.fontWeight || 'normal'}; color: ${element.color || '#000000'}; line-height: 1.2;">${element.content || ''}</div>`;
        } else if (element.type === 'image' && element.imageUrl) {
          return `<img src="${element.imageUrl}" style="position: absolute; left: ${(element.x / 595) * 100}%; top: ${(element.y / 200) * 100}%; width: ${(element.width / 595) * 100}%; height: ${(element.height / 200) * 100}%; object-fit: contain;" alt="Header Image" />`;
        }
        return '';
      }).join('');
      
      previewHtml = `
        <div style="position: relative; width: 100%; height: 200px; background: white; border: 1px solid #e0e0e0; margin-bottom: 20px;">
          ${structuredElements}
        </div>
        <div style="margin-top: 20px; padding: 20px; border: 1px dashed #ccc;">
          <p><em>Hier würde der Briefinhalt stehen...</em></p>
        </div>
      `;
    } else if (template.letterhead_html) {
      // Fallback to HTML/CSS
      previewHtml = `
        <style>${template.letterhead_css || ''}</style>
        ${template.letterhead_html}
        <div style="margin-top: 20px; padding: 20px; border: 1px dashed #ccc;">
          <p><em>Hier würde der Briefinhalt stehen...</em></p>
        </div>
      `;
    } else {
      previewHtml = `
        <div style="padding: 20px; text-align: center; color: #666;">
          <p>Kein Header definiert</p>
        </div>
        <div style="margin-top: 20px; padding: 20px; border: 1px dashed #ccc;">
          <p><em>Hier würde der Briefinhalt stehen...</em></p>
        </div>
      `;
    }

    return (
      <Dialog open={showPreview === template.id} onOpenChange={(open) => !open && setShowPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vorschau: {template.name}</DialogTitle>
          </DialogHeader>
          <div 
            className="border rounded-lg p-4 bg-white"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Brief-Templates verwalten</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Neues Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Neues Brief-Template erstellen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Template-Name eingeben..."
                />
              </div>
              
              <div>
                <Label htmlFor="letterhead-html">Briefkopf HTML</Label>
                <Textarea
                  id="letterhead-html"
                  value={formData.letterhead_html}
                  onChange={(e) => setFormData(prev => ({ ...prev, letterhead_html: e.target.value }))}
                  placeholder="HTML für den Briefkopf..."
                  rows={8}
                />
              </div>
              
              <div>
                <Label htmlFor="letterhead-css">Briefkopf CSS</Label>
                <Textarea
                  id="letterhead-css"
                  value={formData.letterhead_css}
                  onChange={(e) => setFormData(prev => ({ ...prev, letterhead_css: e.target.value }))}
                  placeholder="CSS-Stile für den Briefkopf..."
                  rows={8}
                />
              </div>
              
              <div>
                <Label htmlFor="response-time">Antwortzeit (Tage)</Label>
                <Input
                  id="response-time"
                  type="number"
                  value={formData.response_time_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, response_time_days: parseInt(e.target.value) || 21 }))}
                  min="1"
                  max="365"
                />
              </div>
              
              <div>
                <Label htmlFor="default-sender">Standard-Absenderinformation</Label>
                <Select value={formData.default_sender_id || "none"} onValueChange={(value) => setFormData(prev => ({ ...prev, default_sender_id: value === "none" ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Absenderinformation auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Auswahl</SelectItem>
                    {senderInfos.map((sender) => (
                      <SelectItem key={sender.id} value={sender.id}>
                        {sender.name} - {sender.organization}
                        {sender.is_default && " (Standard)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Standard-Informationsblöcke</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {infoBlocks.map((block) => (
                    <div key={block.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`block-${block.id}`}
                        checked={formData.default_info_blocks.includes(block.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData(prev => ({
                              ...prev,
                              default_info_blocks: [...prev.default_info_blocks, block.id]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              default_info_blocks: prev.default_info_blocks.filter(id => id !== block.id)
                            }));
                          }
                        }}
                      />
                      <Label htmlFor={`block-${block.id}`} className="text-sm">
                        {block.label} {block.is_default && "(Standard)"}
                      </Label>
                    </div>
                  ))}
                  {infoBlocks.length === 0 && (
                    <p className="text-sm text-muted-foreground">Keine Informationsblöcke verfügbar</p>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
                  Abbrechen
                </Button>
                <Button onClick={handleCreateTemplate}>
                  Template erstellen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-muted-foreground">Templates werden geladen...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="relative">
              {renderPreview(template)}
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{template.name}</CardTitle>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPreview(template.id)}
                      title="Vorschau"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditHeader(template)}
                      title="Header bearbeiten"
                    >
                      <Palette className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(template)}
                      title="Template bearbeiten"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    {!template.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {template.response_time_days} Tage
                  </Badge>
                  {template.is_default && (
                    <Badge variant="default" className="text-xs">
                      Standard
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      {editingTemplate && (
        <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && cancelEditing()}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Template bearbeiten: {editingTemplate.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-template-name">Name</Label>
                <Input
                  id="edit-template-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Template-Name eingeben..."
                />
              </div>
              
              <div>
                <Label htmlFor="edit-letterhead-html">Briefkopf HTML</Label>
                <Textarea
                  id="edit-letterhead-html"
                  value={formData.letterhead_html}
                  onChange={(e) => setFormData(prev => ({ ...prev, letterhead_html: e.target.value }))}
                  placeholder="HTML für den Briefkopf..."
                  rows={8}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-letterhead-css">Briefkopf CSS</Label>
                <Textarea
                  id="edit-letterhead-css"
                  value={formData.letterhead_css}
                  onChange={(e) => setFormData(prev => ({ ...prev, letterhead_css: e.target.value }))}
                  placeholder="CSS-Stile für den Briefkopf..."
                  rows={8}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-response-time">Antwortzeit (Tage)</Label>
                <Input
                  id="edit-response-time"
                  type="number"
                  value={formData.response_time_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, response_time_days: parseInt(e.target.value) || 21 }))}
                  min="1"
                  max="365"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-default-sender">Standard-Absenderinformation</Label>
                <Select value={formData.default_sender_id || "none"} onValueChange={(value) => setFormData(prev => ({ ...prev, default_sender_id: value === "none" ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Absenderinformation auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Auswahl</SelectItem>
                    {senderInfos.map((sender) => (
                      <SelectItem key={sender.id} value={sender.id}>
                        {sender.name} - {sender.organization}
                        {sender.is_default && " (Standard)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Standard-Informationsblöcke</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {infoBlocks.map((block) => (
                    <div key={block.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-block-${block.id}`}
                        checked={formData.default_info_blocks.includes(block.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData(prev => ({
                              ...prev,
                              default_info_blocks: [...prev.default_info_blocks, block.id]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              default_info_blocks: prev.default_info_blocks.filter(id => id !== block.id)
                            }));
                          }
                        }}
                      />
                      <Label htmlFor={`edit-block-${block.id}`} className="text-sm">
                        {block.label} {block.is_default && "(Standard)"}
                      </Label>
                    </div>
                  ))}
                  {infoBlocks.length === 0 && (
                    <p className="text-sm text-muted-foreground">Keine Informationsblöcke verfügbar</p>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={cancelEditing}>
                  <X className="h-4 w-4 mr-2" />
                  Abbrechen
                </Button>
                <Button onClick={handleUpdateTemplate}>
                  <Save className="h-4 w-4 mr-2" />
                  Speichern
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Header Editor Dialog */}
      {showHeaderEditor && (
        <Dialog open={!!showHeaderEditor} onOpenChange={(open) => !open && setShowHeaderEditor(null)}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Header Editor - {templates.find(t => t.id === showHeaderEditor)?.name}</DialogTitle>
            </DialogHeader>
            <FabricHeaderEditor
              template={templates.find(t => t.id === showHeaderEditor)}
              onSave={(headerData) => handleSaveHeader(showHeaderEditor, headerData)}
              onCancel={() => setShowHeaderEditor(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {templates.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Keine Templates vorhanden.</p>
          <p className="text-sm">Erstellen Sie Ihr erstes Template.</p>
        </div>
      )}
    </div>
  );
};

export default LetterTemplateManager;