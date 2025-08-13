import React, { useState, useEffect, useRef } from 'react';
import { Save, X, Users, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_published: boolean;
  creator_name?: string;
}

interface KnowledgeDocumentEditorProps {
  document: KnowledgeDocument;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const KnowledgeDocumentEditor: React.FC<KnowledgeDocumentEditorProps> = ({
  document,
  isOpen,
  onClose,
  onSave
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editedDoc, setEditedDoc] = useState(document);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const categories = [
    { value: 'general', label: 'Allgemein' },
    { value: 'technical', label: 'Technisch' },
    { value: 'process', label: 'Prozesse' },
    { value: 'policy', label: 'Richtlinien' },
    { value: 'meeting', label: 'Besprechungen' }
  ];

  const canEdit = user?.id === document.created_by || document.is_published;

  useEffect(() => {
    setEditedDoc(document);
  }, [document]);

  // Auto-save functionality
  useEffect(() => {
    if (!canEdit) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (editedDoc.title !== document.title || 
          editedDoc.content !== document.content || 
          editedDoc.category !== document.category ||
          editedDoc.is_published !== document.is_published) {
        handleAutoSave();
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editedDoc, canEdit]);

  // Real-time collaboration setup
  useEffect(() => {
    if (!isOpen || !user) return;

    const channel = supabase.channel(`document-${document.id}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.keys(state).map(key => (state[key][0] as any)?.user_id).filter(id => id !== user.id);
        setActiveUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const userId = (newPresences[0] as any)?.user_id;
        if (userId && userId !== user.id) {
          setActiveUsers(prev => [...prev, userId]);
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        const userId = (leftPresences[0] as any)?.user_id;
        if (userId) {
          setActiveUsers(prev => prev.filter(id => id !== userId));
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'knowledge_documents',
        filter: `id=eq.${document.id}`
      }, (payload) => {
        if (payload.new.updated_at !== document.updated_at && payload.new.created_by !== user.id) {
          // Another user updated the document
          setEditedDoc(payload.new as KnowledgeDocument);
          toast({
            title: "Dokument aktualisiert",
            description: "Ein anderer Benutzer hat das Dokument bearbeitet.",
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, user, document.id]);

  const handleAutoSave = async () => {
    if (!canEdit) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('knowledge_documents')
        .update({
          title: editedDoc.title,
          content: editedDoc.content,
          category: editedDoc.category,
          is_published: editedDoc.is_published,
          updated_at: new Date().toISOString()
        })
        .eq('id', document.id);

      if (error) throw error;

      setLastSaved(new Date());
      onSave();
    } catch (error) {
      console.error('Error auto-saving document:', error);
      toast({
        title: "Fehler beim Speichern",
        description: "Das Dokument konnte nicht automatisch gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleManualSave = async () => {
    if (!canEdit) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('knowledge_documents')
        .update({
          title: editedDoc.title,
          content: editedDoc.content,
          category: editedDoc.category,
          is_published: editedDoc.is_published,
          updated_at: new Date().toISOString()
        })
        .eq('id', document.id);

      if (error) throw error;

      setLastSaved(new Date());
      onSave();
      toast({
        title: "Dokument gespeichert",
        description: "Ihre Änderungen wurden erfolgreich gespeichert.",
      });
    } catch (error) {
      console.error('Error saving document:', error);
      toast({
        title: "Fehler beim Speichern",
        description: "Das Dokument konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedChanges = editedDoc.title !== document.title || 
                          editedDoc.content !== document.content || 
                          editedDoc.category !== document.category ||
                          editedDoc.is_published !== document.is_published;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-none">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <span>Dokument bearbeiten</span>
              {activeUsers.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {activeUsers.length} weitere Benutzer
                </Badge>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {saving && (
                <Badge variant="outline" className="text-xs">
                  Speichert...
                </Badge>
              )}
              {lastSaved && (
                <Badge variant="outline" className="text-xs">
                  Gespeichert: {lastSaved.toLocaleTimeString('de-DE')}
                </Badge>
              )}
              {hasUnsavedChanges && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Ungespeichert
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {!canEdit && (
          <div className="bg-muted p-3 rounded-lg flex items-center gap-2 text-sm">
            <EyeOff className="h-4 w-4" />
            Sie haben nur Lesezugriff auf dieses Dokument.
          </div>
        )}

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={editedDoc.title}
                onChange={(e) => setEditedDoc(prev => ({ ...prev, title: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
            <div className="w-48">
              <Label htmlFor="category">Kategorie</Label>
              <Select 
                value={editedDoc.category} 
                onValueChange={(value) => setEditedDoc(prev => ({ ...prev, category: value }))}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="published"
              checked={editedDoc.is_published}
              onCheckedChange={(checked) => setEditedDoc(prev => ({ ...prev, is_published: checked }))}
              disabled={!canEdit}
            />
            <Label htmlFor="published" className="flex items-center gap-2">
              {editedDoc.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              Für alle sichtbar
            </Label>
          </div>

          <div className="flex-1 flex flex-col">
            <Label htmlFor="content">Inhalt</Label>
            <Textarea
              id="content"
              value={editedDoc.content}
              onChange={(e) => setEditedDoc(prev => ({ ...prev, content: e.target.value }))}
              className="flex-1 min-h-0 resize-none"
              placeholder="Geben Sie den Inhalt des Dokuments ein..."
              disabled={!canEdit}
            />
          </div>
        </div>

        <div className="flex-none flex justify-between pt-4">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Schließen
          </Button>
          {canEdit && (
            <Button onClick={handleManualSave} disabled={saving || !hasUnsavedChanges}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Speichert...' : 'Speichern'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KnowledgeDocumentEditor;