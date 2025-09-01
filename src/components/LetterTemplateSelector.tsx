import React, { useState, useEffect } from 'react';
import { FileText, Plus, Layout, Settings, Eye, User, Info } from 'lucide-react';
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
import LetterTemplateManager from '@/components/LetterTemplateManager';

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
  default_sender_id?: string;
  default_info_blocks?: string[];
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
  const [senderInfos, setSenderInfos] = useState<any[]>([]);
  const [infoBlocks, setInfoBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
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
          response_time_days: newTemplate.response_time_days,
          default_sender_id: newTemplate.default_sender_id || null,
          default_info_blocks: newTemplate.default_info_blocks.length > 0 ? newTemplate.default_info_blocks : null
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
        response_time_days: 21,
        default_sender_id: '',
        default_info_blocks: []
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
        <div className="flex space-x-2">
          <Dialog open={showTemplateManager} onOpenChange={setShowTemplateManager}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Templates verwalten
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Brief-Templates verwalten</DialogTitle>
              </DialogHeader>
              <LetterTemplateManager />
            </DialogContent>
          </Dialog>
          
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
              
              <div>
                <Label htmlFor="default-sender">Standard-Absenderinformation</Label>
                <Select value={newTemplate.default_sender_id || "none"} onValueChange={(value) => setNewTemplate(prev => ({ ...prev, default_sender_id: value === "none" ? "" : value }))}>
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
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {infoBlocks.map((block) => (
                    <div key={block.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`block-${block.id}`}
                        checked={newTemplate.default_info_blocks.includes(block.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewTemplate(prev => ({
                              ...prev,
                              default_info_blocks: [...prev.default_info_blocks, block.id]
                            }));
                          } else {
                            setNewTemplate(prev => ({
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Default Templates */}
        {defaultTemplates.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => {
              console.log('=== TEMPLATE CLICKED (DEFAULT) ===');
              console.log('Clicked template:', template);
              onSelect(template as any);
              console.log('=== onSelect called ===');
            }}
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
            onClick={() => {
              console.log('=== TEMPLATE CLICKED (CUSTOM) ===');
              console.log('Clicked template:', template);
              onSelect(template);
              console.log('=== onSelect called ===');
            }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {template.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
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
                <div className="flex flex-wrap gap-1">
                  {template.default_sender_id && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Absender
                    </Badge>
                  )}
                  {template.default_info_blocks && template.default_info_blocks.length > 0 && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      {template.default_info_blocks.length} Info-Blöcke
                    </Badge>
                  )}
                </div>
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