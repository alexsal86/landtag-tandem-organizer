import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, RotateCcw, Eye, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface NewsEmailTemplate {
  id: string;
  subject: string;
  greeting: string;
  introduction: string;
  closing: string;
  signature: string;
}

export const NewsEmailTemplateManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<NewsEmailTemplate>({
    id: '',
    subject: 'News-Empfehlung',
    greeting: 'Hallo {recipient_name},',
    introduction: '{sender_name} möchte folgende News mit Ihnen teilen:',
    closing: 'Viel Spaß beim Lesen!',
    signature: 'Ihr Team'
  });
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberships } = await supabase
        .from('user_tenant_memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!memberships?.tenant_id) return;

      const { data, error } = await supabase
        .from('news_email_templates')
        .select('*')
        .eq('tenant_id', memberships.tenant_id)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setTemplate(data);
      }
    } catch (error) {
      console.error('Error loading template:', error);
      toast.error('Fehler beim Laden der Vorlage');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: memberships } = await supabase
        .from('user_tenant_memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!memberships?.tenant_id) throw new Error('No tenant found');

      if (template.id) {
        // Update existing
        const { error } = await supabase
          .from('news_email_templates')
          .update({
            subject: template.subject,
            greeting: template.greeting,
            introduction: template.introduction,
            closing: template.closing,
            signature: template.signature
          })
          .eq('id', template.id);

        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('news_email_templates')
          .insert({
            tenant_id: memberships.tenant_id,
            subject: template.subject,
            greeting: template.greeting,
            introduction: template.introduction,
            closing: template.closing,
            signature: template.signature
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setTemplate(data);
      }

      toast.success('Vorlage erfolgreich gespeichert');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Fehler beim Speichern der Vorlage');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTemplate({
      ...template,
      subject: 'News-Empfehlung',
      greeting: 'Hallo {recipient_name},',
      introduction: '{sender_name} möchte folgende News mit Ihnen teilen:',
      closing: 'Viel Spaß beim Lesen!',
      signature: 'Ihr Team'
    });
  };

  const renderPreview = () => {
    const sampleArticle = {
      title: 'Beispiel News-Artikel',
      description: 'Dies ist eine Beispielbeschreibung für einen News-Artikel, der geteilt werden könnte.',
      source: 'Beispielquelle',
      link: 'https://example.com'
    };

    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.6' }}>
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '30px', borderRadius: '8px 8px 0 0' }}>
          <h1 style={{ margin: 0, fontSize: '24px' }}>📰 {template.subject}</h1>
        </div>
        
        <div style={{ background: '#ffffff', padding: '30px', border: '1px solid #e5e5e5' }}>
          <p>{template.greeting.replace('{recipient_name}', 'Max Mustermann')}</p>
          <p>{template.introduction.replace('{sender_name}', 'Anna Schmidt')}</p>
          
          <div style={{ background: '#fff3cd', borderLeft: '4px solid #ffc107', padding: '15px', margin: '20px 0', borderRadius: '4px' }}>
            <strong>💬 Persönliche Nachricht von Anna Schmidt:</strong><br />
            Dies ist eine Beispiel-Nachricht, die der Absender hinzufügen kann.
          </div>
          
          <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', margin: '20px 0', borderLeft: '4px solid #667eea' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>{sampleArticle.title}</div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>{sampleArticle.description}</div>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '15px' }}>Quelle: {sampleArticle.source}</div>
            <a href={sampleArticle.link} style={{ display: 'inline-block', background: '#667eea', color: 'white', padding: '12px 30px', textDecoration: 'none', borderRadius: '6px', fontWeight: '500' }}>
              Artikel lesen →
            </a>
          </div>
          
          <p>{template.closing}</p>
          <p><strong>{template.signature}</strong></p>
        </div>
        
        <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '12px', borderTop: '1px solid #e5e5e5' }}>
          Empfohlen von Anna Schmidt
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            News E-Mail-Vorlagen
          </CardTitle>
          <CardDescription>
            Passen Sie die E-Mail-Vorlage für News-Empfehlungen an.
            Verwenden Sie <code className="bg-muted px-1 rounded">{'{recipient_name}'}</code> und <code className="bg-muted px-1 rounded">{'{sender_name}'}</code> als Platzhalter.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Betreff</Label>
            <Input
              value={template.subject}
              onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
              placeholder="Betreff der E-Mail"
            />
          </div>

          <div className="space-y-2">
            <Label>Begrüßung</Label>
            <Input
              value={template.greeting}
              onChange={(e) => setTemplate({ ...template, greeting: e.target.value })}
              placeholder="z.B. Hallo {recipient_name},"
            />
          </div>

          <div className="space-y-2">
            <Label>Einleitung</Label>
            <Textarea
              value={template.introduction}
              onChange={(e) => setTemplate({ ...template, introduction: e.target.value })}
              placeholder="z.B. {sender_name} möchte folgende News mit Ihnen teilen:"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Abschluss</Label>
            <Textarea
              value={template.closing}
              onChange={(e) => setTemplate({ ...template, closing: e.target.value })}
              placeholder="z.B. Viel Spaß beim Lesen!"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Signatur</Label>
            <Input
              value={template.signature}
              onChange={(e) => setTemplate({ ...template, signature: e.target.value })}
              placeholder="z.B. Ihr Team"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Wird gespeichert...' : 'Speichern'}
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Zurücksetzen
            </Button>
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="mr-2 h-4 w-4" />
              Vorschau
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>E-Mail-Vorschau</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg p-4 bg-muted/30">
            {renderPreview()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
