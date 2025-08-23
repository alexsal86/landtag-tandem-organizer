import React, { useState, useEffect, useRef } from 'react';
import { Plus, Save, Trash2, Pin, Tag, Palette, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface QuickNote {
  id: string;
  title?: string;
  content: string;
  category: string;
  color: string;
  is_pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface QuickNotesWidgetProps {
  className?: string;
  configuration?: {
    autoSave?: boolean;
    compact?: boolean;
    theme?: string;
  };
}

export const QuickNotesWidget: React.FC<QuickNotesWidgetProps> = ({ 
  className, 
  configuration = {} 
}) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout>();

  const { autoSave = true, compact = false } = configuration;

  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
    '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
  ];

  useEffect(() => {
    if (user) {
      loadNotes();
    }
  }, [user]);

  useEffect(() => {
    if (autoSave && editingNote) {
      // Clear existing timeout
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
      
      // Set new timeout for auto-save
      autoSaveRef.current = setTimeout(() => {
        handleSaveEdit();
      }, 2000);
    }

    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, [newNote, newTitle, editingNote, autoSave]);

  const loadNotes = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quick_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error loading notes:', error);
      toast.error('Fehler beim Laden der Notizen');
    } finally {
      setLoading(false);
    }
  };

  const createNote = async () => {
    if (!user || !newNote.trim()) return;

    try {
      const { data, error } = await supabase
        .from('quick_notes')
        .insert({
          user_id: user.id,
          title: newTitle.trim() || undefined,
          content: newNote.trim(),
          color: selectedColor,
          category: 'general'
        })
        .select()
        .single();

      if (error) throw error;

      setNotes(prev => [data, ...prev]);
      setNewNote('');
      setNewTitle('');
      toast.success('Notiz erstellt');
    } catch (error) {
      console.error('Error creating note:', error);
      toast.error('Fehler beim Erstellen der Notiz');
    }
  };

  const updateNote = async (id: string, updates: Partial<QuickNote>) => {
    try {
      const { error } = await supabase
        .from('quick_notes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setNotes(prev => prev.map(note => 
        note.id === id ? { ...note, ...updates } : note
      ));
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Fehler beim Aktualisieren der Notiz');
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const { error } = await supabase
        .from('quick_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotes(prev => prev.filter(note => note.id !== id));
      toast.success('Notiz gelöscht');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Fehler beim Löschen der Notiz');
    }
  };

  const togglePin = (id: string, currentPinned: boolean) => {
    updateNote(id, { is_pinned: !currentPinned });
  };

  const handleSaveEdit = () => {
    if (editingNote && newNote.trim()) {
      updateNote(editingNote, { 
        content: newNote.trim(),
        title: newTitle.trim() || undefined
      });
      setEditingNote(null);
      setNewNote('');
      setNewTitle('');
    }
  };

  const startEdit = (note: QuickNote) => {
    setEditingNote(note.id);
    setNewNote(note.content);
    setNewTitle(note.title || '');
    setSelectedColor(note.color);
  };

  const filteredNotes = notes.filter(note =>
    note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (note.title && note.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Quick Notes</CardTitle>
          <div className="flex items-center gap-2">
            {!compact && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-7 w-24 pl-7 text-xs"
                />
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editingNote ? handleSaveEdit() : createNote()}
              disabled={!newNote.trim()}
              className="h-7 w-7 p-0"
            >
              {editingNote ? <Save className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 overflow-auto">
        {/* Create/Edit Form */}
        <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
          {!compact && (
            <Input
              placeholder="Titel (optional)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="h-8 text-xs"
            />
          )}
          <Textarea
            placeholder="Neue Notiz..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="min-h-[60px] text-xs resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                editingNote ? handleSaveEdit() : createNote();
              }
            }}
          />
          
          {!compact && (
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {colors.map(color => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-4 h-4 rounded-full border-2 ${
                      selectedColor === color ? 'border-foreground' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              
              {editingNote && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingNote(null);
                    setNewNote('');
                    setNewTitle('');
                  }}
                  className="h-6 px-2 text-xs"
                >
                  Abbrechen
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Notes List */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              Laden...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              {searchTerm ? 'Keine Notizen gefunden' : 'Noch keine Notizen vorhanden'}
            </div>
          ) : (
            filteredNotes.map(note => (
              <div
                key={note.id}
                className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                style={{ borderLeftColor: note.color, borderLeftWidth: '3px' }}
                onClick={() => !editingNote && startEdit(note)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {note.title && (
                      <h4 className="font-medium text-sm truncate mb-1">
                        {note.title}
                      </h4>
                    )}
                    <p className={`text-xs text-muted-foreground ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
                      {note.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.updated_at).toLocaleDateString()}
                      </span>
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex gap-1">
                          {note.tags.slice(0, 2).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(note.id, note.is_pinned);
                      }}
                      className={`h-6 w-6 p-0 ${note.is_pinned ? 'text-amber-500' : ''}`}
                    >
                      <Pin className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNote(note.id);
                      }}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};