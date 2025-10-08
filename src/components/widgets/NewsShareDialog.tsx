import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, Send, Loader2 } from 'lucide-react';
import { MultiSelect } from '@/components/ui/multi-select';

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  link: string;
  source: string;
}

interface NewsShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article: NewsArticle | null;
}

interface UserProfile {
  user_id: string;
  display_name: string;
}

export const NewsShareDialog: React.FC<NewsShareDialogProps> = ({
  open,
  onOpenChange,
  article
}) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [externalEmails, setExternalEmails] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [sendViaMatrix, setSendViaMatrix] = useState(false);

  useEffect(() => {
    if (open) {
      loadUsers();
    }
  }, [open]);

  const loadUsers = async () => {
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

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .neq('user_id', user.id)
        .order('display_name');

      setUsers(profiles || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleShare = async () => {
    if (!article) return;
    
    const emails = externalEmails
      .split(',')
      .map(e => e.trim())
      .filter(e => e && e.includes('@'));

    if (selectedUserIds.length === 0 && emails.length === 0) {
      toast.error('Bitte wählen Sie mindestens einen Empfänger aus');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      const senderName = profile?.display_name || 'Ein Kollege';

      // Send emails
      if (selectedUserIds.length > 0 || emails.length > 0) {
        // Get email addresses for internal users
        const { data: userProfiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', selectedUserIds);

        const internalEmails: string[] = [];
        if (userProfiles) {
          for (const prof of userProfiles) {
            const { data: authUser } = await supabase.auth.admin.getUserById(prof.user_id);
            if (authUser.user?.email) {
              internalEmails.push(authUser.user.email);
            }
          }
        }

        const allEmails = [...internalEmails, ...emails];

        const { error: emailError } = await supabase.functions.invoke('send-news-email', {
          body: {
            article,
            recipients: allEmails,
            senderName,
            personalMessage: personalMessage || undefined
          }
        });

        if (emailError) throw emailError;
      }

      // Send via Matrix
      if (sendViaMatrix && selectedUserIds.length > 0) {
        const { error: matrixError } = await supabase.functions.invoke('send-news-matrix', {
          body: {
            article,
            recipientUserIds: selectedUserIds,
            senderName,
            personalMessage: personalMessage || undefined
          }
        });

        if (matrixError) throw matrixError;
      }

      const totalRecipients = selectedUserIds.length + emails.length;
      toast.success(`News erfolgreich an ${totalRecipients} Empfänger gesendet`);
      
      // Reset form
      setSelectedUserIds([]);
      setExternalEmails('');
      setPersonalMessage('');
      setSendViaMatrix(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Error sharing news:', error);
      toast.error('Fehler beim Versenden der News');
    } finally {
      setLoading(false);
    }
  };

  const userOptions = users.map(u => ({
    value: u.user_id,
    label: u.display_name || 'Unbekannt'
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            News teilen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Article Preview */}
          {article && (
            <div className="p-4 border rounded-lg bg-muted/30">
              <h4 className="font-semibold text-sm mb-1">{article.title}</h4>
              <p className="text-xs text-muted-foreground line-clamp-2">{article.description}</p>
              <p className="text-xs text-muted-foreground mt-2">Quelle: {article.source}</p>
            </div>
          )}

          {/* Internal Users */}
          <div className="space-y-2">
            <Label>Interne Empfänger</Label>
            <MultiSelect
              options={userOptions}
              selected={selectedUserIds}
              onChange={setSelectedUserIds}
              placeholder="Benutzer auswählen..."
            />
          </div>

          {/* External Emails */}
          <div className="space-y-2">
            <Label>Externe E-Mail-Adressen (kommagetrennt)</Label>
            <Input
              type="text"
              placeholder="max@example.com, anna@example.com"
              value={externalEmails}
              onChange={(e) => setExternalEmails(e.target.value)}
            />
          </div>

          {/* Matrix Toggle */}
          {selectedUserIds.length > 0 && (
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>Auch via Matrix senden</Label>
                <p className="text-xs text-muted-foreground">
                  Nur für interne Empfänger verfügbar
                </p>
              </div>
              <Switch
                checked={sendViaMatrix}
                onCheckedChange={setSendViaMatrix}
              />
            </div>
          )}

          {/* Personal Message */}
          <div className="space-y-2">
            <Label>Persönliche Nachricht (optional)</Label>
            <Textarea
              placeholder="Fügen Sie eine persönliche Nachricht hinzu..."
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleShare} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gesendet...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Senden
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
