import React, { useState, useEffect, useRef } from 'react';
import { Save, X, Users, Eye, EyeOff, AlertTriangle, Edit3, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor, type RichTextEditorRef } from './RichTextEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import FloatingTextToolbar from './FloatingTextToolbar';

interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  content_html?: string;
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
  const [editedDoc, setEditedDoc] = useState({
    ...document,
    content_html: document.content_html || '' // Add HTML content tracking
  });
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [userCursors, setUserCursors] = useState<Record<string, { position: number; name: string }>>({});
  const [selectedText, setSelectedText] = useState('');
  const [showToolbar, setShowToolbar] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const editorRef = useRef<HTMLDivElement>(null);
  const richTextEditorRef = useRef<RichTextEditorRef>(null);
  const channelRef = useRef<any>(null);
  const broadcastTimeoutRef = useRef<NodeJS.Timeout>();
  const isUpdatingFromRemoteRef = useRef(false);
  const lastLocalUpdateRef = useRef<string>('');

  const categories = [
    { value: 'general', label: 'Allgemein' },
    { value: 'technical', label: 'Technisch' },
    { value: 'process', label: 'Prozesse' },
    { value: 'policy', label: 'Richtlinien' },
    { value: 'meeting', label: 'Besprechungen' }
  ];

  const canEdit = user?.id === document.created_by || document.is_published;

  useEffect(() => {
    setEditedDoc({
      ...document,
      content_html: document.content_html || ''
    });
  }, [document]);

  // Auto-save functionality - optimized for smooth writing experience
  useEffect(() => {
    if (!canEdit || isUpdatingFromRemoteRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      // Only auto-save if this is not a remote update and content actually changed
      if (!isUpdatingFromRemoteRef.current && 
          (editedDoc.title !== document.title || 
           editedDoc.content !== document.content || 
           editedDoc.category !== document.category ||
           editedDoc.is_published !== document.is_published)) {
        handleAutoSave();
      }
    }, 800); // Faster auto-save for better UX

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
        const users = Object.keys(state).map(key => {
          const presence = (state[key][0] as any);
          return {
            userId: presence?.user_id,
            name: presence?.user_name,
            cursorPosition: presence?.cursor_position
          };
        }).filter(u => u.userId && u.userId !== user.id);
        
        setActiveUsers(users.map(u => u.userId));
        
        // Update cursor positions
        const cursors = users.reduce((acc, u) => {
          if (u.cursorPosition !== undefined) {
            acc[u.userId] = { position: u.cursorPosition, name: u.name || 'Unbekannt' };
          }
          return acc;
        }, {} as Record<string, { position: number; name: string }>);
        setUserCursors(cursors);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const presence = (newPresences[0] as any);
        const userId = presence?.user_id;
        if (userId && userId !== user.id) {
          setActiveUsers(prev => [...prev, userId]);
          if (presence?.cursor_position !== undefined) {
            setUserCursors(prev => ({
              ...prev,
              [userId]: { position: presence.cursor_position, name: presence.user_name || 'Unbekannt' }
            }));
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        const userId = (leftPresences[0] as any)?.user_id;
        if (userId) {
          setActiveUsers(prev => prev.filter(id => id !== userId));
          setUserCursors(prev => {
            const newCursors = { ...prev };
            delete newCursors[userId];
            return newCursors;
          });
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
          setEditedDoc({
            ...(payload.new as KnowledgeDocument),
            content_html: (payload.new as any).content_html || ''
          });
          
          toast({
            title: "Dokument aktualisiert",
            description: "Ein anderer Benutzer hat das Dokument bearbeitet.",
          });
        }
      })
      .on('broadcast', { event: 'cursor_move' }, (payload) => {
        const { user_id, cursor_position, user_name } = payload.payload;
        if (user_id !== user.id) {
          setUserCursors(prev => ({
            ...prev,
            [user_id]: { position: cursor_position, name: user_name || 'Unbekannt' }
          }));
        }
      })
      .on('broadcast', { event: 'content_change' }, (payload) => {
        const { user_id, value: content, content_html, title, category, is_published } = payload.payload;
        if (user_id !== user.id) {
          // Prevent update loop and auto-save by setting flag
          isUpdatingFromRemoteRef.current = true;
          
          // Clear any pending auto-save timeout to prevent saving remote changes
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          
          // Update content from another user
          setEditedDoc(prev => ({
            ...prev,
            content: content !== undefined ? content : prev.content,
            content_html: content_html !== undefined ? content_html : prev.content_html,
            title: title !== undefined ? title : prev.title,
            category: category !== undefined ? category : prev.category,
            is_published: is_published !== undefined ? is_published : prev.is_published
          }));
          
          console.log('KnowledgeDocumentEditor: Remote update received', { 
            content, 
            content_html, 
            title, 
            category, 
            is_published 
          });
          
          // Reset flag after a longer delay to ensure no interference
          setTimeout(() => {
            isUpdatingFromRemoteRef.current = false;
          }, 500);
          
          // Show subtle update notification
          toast({
            title: "Live-Update",
            description: `${payload.payload.user_name} bearbeitet gerade...`,
            duration: 1500,
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Get user name from profiles
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', user.id)
            .single();
          
          await channel.track({
            user_id: user.id,
            user_name: profile?.display_name || 'Unbekannt',
            online_at: new Date().toISOString(),
            cursor_position: 0
          });
        }
      });

    // Store channel reference for broadcasting functions
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, user, document.id]);

  // Handle selection changes for rich text editor
  const handleSelectionChange = () => {
    if (!canEdit) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const selectedText = selection.toString();
    setSelectedText(selectedText);
    setShowToolbar(selectedText.length > 0);
  };

  // Debounced broadcast content changes to other users including HTML formatting
  const broadcastContentChange = (field: string, value: string, htmlValue?: string) => {
    if (!channelRef.current || !user) {
      console.log('KnowledgeDocumentEditor: Cannot broadcast - no channel or user', { channel: !!channelRef.current, user: !!user });
      return;
    }
    
    // Clear previous broadcast timeout to debounce rapid changes
    if (broadcastTimeoutRef.current) {
      clearTimeout(broadcastTimeoutRef.current);
    }
    
    broadcastTimeoutRef.current = setTimeout(() => {
      const payload: any = {
        type: 'content_change',
        field,
        value,
        user_id: user.id,
        user_name: user.user_metadata?.display_name || 'Unbekannt',
        timestamp: new Date().toISOString()
      };

      if (htmlValue && field === 'content') {
        payload.content_html = htmlValue;
      }
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'content_change',
        payload
      });
    }, 500); // Increased debounce delay for smoother experience
  };

  // Format selected text using the RichTextEditor's formatSelection function
  const handleFormatText = (format: string) => {
    if (!selectedText || !richTextEditorRef.current) {
      console.log('KnowledgeDocumentEditor: Cannot format - no selection or editor ref');
      return;
    }
    
    console.log('KnowledgeDocumentEditor: Formatting text with format:', format);
    richTextEditorRef.current.formatSelection(format);
    
    // Hide toolbar and clear selection
    setShowToolbar(false);
    setSelectedText('');
  };

  const handleAutoSave = async () => {
    if (!canEdit || isUpdatingFromRemoteRef.current) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('knowledge_documents')
        .update({
          title: editedDoc.title,
          content: editedDoc.content,
          content_html: editedDoc.content_html,
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
        title: "Speicherfehler",
        description: "Automatisches Speichern fehlgeschlagen. Bitte manuell speichern.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      // Hide saving indicator quickly for smooth experience
      setTimeout(() => setSaving(false), 200);
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

  const hasUnsavedChanges = !isUpdatingFromRemoteRef.current && 
                           (editedDoc.title !== document.title || 
                            editedDoc.content !== document.content || 
                            editedDoc.category !== document.category ||
                            editedDoc.is_published !== document.is_published);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-none border-b bg-card/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div className="flex items-center gap-2">
              <span className="font-medium">Dokument bearbeiten</span>
              {activeUsers.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {activeUsers.length}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saving && (
              <Badge variant="outline" className="text-xs animate-pulse">
                •••
              </Badge>
            )}
            {lastSaved && !saving && (
              <Badge variant="outline" className="text-xs opacity-60">
                ✓ {lastSaved.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </Badge>
            )}
            {hasUnsavedChanges && !saving && (
              <Badge variant="outline" className="text-xs border-amber-200 text-amber-700">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Wird gespeichert...
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!canEdit && (
          <div className="bg-muted p-3 rounded-lg flex items-center gap-2 text-sm mt-3">
            <EyeOff className="h-4 w-4" />
            Sie haben nur Lesezugriff auf dieses Dokument.
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-full space-y-6">
          {/* Title */}
          <div>
            <Input
              value={editedDoc.title}
              onChange={(e) => {
                const newTitle = e.target.value;
                setEditedDoc(prev => ({ ...prev, title: newTitle }));
                broadcastContentChange('title', newTitle);
              }}
              disabled={!canEdit}
              className="text-2xl font-bold border-none px-0 focus-visible:ring-0 bg-transparent"
              placeholder="Untitled"
            />
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground border-b pb-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="category" className="text-xs font-medium">Kategorie:</Label>
              <Select 
                value={editedDoc.category} 
                onValueChange={(value) => setEditedDoc(prev => ({ ...prev, category: value }))}
                disabled={!canEdit}
              >
                <SelectTrigger className="h-7 w-auto text-xs">
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

            <div className="flex items-center space-x-2">
              <Switch
                id="published"
                checked={editedDoc.is_published}
                onCheckedChange={(checked) => setEditedDoc(prev => ({ ...prev, is_published: checked }))}
                disabled={!canEdit}
              />
              <Label htmlFor="published" className="flex items-center gap-1 text-xs">
                {editedDoc.is_published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                Öffentlich
              </Label>
            </div>
          </div>

          {/* Content Editor */}
          <div className="min-h-96 relative">
            <RichTextEditor
              ref={richTextEditorRef}
              value={editedDoc.content}
              onChange={(newContent, newHtml) => {
                // Only broadcast if this is not a remote update
                if (!isUpdatingFromRemoteRef.current) {
                  console.log('KnowledgeDocumentEditor: Local content change', { newContent, newHtml });
                  setEditedDoc(prev => ({ ...prev, content: newContent, content_html: newHtml || '' }));
                  lastLocalUpdateRef.current = newContent;
                  broadcastContentChange('content', newContent, newHtml);
                } else {
                  console.log('KnowledgeDocumentEditor: Skipping broadcast for remote update');
                }
              }}
              onSelectionChange={handleSelectionChange}
              disabled={!canEdit}
              className="min-h-96"
              placeholder="Beginnen Sie zu schreiben..."
            />
          </div>
        </div>
      </div>

      {/* Floating Text Toolbar */}
      <FloatingTextToolbar
        editorRef={editorRef}
        onFormatText={handleFormatText}
        isVisible={showToolbar}
        selectedText={selectedText}
      />

      {/* Footer */}
      {canEdit && (
        <div className="flex-none border-t p-4">
          <div className="flex justify-end">
            <Button onClick={handleManualSave} disabled={saving || !hasUnsavedChanges}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Speichert...' : 'Speichern'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeDocumentEditor;