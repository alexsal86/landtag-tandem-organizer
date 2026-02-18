import React, { useState, useEffect } from 'react';
import { Search, Plus, FileText, Filter, Calendar, User, Edit3, Trash2, Grid, List, ListTodo, ListTree, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { useViewPreference } from '@/hooks/useViewPreference';
import LetterEditor from './LetterEditor';
import { LetterWizard } from './letters/LetterWizard';
import LetterPDFExport from './LetterPDFExport';

interface Letter {
  id?: string;
  title: string;
  content: string;
  content_html?: string;
  recipient_name?: string;
  recipient_address?: string;
  contact_id?: string;
  template_id?: string;
  sender_info_id?: string;
  information_block_ids?: string[];
  status: 'draft' | 'review' | 'approved' | 'sent';
  sent_date?: string;
  sent_method?: string;
  expected_response_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  user_id?: string;
  archived_at?: string | null;
}

interface ParentTaskOption {
  id: string;
  title: string;
}

const LettersView: React.FC = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { viewType, setViewType } = useViewPreference({ key: 'letters' });
  
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [taskDialogMode, setTaskDialogMode] = useState<'task' | 'subtask' | null>(null);
  const [sourceLetterForTask, setSourceLetterForTask] = useState<Letter | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [parentTaskId, setParentTaskId] = useState<string>('none');
  const [availableParentTasks, setAvailableParentTasks] = useState<ParentTaskOption[]>([]);
  const [isCreatingTask, setIsCreatingTask] = useState(false);


  useEffect(() => {
    if (currentTenant) {
      fetchLetters();
    }
  }, [currentTenant]);

  const fetchLetters = async () => {
    if (!currentTenant) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('letters')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setLetters(data as any || []);
    } catch (error) {
      console.error('Error fetching letters:', error);
      toast({
        title: "Fehler",
        description: "Briefe konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLetters = letters.filter(letter => {
    const matchesSearch = 
      letter.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      letter.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      letter.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || letter.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleNewLetter = () => {
    setSelectedLetter(null);
    setShowWizard(true);
  };

  const handleWizardComplete = (config: {
    occasion: string;
    recipientName: string;
    recipientAddress: string;
    contactId?: string;
    templateId?: string;
    senderInfoId?: string;
  }) => {
    setShowWizard(false);
    
    const newLetter: any = {
      id: undefined,
      title: '',
      content: '',
      content_html: '',
      status: 'draft',
      template_id: config.templateId,
      sender_info_id: config.senderInfoId,
      information_block_ids: [],
      tenant_id: currentTenant?.id || '',
      user_id: user?.id || '',
      created_by: user?.id || '',
      created_at: '',
      updated_at: '',
      recipient_name: config.recipientName,
      recipient_address: config.recipientAddress,
      contact_id: config.contactId,
      archived_at: null
    };
    
    setSelectedLetter(newLetter);
    setIsEditorOpen(true);
  };

  const handleEditLetter = (letter: Letter) => {
    setSelectedLetter(letter);
    setIsEditorOpen(true);
  };

  const openTaskDialog = async (letter: Letter, mode: 'task' | 'subtask') => {
    setSourceLetterForTask(letter);
    setTaskDialogMode(mode);
    const initialTitle = letter.title?.trim() || `Aufgabe aus Brief vom ${new Date(letter.updated_at).toLocaleDateString('de-DE')}`;
    setTaskTitle(initialTitle);
    setTaskDescription(letter.content?.trim() || '');
    setParentTaskId('none');

    if (mode === 'subtask' && currentTenant) {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('id, title')
          .eq('tenant_id', currentTenant.id)
          .is('parent_task_id', null)
          .order('updated_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        setAvailableParentTasks((data || []) as ParentTaskOption[]);
      } catch (error) {
        console.error('Error fetching parent tasks:', error);
        setAvailableParentTasks([]);
        toast({
          title: 'Fehler',
          description: 'Übergeordnete Aufgaben konnten nicht geladen werden.',
          variant: 'destructive',
        });
      }
    } else {
      setAvailableParentTasks([]);
    }
  };

  const closeTaskDialog = () => {
    setTaskDialogMode(null);
    setSourceLetterForTask(null);
    setTaskTitle('');
    setTaskDescription('');
    setParentTaskId('none');
    setAvailableParentTasks([]);
  };

  const createTaskFromLetter = async () => {
    if (!user || !currentTenant || !taskDialogMode || !sourceLetterForTask) return;
    if (!taskTitle.trim()) {
      toast({
        title: 'Titel fehlt',
        description: 'Bitte einen Titel für die Aufgabe eingeben.',
        variant: 'destructive',
      });
      return;
    }

    if (taskDialogMode === 'subtask' && parentTaskId === 'none') {
      toast({
        title: 'Übergeordnete Aufgabe fehlt',
        description: 'Bitte wählen Sie eine Aufgabe für die Unteraufgabe aus.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingTask(true);
    const letterReference = sourceLetterForTask.title ? `Brief: ${sourceLetterForTask.title}` : 'Brief';

    try {
      if (taskDialogMode === 'task') {
        const { error } = await supabase.from('tasks').insert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          title: taskTitle.trim(),
          description: sourceLetterForTask.id
            ? [taskDescription.trim(), `[[letter:${sourceLetterForTask.id}]]`].filter(Boolean).join('\n\n')
            : [taskDescription.trim(), `Quelle: ${letterReference}`].filter(Boolean).join('\n\n'),
          status: 'todo',
          priority: 'medium',
          category: 'personal',
        });

        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks').insert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          parent_task_id: parentTaskId,
          title: sourceLetterForTask.id
            ? `${taskTitle.trim()} [[letter:${sourceLetterForTask.id}]]`
            : [taskTitle.trim(), `Quelle: ${letterReference}`].filter(Boolean).join(' · '),
          description: taskDescription.trim() || null,
          status: 'todo',
          priority: 'medium',
          category: 'personal',
          assigned_to: user.id,
        });

        if (error) throw error;
      }

      toast({
        title: taskDialogMode === 'task' ? 'Aufgabe erstellt' : 'Unteraufgabe erstellt',
        description: taskDialogMode === 'task'
          ? 'Der Brief wurde als Aufgabe übernommen.'
          : 'Der Brief wurde als Unteraufgabe übernommen.',
      });
      closeTaskDialog();
    } catch (error) {
      console.error('Error creating task from letter:', error);
      toast({
        title: 'Fehler',
        description: taskDialogMode === 'task'
          ? 'Die Aufgabe konnte nicht erstellt werden.'
          : 'Die Unteraufgabe konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleDeleteLetter = async (letterId: string) => {
    if (!confirm('Möchten Sie diesen Brief wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('letters')
        .delete()
        .eq('id', letterId);

      if (error) throw error;

      toast({
        title: "Brief gelöscht",
        description: "Der Brief wurde erfolgreich gelöscht.",
      });

      fetchLetters();
    } catch (error) {
      console.error('Error deleting letter:', error);
      toast({
        title: "Fehler",
        description: "Der Brief konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const statusLabels: { [key: string]: string } = {
    draft: 'Entwurf',
    review: 'Zur Prüfung',
    approved: 'Genehmigt',
    sent: 'Versendet'
  };

  const statusColors: { [key: string]: string } = {
    draft: 'bg-gray-100 text-gray-800',
    review: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    sent: 'bg-blue-100 text-blue-800'
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Briefe</h1>
          <p className="text-muted-foreground">Verwalten Sie Ihre Korrespondenz</p>
        </div>
        <Button onClick={handleNewLetter} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Neuer Brief
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Briefe durchsuchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Status filtern..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="draft">Entwurf</SelectItem>
                    <SelectItem value="review">Zur Prüfung</SelectItem>
                    <SelectItem value="approved">Genehmigt</SelectItem>
                    <SelectItem value="sent">Versendet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
              <Button
                variant={viewType === 'card' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewType('card')}
                className="h-8 w-8 p-0"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewType === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewType('list')}
                className="h-8 w-8 p-0"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Letters Grid */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Briefe werden geladen...</p>
        </div>
      ) : filteredLetters.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">Keine Briefe gefunden</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || statusFilter !== 'all' 
              ? 'Keine Briefe entsprechen Ihren Filterkriterien.'
              : 'Erstellen Sie Ihren ersten Brief.'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <Button onClick={handleNewLetter}>
              <Plus className="h-4 w-4 mr-2" />
              Ersten Brief erstellen
            </Button>
          )}
        </div>
      ) : (
        viewType === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLetters.map((letter) => (
              <Card key={letter.id} className="group hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                <CardTitle className="text-lg line-clamp-2">{letter.title}</CardTitle>
                    <Badge className={`ml-2 ${statusColors[letter.status] || 'bg-gray-100 text-gray-800'}`}>
                      {statusLabels[letter.status] || letter.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Recipient */}
                  {letter.recipient_name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="truncate">{letter.recipient_name}</span>
                    </div>
                  )}
                  
                  {/* Date */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(letter.updated_at).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  
                  {/* Content Preview */}
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {letter.content || 'Kein Inhalt vorhanden'}
                  </p>
                  
                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditLetter(letter)}
                        title="Brief bearbeiten"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openTaskDialog(letter, 'task')}
                        title="Als Aufgabe übernehmen"
                      >
                        <ListTodo className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openTaskDialog(letter, 'subtask')}
                        title="Als Unteraufgabe übernehmen"
                      >
                        <ListTree className="h-4 w-4" />
                      </Button>
                      <LetterPDFExport 
                        letter={letter as any} 
                        variant="icon-only"
                        size="sm"
                      />
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteLetter(letter.id!)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Status Actions for non-sent letters */}
                    {letter.status !== 'sent' && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Status ändern im Editor</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titel</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLetters.map((letter) => (
                  <TableRow key={letter.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {letter.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      {letter.recipient_name || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[letter.status] || 'bg-gray-100 text-gray-800'}`}>
                        {statusLabels[letter.status] || letter.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(letter.updated_at).toLocaleDateString('de-DE')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditLetter(letter)}
                          title="Brief bearbeiten"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openTaskDialog(letter, 'task')}
                          title="Als Aufgabe übernehmen"
                        >
                          <ListTodo className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openTaskDialog(letter, 'subtask')}
                          title="Als Unteraufgabe übernehmen"
                        >
                          <ListTree className="h-4 w-4" />
                        </Button>
                        <LetterPDFExport 
                          letter={letter as any} 
                          variant="icon-only"
                          size="sm"
                        />
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteLetter(letter.id!)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )
      )}

      {/* Letter Wizard */}
      {showWizard && (
        <LetterWizard
          onComplete={handleWizardComplete}
          onCancel={() => setShowWizard(false)}
        />
      )}

      {/* Letter Editor */}
      <LetterEditor
        letter={selectedLetter as any}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setSelectedLetter(null);
          // Refresh letters when editor closes to get latest status
          fetchLetters();
        }}
        onSave={() => {
          fetchLetters();
          setIsEditorOpen(false);
          setSelectedLetter(null);
        }}
      />

      <Dialog open={taskDialogMode !== null} onOpenChange={(open) => !open && closeTaskDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {taskDialogMode === 'task' ? 'Aufgabe aus Brief erstellen' : 'Unteraufgabe aus Brief erstellen'}
            </DialogTitle>
            <DialogDescription>
              {taskDialogMode === 'task'
                ? 'Erstellen Sie direkt aus diesem Brief eine neue Aufgabe.'
                : 'Wählen Sie eine bestehende Aufgabe aus, zu der diese Unteraufgabe gehören soll.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="letter-task-title">Titel</Label>
              <Input
                id="letter-task-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Titel der Aufgabe"
              />
            </div>

            {taskDialogMode === 'subtask' && (
              <div className="space-y-2">
                <Label htmlFor="letter-parent-task">Übergeordnete Aufgabe</Label>
                <Select value={parentTaskId} onValueChange={setParentTaskId}>
                  <SelectTrigger id="letter-parent-task">
                    <SelectValue placeholder="Bitte Aufgabe wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bitte wählen</SelectItem>
                    {availableParentTasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {taskDialogMode === 'task' && (
              <div className="space-y-2">
                <Label htmlFor="letter-task-description">Beschreibung</Label>
                <Textarea
                  id="letter-task-description"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Beschreibung (optional)"
                  rows={5}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeTaskDialog} disabled={isCreatingTask}>
              Abbrechen
            </Button>
            <Button onClick={createTaskFromLetter} disabled={isCreatingTask}>
              {isCreatingTask && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {taskDialogMode === 'task' ? 'Aufgabe erstellen' : 'Unteraufgabe erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LettersView;
