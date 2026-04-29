import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FileText, Download, Save, Archive, Plus } from 'lucide-react';
import { debugConsole } from '@/utils/debugConsole';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import jsPDF from 'jspdf';
import type { CheckedState } from '@radix-ui/react-checkbox';
import type {
  AppointmentPreparation,
  AppointmentPreparationTemplate,
  ChecklistItem,
  PreparationField,
  PreparationData,
  PreparationStatus,
  TemplateSection,
} from '@/types/appointmentPreparation';


interface AppointmentPreparationSidebarProps {
  appointmentId: string | null;
  appointmentTitle?: string;
  appointmentDate?: string;
  isOpen: boolean;
  onClose: () => void;
}

interface AppointmentPreparationRow {
  id: string;
  title: string;
  status: PreparationStatus;
  preparation_data: unknown;
  checklist_items: unknown;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  template_id: string | null;
}

interface AppointmentPreparationTemplateRow {
  id: string;
  name: string;
  description: string | null;
  template_data: unknown;
  is_default?: boolean;
  is_active: boolean;
  created_at: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseChecklistItem = (raw: unknown): ChecklistItem | null => {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || typeof raw.label !== 'string') return null;
  return {
    id: raw.id,
    label: raw.label,
    completed: raw.completed === true,
  };
};

const parseTemplateSections = (raw: unknown): ReadonlyArray<TemplateSection> => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry): TemplateSection | null => {
      if (!isRecord(entry) || typeof entry.type !== 'string' || typeof entry.title !== 'string') {
        return null;
      }

      if (entry.type === 'section') {
        const fields = Array.isArray(entry.fields)
          ? entry.fields
              .map((field): PreparationField | null => {
                if (
                  isRecord(field) &&
                  typeof field.id === 'string' &&
                  typeof field.label === 'string' &&
                  (field.type === 'text' || field.type === 'textarea' || field.type === 'select')
                ) {
                  return {
                    id: field.id,
                    label: field.label,
                    type: field.type,
                    options: Array.isArray(field.options)
                      ? field.options.filter((option): option is string => typeof option === 'string')
                      : undefined,
                  };
                }
                return null;
              })
              .filter((field): field is NonNullable<typeof field> => field !== null)
          : [];

        return { id: typeof entry.id === 'string' ? entry.id : undefined, title: entry.title, type: 'section', fields };
      }

      if (entry.type === 'checklist') {
        const items = Array.isArray(entry.items)
          ? entry.items
              .map((item) => {
                if (isRecord(item) && typeof item.id === 'string' && typeof item.label === 'string') {
                  return { id: item.id, label: item.label };
                }
                return null;
              })
              .filter((item): item is NonNullable<typeof item> => item !== null)
          : [];

        return { id: typeof entry.id === 'string' ? entry.id : undefined, title: entry.title, type: 'checklist', items };
      }

      return null;
    })
    .filter((section): section is TemplateSection => section !== null);
};

const normalizePreparationRow = (row: AppointmentPreparationRow): AppointmentPreparation => ({
  ...row,
  preparation_data: isRecord(row.preparation_data) ? (row.preparation_data as PreparationData) : {},
  checklist_items: Array.isArray(row.checklist_items)
    ? row.checklist_items.map(parseChecklistItem).filter((item): item is ChecklistItem => item !== null)
    : [],
});

const normalizeTemplateRow = (row: AppointmentPreparationTemplateRow): AppointmentPreparationTemplate => ({
  ...row,
  template_data: parseTemplateSections(row.template_data),
});

const isPreparationStatus = (value: string): value is PreparationStatus =>
  value === 'draft' || value === 'in_progress' || value === 'completed';

export default function AppointmentPreparationSidebar({
  appointmentId,
  appointmentTitle,
  appointmentDate,
  isOpen,
  onClose
}: AppointmentPreparationSidebarProps) {
  const [preparation, setPreparation] = useState<AppointmentPreparation | null>(null);
  const [templates, setTemplates] = useState<AppointmentPreparationTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const handleSheetOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen && appointmentId && currentTenant) {
      fetchPreparation();
      fetchTemplates();
    }
  }, [isOpen, appointmentId, currentTenant]);

  const fetchPreparation = async (): Promise<void> => {
    if (!appointmentId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointment_preparations')
        .select('*')
        .eq('appointment_id', appointmentId)
        .eq('is_archived', false)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setPreparation(normalizePreparationRow(data as AppointmentPreparationRow));
      }
    } catch (error) {
      debugConsole.error('Error fetching preparation:', error);
      toast({
        title: 'Fehler',
        description: 'Vorbereitung konnte nicht geladen werden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('appointment_preparation_templates')
        .select('*')
        .eq('tenant_id', currentTenant?.id ?? '')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTemplates(((data ?? []) as ReadonlyArray<AppointmentPreparationTemplateRow>).map(normalizeTemplateRow));
    } catch (error) {
      debugConsole.error('Error fetching templates:', error);
    }
  };

  const createPreparation = async (templateId?: string): Promise<void> => {
    if (!appointmentId || !currentTenant) return;

    try {
      // Get default template if none specified
      let selectedTemplate = templateId;
      if (!selectedTemplate) {
        const defaultTemplate = templates.find(t => t.is_default);
        selectedTemplate = defaultTemplate?.id;
      }

      const template = templates.find(t => t.id === selectedTemplate);
      const templateData = template?.template_data || [];

      // Initialize preparation data from template
      const preparationData: PreparationData = {};
      const checklistItems: ChecklistItem[] = [];

      templateData.forEach((section) => {
        if (section.type === 'section' && section.fields) {
          section.fields.forEach((field) => {
            preparationData[field.id] = '';
          });
        } else if (section.type === 'checklist' && section.items) {
          checklistItems.push(...section.items.map((item) => ({
            ...item,
            completed: false,
          })));
        }
      });

      const { data, error } = await supabase
        .from('appointment_preparations')
        .insert([{
          appointment_id: appointmentId!,
          template_id: selectedTemplate,
          tenant_id: currentTenant.id,
          created_by: (await supabase.auth.getUser()).data.user?.id ?? '',
          title: `Vorbereitung: ${appointmentTitle || 'Termin'}`,
          status: 'draft' as PreparationStatus,
          preparation_data: preparationData,
          checklist_items: checklistItems,
        }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setPreparation(normalizePreparationRow(data as AppointmentPreparationRow));
      }
      toast({
        title: 'Erfolg',
        description: 'Terminvorbereitung wurde erstellt.',
      });
    } catch (error) {
      debugConsole.error('Error creating preparation:', error);
      toast({
        title: 'Fehler',
        description: 'Vorbereitung konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    }
  };

  const savePreparation = async (): Promise<void> => {
    if (!preparation) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('appointment_preparations')
        .update({
          preparation_data: preparation.preparation_data,
          checklist_items: preparation.checklist_items,
          notes: preparation.notes,
          status: preparation.status,
        })
        .eq('id', preparation.id);

      if (error) throw error;

      toast({
        title: 'Erfolg',
        description: 'Vorbereitung wurde gespeichert.',
      });
    } catch (error) {
      debugConsole.error('Error saving preparation:', error);
      toast({
        title: 'Fehler',
        description: 'Vorbereitung konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePreparationData = (fieldId: string, value: string): void => {
    if (!preparation) return;

    setPreparation({
      ...preparation,
      preparation_data: {
        ...preparation.preparation_data,
        [fieldId]: value,
      },
    });
  };

  const updateChecklistItem = (itemId: string, completed: boolean): void => {
    if (!preparation) return;

    setPreparation({
      ...preparation,
      checklist_items: preparation.checklist_items.map(item =>
        item.id === itemId ? { ...item, completed } : item
      ),
    });
  };

  const handleExportPDF = async (): Promise<void> => {
    if (!preparation) return;

    try {
      // Simple text-based PDF export
      const pdf = new jsPDF('p', 'mm', 'a4');
      const template = templates.find(t => t.id === preparation.template_id);
      
      let yPosition = 20;
      const lineHeight = 7;
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginLeft = 20;
      const pageWidth = pdf.internal.pageSize.getWidth() - 40;

      // Helper function to add text with word wrapping
      const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
        pdf.setFontSize(fontSize);
        if (isBold) {
          pdf.setFont('helvetica', 'bold');
        } else {
          pdf.setFont('helvetica', 'normal');
        }
        
        const lines = pdf.splitTextToSize(text, pageWidth);
        
        lines.forEach((line: string) => {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = 20;
          }
          pdf.text(line, marginLeft, yPosition);
          yPosition += lineHeight;
        });
        
        yPosition += 3; // Extra spacing after text block
      };

      // Title
      addText(preparation.title, 20, true);
      yPosition += 5;

      // Basic info
      addText(`Termin: ${appointmentTitle || 'Unbenannt'}`, 12, true);
      if (appointmentDate) {
        addText(`Datum: ${format(new Date(appointmentDate), 'dd.MM.yyyy HH:mm', { locale: de })}`);
      }
      addText(`Status: ${preparation.status === 'completed' ? 'Abgeschlossen' : 'In Bearbeitung'}`);
      addText(`Erstellt: ${format(new Date(preparation.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}`);
      yPosition += 10;

      // Template sections
      template?.template_data.forEach((section) => {
        if (section.type === 'section' && section.fields) {
          addText(section.title, 16, true);
          
          section.fields.forEach((field) => {
            const value = preparation.preparation_data[field.id] || '';
            if (value) {
              addText(`${field.label}: ${value}`);
            }
          });
          yPosition += 5;
        }
        
        if (section.type === 'checklist') {
          const completedItems = preparation.checklist_items.filter((item) => item.completed);
          const totalItems = preparation.checklist_items.length;
          
          addText(`${section.title} (${completedItems.length}/${totalItems})`, 16, true);
          
          preparation.checklist_items.forEach((item) => {
            const status = item.completed ? '✓' : '☐';
            addText(`${status} ${item.label}`);
          });
          yPosition += 5;
        }
      });

      // Notes
      if (preparation.notes) {
        addText('Notizen', 16, true);
        addText(preparation.notes);
      }

      // Download PDF
      const filename = `Terminvorbereitung_${appointmentTitle?.replace(/[^a-zA-Z0-9]/g, '_') || 'Termin'}_${format(new Date(), 'yyyy-MM-dd', { locale: de })}.pdf`;
      pdf.save(filename);

      toast({
        title: 'Erfolg',
        description: 'PDF wurde erfolgreich erstellt und heruntergeladen.',
      });
    } catch (error) {
      debugConsole.error('Error generating PDF:', error);
      toast({
        title: 'Fehler',
        description: 'PDF konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Sheet open={isOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="sm:max-w-2xl">
          <div className="flex justify-center items-center h-full">
            <div>Laden...</div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Terminvorbereitung
          </SheetTitle>
          <SheetDescription>
            {appointmentTitle && (
              <div>
                <strong>{appointmentTitle}</strong>
                {appointmentDate && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {format(new Date(appointmentDate), 'dd.MM.yyyy HH:mm', { locale: de })}
                  </div>
                )}
              </div>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {!preparation ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Für diesen Termin wurde noch keine Vorbereitung erstellt.
              </p>
              <div className="space-y-2">
                <Button onClick={() => createPreparation()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Vorbereitung erstellen
                </Button>
                {templates.length > 1 && (
                  <div className="text-sm text-muted-foreground">
                    oder wählen Sie ein spezifisches Template:
                  </div>
                )}
                {templates.length > 1 && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {templates.map((template) => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        onClick={() => createPreparation(template.id)}
                      >
                        {template.name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header with status and actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={preparation.status === 'completed' ? 'default' : 'secondary'}>
                    {preparation.status === 'completed' ? 'Abgeschlossen' : 'In Bearbeitung'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Erstellt: {format(new Date(preparation.created_at), 'dd.MM.yyyy', { locale: de })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportPDF}>
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button size="sm" onClick={savePreparation} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Speichern...' : 'Speichern'}
                  </Button>
                </div>
              </div>

              {/* Render template sections */}
              {templates.find((t) => t.id === preparation.template_id)?.template_data.map((section, index: number) => (
                <Card key={section.id || index}>
                  <CardHeader>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {section.type === 'section' && section.fields?.map((field) => (
                      <div key={field.id}>
                        <Label htmlFor={field.id}>{field.label}</Label>
                        {field.type === 'text' && (
                          <Input
                            id={field.id}
                            value={preparation.preparation_data[field.id] || ''}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => updatePreparationData(field.id, event.target.value)}
                          />
                        )}
                        {field.type === 'textarea' && (
                          <Textarea
                            id={field.id}
                            value={preparation.preparation_data[field.id] || ''}
                            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updatePreparationData(field.id, event.target.value)}
                            rows={3}
                          />
                        )}
                        {field.type === 'select' && (
                          <Select
                            value={preparation.preparation_data[field.id] || ''}
                            onValueChange={(value) => updatePreparationData(field.id, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Bitte wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options?.map((option: string) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ))}

                    {section.type === 'checklist' && (
                      <div className="space-y-2">
                        {preparation.checklist_items.map((item) => (
                          <div key={item.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={item.id}
                              checked={item.completed}
                              onCheckedChange={(checked: CheckedState) => 
                                updateChecklistItem(item.id, checked === true)
                              }
                            />
                            <Label
                              htmlFor={item.id}
                              className={item.completed ? 'line-through text-muted-foreground' : ''}
                            >
                              {item.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* Notes section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notizen</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={preparation.notes || ''}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPreparation({ ...preparation, notes: event.target.value })}
                    placeholder="Zusätzliche Notizen..."
                    rows={4}
                  />
                </CardContent>
              </Card>

              {/* Status control */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={preparation.status}
                    onValueChange={(value: string) => {
                      if (isPreparationStatus(value)) {
                        setPreparation({ ...preparation, status: value });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Entwurf</SelectItem>
                      <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                      <SelectItem value="completed">Abgeschlossen</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
