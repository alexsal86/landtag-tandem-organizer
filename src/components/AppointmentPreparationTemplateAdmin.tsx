import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface Template {
  id: string;
  name: string;
  description: string;
  template_data: any[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

interface TemplateField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
  required: boolean;
}

interface TemplateSection {
  id: string;
  title: string;
  type: 'section' | 'checklist';
  fields?: TemplateField[];
  items?: Array<{ id: string; label: string; completed: boolean }>;
}

export default function AppointmentPreparationTemplateAdmin() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  useEffect(() => {
    if (currentTenant) {
      fetchTemplates();
    }
  }, [currentTenant]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('appointment_preparation_templates')
        .select('*')
        .eq('tenant_id', currentTenant?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data || []).map(template => ({
        ...template,
        template_data: Array.isArray(template.template_data) ? template.template_data : []
      })));
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Fehler',
        description: 'Templates konnten nicht geladen werden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (templateData: Partial<Template>) => {
    try {
      if (editingTemplate?.id) {
        // Update existing template
        const { error } = await supabase
          .from('appointment_preparation_templates')
          .update({
            name: templateData.name,
            description: templateData.description,
            template_data: templateData.template_data,
            is_default: templateData.is_default,
            is_active: templateData.is_active,
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;

        toast({
          title: 'Erfolg',
          description: 'Template wurde aktualisiert.',
        });
      } else {
        // Create new template
        const { error } = await supabase
          .from('appointment_preparation_templates')
          .insert({
            tenant_id: currentTenant?.id,
            name: templateData.name,
            description: templateData.description,
            template_data: templateData.template_data || [],
            is_default: templateData.is_default || false,
            is_active: true,
            created_by: (await supabase.auth.getUser()).data.user?.id,
          });

        if (error) throw error;

        toast({
          title: 'Erfolg',
          description: 'Template wurde erstellt.',
        });
      }

      setIsDialogOpen(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: 'Fehler',
        description: 'Template konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Sind Sie sicher, dass Sie dieses Template löschen möchten?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('appointment_preparation_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: 'Erfolg',
        description: 'Template wurde gelöscht.',
      });

      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Fehler',
        description: 'Template konnte nicht gelöscht werden.',
        variant: 'destructive',
      });
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      // First, remove default from all templates
      await supabase
        .from('appointment_preparation_templates')
        .update({ is_default: false })
        .eq('tenant_id', currentTenant?.id);

      // Then set the new default
      const { error } = await supabase
        .from('appointment_preparation_templates')
        .update({ is_default: true })
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: 'Erfolg',
        description: 'Standard-Template wurde gesetzt.',
      });

      fetchTemplates();
    } catch (error) {
      console.error('Error setting default template:', error);
      toast({
        title: 'Fehler',
        description: 'Standard-Template konnte nicht gesetzt werden.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Laden...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Terminvorbereitungs-Templates</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Templates für die Vorbereitung von Terminen und Auftritten.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingTemplate(null);
                setIsDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Neues Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Template bearbeiten' : 'Neues Template erstellen'}
              </DialogTitle>
              <DialogDescription>
                Konfigurieren Sie die Abschnitte und Felder für das Template.
              </DialogDescription>
            </DialogHeader>
            <TemplateEditor
              template={editingTemplate}
              onSave={handleSaveTemplate}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingTemplate(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {template.name}
                    {template.is_default && (
                      <Badge variant="secondary">Standard</Badge>
                    )}
                    {!template.is_active && (
                      <Badge variant="outline">Inaktiv</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {!template.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(template.id)}
                    >
                      Als Standard setzen
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingTemplate(template);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {template.template_data?.length || 0} Abschnitte konfiguriert
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface TemplateEditorProps {
  template: Template | null;
  onSave: (template: Partial<Template>) => void;
  onCancel: () => void;
}

function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [isDefault, setIsDefault] = useState(template?.is_default || false);
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [sections, setSections] = useState<TemplateSection[]>(
    template?.template_data || []
  );

  const addSection = () => {
    const newSection: TemplateSection = {
      id: `section_${Date.now()}`,
      title: 'Neuer Abschnitt',
      type: 'section',
      fields: [],
    };
    setSections([...sections, newSection]);
  };

  const updateSection = (index: number, updates: Partial<TemplateSection>) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], ...updates };
    setSections(newSections);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const addField = (sectionIndex: number) => {
    const newField: TemplateField = {
      id: `field_${Date.now()}`,
      label: 'Neues Feld',
      type: 'text',
      required: false,
    };
    
    const newSections = [...sections];
    if (!newSections[sectionIndex].fields) {
      newSections[sectionIndex].fields = [];
    }
    newSections[sectionIndex].fields!.push(newField);
    setSections(newSections);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      template_data: sections,
      is_default: isDefault,
      is_active: isActive,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Template Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Standard Terminvorbereitung"
          />
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="is_default"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
            <Label htmlFor="is_default">Standard-Template</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="is_active">Aktiv</Label>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Beschreibung</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Beschreibung des Templates..."
        />
      </div>

      <Separator />

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Template-Abschnitte</h3>
          <Button type="button" variant="outline" onClick={addSection}>
            <Plus className="h-4 w-4 mr-2" />
            Abschnitt hinzufügen
          </Button>
        </div>

        <div className="space-y-4">
          {sections.map((section, sectionIndex) => (
            <Card key={section.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Input
                    value={section.title}
                    onChange={(e) =>
                      updateSection(sectionIndex, { title: e.target.value })
                    }
                    className="text-lg font-semibold"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSection(sectionIndex)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {section.fields?.map((field, fieldIndex) => (
                    <div key={field.id} className="flex items-center gap-2 p-2 border rounded">
                      <Input
                        value={field.label}
                        onChange={(e) => {
                          const newSections = [...sections];
                          newSections[sectionIndex].fields![fieldIndex].label = e.target.value;
                          setSections(newSections);
                        }}
                        placeholder="Feldbezeichnung"
                        className="flex-1"
                      />
                      <Select
                        value={field.type}
                        onValueChange={(value: any) => {
                          const newSections = [...sections];
                          newSections[sectionIndex].fields![fieldIndex].type = value;
                          setSections(newSections);
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="textarea">Textarea</SelectItem>
                          <SelectItem value="select">Auswahl</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newSections = [...sections];
                          newSections[sectionIndex].fields = newSections[sectionIndex].fields!.filter(
                            (_, i) => i !== fieldIndex
                          );
                          setSections(newSections);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addField(sectionIndex)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Feld hinzufügen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="button" onClick={handleSubmit}>
          <Save className="h-4 w-4 mr-2" />
          Speichern
        </Button>
      </div>
    </div>
  );
}