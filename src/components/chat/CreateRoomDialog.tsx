import React, { useState } from 'react';
import { Plus, Users, Lock, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface CreateRoomDialogProps {
  onCreateRoom: (options: CreateRoomOptions) => Promise<string>;
  trigger?: React.ReactNode;
}

export interface CreateRoomOptions {
  name: string;
  topic?: string;
  isPrivate: boolean;
  inviteUserIds?: string[];
}

export function CreateRoomDialog({ onCreateRoom, trigger }: CreateRoomDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [inviteUsers, setInviteUsers] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: 'Name erforderlich',
        description: 'Bitte geben Sie einen Namen für den Raum ein.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const inviteUserIds = inviteUsers
        .split(',')
        .map(id => id.trim())
        .filter(id => id.startsWith('@'));

      await onCreateRoom({
        name: name.trim(),
        topic: topic.trim() || undefined,
        isPrivate,
        inviteUserIds: inviteUserIds.length > 0 ? inviteUserIds : undefined,
      });

      toast({
        title: 'Raum erstellt',
        description: `"${name}" wurde erfolgreich erstellt.`,
      });

      // Reset form
      setName('');
      setTopic('');
      setIsPrivate(true);
      setInviteUsers('');
      setOpen(false);
    } catch (error) {
      toast({
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Raum konnte nicht erstellt werden',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Neuer Raum
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Neuen Raum erstellen
          </DialogTitle>
          <DialogDescription>
            Erstellen Sie einen neuen Matrix-Raum für Ihre Kommunikation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="room-name">Name *</Label>
            <Input
              id="room-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Team-Chat"
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="room-topic">Thema (optional)</Label>
            <Textarea
              id="room-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Worum geht es in diesem Raum?"
              rows={2}
              disabled={isCreating}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="private-room" className="flex items-center gap-2">
                {isPrivate ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                {isPrivate ? 'Privater Raum' : 'Öffentlicher Raum'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {isPrivate 
                  ? 'Nur eingeladene Nutzer können beitreten' 
                  : 'Jeder kann den Raum finden und beitreten'}
              </p>
            </div>
            <Switch
              id="private-room"
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-users">Nutzer einladen (optional)</Label>
            <Input
              id="invite-users"
              value={inviteUsers}
              onChange={(e) => setInviteUsers(e.target.value)}
              placeholder="@user1:matrix.org, @user2:matrix.org"
              disabled={isCreating}
            />
            <p className="text-xs text-muted-foreground">
              Matrix-IDs mit Komma getrennt
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isCreating}>
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
            {isCreating ? 'Wird erstellt...' : 'Raum erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
