import React, { useState, useEffect } from 'react';
import { FileText, Plus, Layout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

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
}

interface LetterTemplateSelectorProps {
  onSelect: (template: LetterTemplate | null) => void;
  selectedTemplate?: LetterTemplate | null;
}

const LetterTemplateSelector: React.FC<LetterTemplateSelectorProps> = ({
  onSelect,
  selectedTemplate
}) => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    letterhead_html: '',
    letterhead_css: '',
    response_time_days: 21
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

  const handleCreateTemplate = async () => {
    if (!currentTenant || !user || !newTemplate.name.trim()) return;

    try {
      const { error } = await supabase
        .from('letter_templates')
        .insert({
          tenant_id: currentTenant.id,
          created_by: user.id,
          name: newTemplate.name.trim(),
          letterhead_html: newTemplate.letterhead_html,
          letterhead_css: newTemplate.letterhead_css,
          response_time_days: newTemplate.response_time_days
        });

      if (error) throw error;

      toast({
        title: "Template erstellt",
        description: "Das neue Template wurde erfolgreich erstellt.",
      });

      setShowCreateDialog(false);
      setNewTemplate({
        name: '',
        letterhead_html: '',
        letterhead_css: '',
        response_time_days: 21
      });
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

  const defaultTemplates = [
    {
      id: 'blank',
      name: 'Leerer Brief',
      description: 'Beginnen Sie mit einem leeren Brief',
      letterhead_html: '',
      letterhead_css: '',
      response_time_days: 21
    },
    {
      id: 'formal',
      name: 'Offizieller Brief',
      description: 'Formaler Briefkopf für offizielle Korrespondenz',
      letterhead_html: `
        <div class="letterhead">
          <div class="sender-info">
            <h1>Ihr Name</h1>
            <p>Ihre Position</p>
            <p>Adresse • Telefon • E-Mail</p>
          </div>
        </div>
      `,
      letterhead_css: `
        .letterhead {
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .sender-info h1 {
          margin: 0;
          font-size: 24px;
          color: #333;
        }
        .sender-info p {
          margin: 5px 0;
          color: #666;
        }
      `,
      response_time_days: 21
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Brief-Template auswählen</h3>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Template erstellen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Neues Brief-Template erstellen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Template-Name eingeben..."
                />
              </div>
              
              <div>
                <Label htmlFor="letterhead-html">Briefkopf HTML</Label>
                <Textarea
                  id="letterhead-html"
                  value={newTemplate.letterhead_html}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, letterhead_html: e.target.value }))}
                  placeholder="HTML für den Briefkopf..."
                  rows={4}
                />
              </div>
              
              <div>
                <Label htmlFor="letterhead-css">Briefkopf CSS</Label>
                <Textarea
                  id="letterhead-css"
                  value={newTemplate.letterhead_css}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, letterhead_css: e.target.value }))}
                  placeholder="CSS-Stile für den Briefkopf..."
                  rows={4}
                />
              </div>
              
              <div>
                <Label htmlFor="response-time">Antwortzeit (Tage)</Label>
                <Input
                  id="response-time"
                  type="number"
                  value={newTemplate.response_time_days}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, response_time_days: parseInt(e.target.value) || 21 }))}
                  min="1"
                  max="365"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Default Templates */}
        {defaultTemplates.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onSelect(template as any)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layout className="h-4 w-4" />
                {template.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
              <Badge variant="secondary" className="text-xs">
                Standard
              </Badge>
            </CardContent>
          </Card>
        ))}

        {/* Custom Templates */}
        {templates.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onSelect(template)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {template.name}
              </CardTitle>
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

      {templates.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          <Layout className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Keine benutzerdefinierten Templates vorhanden.</p>
          <p className="text-sm">Erstellen Sie Ihr erstes Template oder wählen Sie ein Standard-Template.</p>
        </div>
      )}
    </div>
  );
};

export default LetterTemplateSelector;