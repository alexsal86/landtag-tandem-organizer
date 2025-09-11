import React, { useState, useEffect } from 'react';
import { FileText, Plus, Edit, Trash2, Settings, Image as ImageIcon, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

interface LetterTemplate {
  id: string;
  name: string;
  letterhead_html: string;
  letterhead_css: string;
  response_time_days: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  header_image_url?: string;
  header_image_position?: any;
  header_text_elements?: any[];
  header_layout_type?: string;
}

interface LetterTemplateIntegrationProps {
  selectedTemplateId?: string;
  onTemplateSelect: (template: LetterTemplate | null) => void;
  showManagement?: boolean;
}

export const LetterTemplateIntegration: React.FC<LetterTemplateIntegrationProps> = ({
  selectedTemplateId,
  onTemplateSelect,
  showManagement = false
}) => {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LetterTemplate | null>(null);
  const [showHeaderEditor, setShowHeaderEditor] = useState(false);
  const [showFooterEditor, setShowFooterEditor] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    letterhead_html: '',
    letterhead_css: '',
    response_time_days: 21,
    is_default: false,
    is_active: true
  });

  useEffect(() => {
    if (currentTenant) {
      fetchTemplates();
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
        .order('name');

      if (error) throw error;
      // Cast the data to ensure proper typing
      const typedTemplates = (data || []).map(template => ({
        ...template,
        header_text_elements: Array.isArray(template.header_text_elements) 
          ? template.header_text_elements 
          : []
      })) as LetterTemplate[];
      setTemplates(typedTemplates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Fehler",
        description: "Vorlagen konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template: LetterTemplate) => {
    onTemplateSelect(template);
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      letterhead_html: '',
      letterhead_css: '',
      response_time_days: 21,
      is_default: false,
      is_active: true
    });
    setIsDialogOpen(true);
  };

  const handleEditTemplate = (template: LetterTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      letterhead_html: template.letterhead_html,
      letterhead_css: template.letterhead_css,
      response_time_days: template.response_time_days,
      is_default: template.is_default,
      is_active: template.is_active
    });
    setIsDialogOpen(true);
  };

  const handleEditHeader = (template: LetterTemplate) => {
    setEditingTemplate(template);
    setShowHeaderEditor(true);
  };

  const handleEditFooter = (template: LetterTemplate) => {
    setEditingTemplate(template);
    setShowFooterEditor(true);
  };

  const handleSaveHeader = async (headerData: any) => {
    if (!editingTemplate || !currentTenant) return;

    try {
      const { error } = await supabase
        .from('letter_templates')
        .update(headerData)
        .eq('id', editingTemplate.id);

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "Header wurde aktualisiert.",
      });

      setShowHeaderEditor(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving header:', error);
      toast({
        title: "Fehler",
        description: "Header konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const handleSaveFooter = async (footerData: any) => {
    if (!editingTemplate || !currentTenant) return;

    try {
      const { error } = await supabase
        .from('letter_templates')
        .update(footerData)
        .eq('id', editingTemplate.id);

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "Footer wurde aktualisiert.",
      });

      setShowFooterEditor(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving footer:', error);
      toast({
        title: "Fehler",
        description: "Footer konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const handleSaveTemplate = async () => {
    if (!currentTenant || !formData.name.trim()) {
      toast({
        title: "Fehler",
        description: "Name ist erforderlich.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingTemplate) {
        // Update existing template
        const { error } = await supabase
          .from('letter_templates')
          .update({
            name: formData.name,
            letterhead_html: formData.letterhead_html,
            letterhead_css: formData.letterhead_css,
            response_time_days: formData.response_time_days,
            is_default: formData.is_default,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;

        toast({
          title: "Erfolg",
          description: "Vorlage wurde aktualisiert.",
        });
      } else {
        // Create new template
        const { error } = await supabase
          .from('letter_templates')
          .insert({
            tenant_id: currentTenant.id,
            created_by: (await supabase.auth.getUser()).data.user?.id,
            name: formData.name,
            letterhead_html: formData.letterhead_html,
            letterhead_css: formData.letterhead_css,
            response_time_days: formData.response_time_days,
            is_default: formData.is_default,
            is_active: formData.is_active
          });

        if (error) throw error;

        toast({
          title: "Erfolg",
          description: "Vorlage wurde erstellt.",
        });
      }

      setIsDialogOpen(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Fehler",
        description: "Vorlage konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Möchten Sie diese Vorlage wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('letter_templates')
        .update({ is_active: false })
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "Vorlage wurde gelöscht.",
      });

      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Fehler",
        description: "Vorlage konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Vorlagen werden geladen...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Template Selector */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Brief-Vorlage
          </CardTitle>
          {showManagement && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleCreateTemplate}>
                  <Plus className="h-3 w-3 mr-1" />
                  Neue Vorlage
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-name">Name</Label>
                    <Input
                      id="template-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Vorlagenname..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="letterhead-html">Briefkopf HTML</Label>
                    <Textarea
                      id="letterhead-html"
                      value={formData.letterhead_html}
                      onChange={(e) => setFormData({ ...formData, letterhead_html: e.target.value })}
                      placeholder="HTML-Code für den Briefkopf..."
                      rows={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="letterhead-css">Briefkopf CSS</Label>
                    <Textarea
                      id="letterhead-css"
                      value={formData.letterhead_css}
                      onChange={(e) => setFormData({ ...formData, letterhead_css: e.target.value })}
                      placeholder="CSS-Styles für den Briefkopf..."
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="response-time">Antwortzeit (Tage)</Label>
                      <Input
                        id="response-time"
                        type="number"
                        value={formData.response_time_days}
                        onChange={(e) => setFormData({ ...formData, response_time_days: parseInt(e.target.value) || 21 })}
                        min="1"
                        max="365"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="is-default"
                          checked={formData.is_default}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                        />
                        <Label htmlFor="is-default">Standard-Vorlage</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="is-active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                        <Label htmlFor="is-active">Aktiv</Label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Abbrechen
                    </Button>
                    <Button onClick={handleSaveTemplate}>
                      {editingTemplate ? 'Aktualisieren' : 'Erstellen'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Keine Vorlagen verfügbar</p>
              {showManagement && (
                <Button variant="outline" className="mt-2" onClick={handleCreateTemplate}>
                  Erste Vorlage erstellen
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {/* No Template Option */}
              <div
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  !selectedTemplateId 
                    ? 'bg-primary/10 border-primary' 
                    : 'hover:bg-muted'
                }`}
                onClick={() => onTemplateSelect(null)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Keine Vorlage</div>
                    <div className="text-sm text-muted-foreground">
                      Brief ohne vordefinierte Vorlage erstellen
                    </div>
                  </div>
                  {!selectedTemplateId && (
                    <Badge variant="secondary">Ausgewählt</Badge>
                  )}
                </div>
              </div>

              {/* Template Options */}
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedTemplateId === template.id 
                      ? 'bg-primary/10 border-primary' 
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{template.name}</div>
                        {template.is_default && (
                          <Badge variant="secondary">Standard</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Antwortzeit: {template.response_time_days} Tage
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedTemplateId === template.id && (
                        <Badge variant="secondary">Ausgewählt</Badge>
                      )}
                      
                      {showManagement && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditHeader(template)}
                            title="Header bearbeiten"
                          >
                            <ImageIcon className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditFooter(template)}
                            title="Footer bearbeiten"
                          >
                            <Type className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Header Editor Dialog */}
      {showHeaderEditor && editingTemplate && (
        <Dialog open={showHeaderEditor} onOpenChange={setShowHeaderEditor}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
            {/* FabricHeaderEditor removed */}
            <div className="p-4 text-muted-foreground">Header editor currently unavailable</div>
          </DialogContent>
        </Dialog>
      )}

      {/* Footer Editor Dialog */}
      {showFooterEditor && editingTemplate && (
        <Dialog open={showFooterEditor} onOpenChange={setShowFooterEditor}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
            {/* FabricFooterEditor removed */}
            <div className="p-4 text-muted-foreground">Footer editor currently unavailable</div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};