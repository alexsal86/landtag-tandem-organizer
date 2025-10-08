import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  Tags, 
  FolderOpen, 
  Download, 
  Trash2, 
  Users,
  Mail,
  FileText
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  category?: string;
  tags?: string[];
}

interface BulkActionsToolbarProps {
  selectedContacts: Contact[];
  onClearSelection: () => void;
  onActionComplete: () => void;
  allTags: string[];
}

export function BulkActionsToolbar({
  selectedContacts,
  onClearSelection,
  onActionComplete,
  allTags,
}: BulkActionsToolbarProps) {
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isDistributionDialogOpen, setIsDistributionDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [distributionListName, setDistributionListName] = useState('');
  const [distributionListDescription, setDistributionListDescription] = useState('');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const handleAddTags = async () => {
    if (selectedTags.length === 0 && !newTag) return;

    setProcessing(true);
    try {
      const tagsToAdd = [...selectedTags];
      if (newTag) tagsToAdd.push(newTag);

      for (const contact of selectedContacts) {
        const existingTags = contact.tags || [];
        const updatedTags = [...new Set([...existingTags, ...tagsToAdd])];

        const { error } = await supabase
          .from('contacts')
          .update({ tags: updatedTags })
          .eq('id', contact.id);

        if (error) throw error;
      }

      toast({
        title: 'Tags hinzugefügt',
        description: `${selectedContacts.length} Kontakte aktualisiert`,
      });

      setIsTagDialogOpen(false);
      setSelectedTags([]);
      setNewTag('');
      onActionComplete();
    } catch (error) {
      console.error('Error adding tags:', error);
      toast({
        title: 'Fehler',
        description: 'Tags konnten nicht hinzugefügt werden',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleChangeCategory = async () => {
    if (!selectedCategory) return;

    setProcessing(true);
    try {
      for (const contact of selectedContacts) {
        const { error } = await supabase
          .from('contacts')
          .update({ category: selectedCategory })
          .eq('id', contact.id);

        if (error) throw error;
      }

      toast({
        title: 'Kategorie geändert',
        description: `${selectedContacts.length} Kontakte aktualisiert`,
      });

      setIsCategoryDialogOpen(false);
      setSelectedCategory('');
      onActionComplete();
    } catch (error) {
      console.error('Error changing category:', error);
      toast({
        title: 'Fehler',
        description: 'Kategorie konnte nicht geändert werden',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateDistributionList = async () => {
    if (!distributionListName || !currentTenant) return;

    setProcessing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Create distribution list
      const { data: listData, error: listError } = await supabase
        .from('distribution_lists')
        .insert({
          name: distributionListName,
          description: distributionListDescription,
          user_id: userData.user.id,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();

      if (listError) throw listError;

      // Add members
      const members = selectedContacts.map(contact => ({
        distribution_list_id: listData.id,
        contact_id: contact.id,
      }));

      const { error: membersError } = await supabase
        .from('distribution_list_members')
        .insert(members);

      if (membersError) throw membersError;

      toast({
        title: 'Verteiler erstellt',
        description: `${selectedContacts.length} Kontakte hinzugefügt`,
      });

      setIsDistributionDialogOpen(false);
      setDistributionListName('');
      setDistributionListDescription('');
      onActionComplete();
    } catch (error) {
      console.error('Error creating distribution list:', error);
      toast({
        title: 'Fehler',
        description: 'Verteiler konnte nicht erstellt werden',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    setProcessing(true);
    try {
      for (const contact of selectedContacts) {
        const { error } = await supabase
          .from('contacts')
          .delete()
          .eq('id', contact.id);

        if (error) throw error;
      }

      toast({
        title: 'Kontakte gelöscht',
        description: `${selectedContacts.length} Kontakte wurden gelöscht`,
      });

      setIsDeleteDialogOpen(false);
      onActionComplete();
    } catch (error) {
      console.error('Error deleting contacts:', error);
      toast({
        title: 'Fehler',
        description: 'Kontakte konnten nicht gelöscht werden',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'E-Mail', 'Telefon', 'Kategorie', 'Tags'];
    const rows = selectedContacts.map(contact => [
      contact.name,
      contact.email || '',
      contact.phone || '',
      contact.category || '',
      (contact.tags || []).join('; '),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kontakte_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({
      title: 'Export erfolgreich',
      description: `${selectedContacts.length} Kontakte als CSV exportiert`,
    });
  };

  const exportToVCF = () => {
    const vcfContent = selectedContacts
      .map(contact => {
        const lines = [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `FN:${contact.name}`,
        ];

        if (contact.email) lines.push(`EMAIL:${contact.email}`);
        if (contact.phone) lines.push(`TEL:${contact.phone}`);
        if (contact.tags && contact.tags.length > 0) {
          lines.push(`CATEGORIES:${contact.tags.join(',')}`);
        }

        lines.push('END:VCARD');
        return lines.join('\r\n');
      })
      .join('\r\n');

    const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kontakte_${new Date().toISOString().split('T')[0]}.vcf`;
    link.click();

    toast({
      title: 'Export erfolgreich',
      description: `${selectedContacts.length} Kontakte als VCF exportiert`,
    });
  };

  if (selectedContacts.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-lg shadow-xl p-4 flex items-center gap-4 animate-in slide-in-from-bottom-5">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-primary-foreground text-primary">
            {selectedContacts.length}
          </Badge>
          <span className="font-medium">
            {selectedContacts.length === 1 ? 'Kontakt' : 'Kontakte'} ausgewählt
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsTagDialogOpen(true)}
          >
            <Tags className="h-4 w-4 mr-2" />
            Tags
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsCategoryDialogOpen(true)}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Kategorie
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={exportToCSV}>
                <FileText className="h-4 w-4 mr-2" />
                Als CSV exportieren
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToVCF}>
                <Mail className="h-4 w-4 mr-2" />
                Als VCF exportieren
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsDistributionDialogOpen(true)}
          >
            <Users className="h-4 w-4 mr-2" />
            Verteiler
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Löschen
          </Button>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
          className="hover:bg-primary-foreground/20"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tags Dialog */}
      <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tags hinzufügen</DialogTitle>
            <DialogDescription>
              Fügen Sie Tags zu {selectedContacts.length} Kontakten hinzu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vorhandene Tags</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedTags(prev =>
                        prev.includes(tag)
                          ? prev.filter(t => t !== tag)
                          : [...prev, tag]
                      );
                    }}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="newTag">Neuer Tag</Label>
              <Input
                id="newTag"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                placeholder="Neuen Tag eingeben..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTagDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAddTags} disabled={processing}>
              {processing ? 'Wird hinzugefügt...' : 'Hinzufügen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kategorie ändern</DialogTitle>
            <DialogDescription>
              Ändern Sie die Kategorie für {selectedContacts.length} Kontakte
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category">Kategorie</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="citizen">Bürger</SelectItem>
                  <SelectItem value="colleague">Kollege</SelectItem>
                  <SelectItem value="business">Wirtschaft</SelectItem>
                  <SelectItem value="media">Medien</SelectItem>
                  <SelectItem value="lobbyist">Lobbyist</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleChangeCategory} disabled={processing}>
              {processing ? 'Wird geändert...' : 'Ändern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Distribution List Dialog */}
      <Dialog open={isDistributionDialogOpen} onOpenChange={setIsDistributionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verteiler erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen neuen Verteiler mit {selectedContacts.length} Kontakten
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="listName">Name des Verteilers</Label>
              <Input
                id="listName"
                value={distributionListName}
                onChange={e => setDistributionListName(e.target.value)}
                placeholder="z.B. Newsletter Empfänger"
              />
            </div>
            <div>
              <Label htmlFor="listDescription">Beschreibung (optional)</Label>
              <Textarea
                id="listDescription"
                value={distributionListDescription}
                onChange={e => setDistributionListDescription(e.target.value)}
                placeholder="Beschreibung des Verteilers..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDistributionDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateDistributionList} disabled={processing || !distributionListName}>
              {processing ? 'Wird erstellt...' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kontakte löschen</DialogTitle>
            <DialogDescription>
              Möchten Sie wirklich {selectedContacts.length} Kontakte löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={processing}>
              {processing ? 'Wird gelöscht...' : 'Löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
