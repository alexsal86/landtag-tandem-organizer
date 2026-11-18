import { useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTenantProfiles } from '@/hooks/useTenantProfiles';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import { debugConsole } from '@/utils/debugConsole';

interface SelectedTextTaskDialogProps {
  text: string;
  userId: string;
  tenantId: string;
  onClose: () => void;
}

export function SelectedTextTaskDialog({ text, userId, tenantId, onClose }: SelectedTextTaskDialogProps) {
  const fieldId = useId();
  const { data: profiles, isLoading, error: profilesError } = useTenantProfiles();
  const [title, setTitle] = useState(text.split(/\r?\n/, 1)[0].slice(0, 100));
  const [description, setDescription] = useState(text);
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const createTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    try {
      const html = description.trim()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r?\n/g, '<br>');
      const { error } = await supabase.from('tasks').insert({
        user_id: userId,
        tenant_id: tenantId,
        title: title.trim(),
        description: html ? `<p>${html}</p>` : null,
        assigned_to: assignee || null,
        due_date: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
        status: 'todo',
        priority: 'medium',
        category: 'personal',
      });
      if (error) throw error;
      notify.success('Aufgabe erstellt');
      onClose();
    } catch (error) {
      debugConsole.error('Error creating task from note selection:', error);
      notify.error('Aufgabe konnte nicht erstellt werden.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !savingRef.current) onClose(); }}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto"
        onKeyDown={(event) => { if (event.key === 'Escape') event.stopPropagation(); }}
      >
        <DialogHeader>
          <DialogTitle>Aufgabe aus Auswahl</DialogTitle>
          <DialogDescription>Prüfe den übernommenen Text und ergänze bei Bedarf Zuständigkeit und Frist.</DialogDescription>
        </DialogHeader>
        <form onSubmit={createTask} className="space-y-4">
          <fieldset disabled={saving} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={fieldId + '-title'}>Titel</Label>
              <Input id={fieldId + '-title'} value={title} onChange={(event) => setTitle(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor={fieldId + '-description'}>Beschreibung</Label>
              <Textarea id={fieldId + '-description'} value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={fieldId + '-assignee'}>Zuständig</Label>
              <select
                id={fieldId + '-assignee'}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                disabled={isLoading || Boolean(profilesError)}
              >
                <option value="">Ohne Zuweisung</option>
                {profiles.map((profile) => (
                  <option key={profile.user_id} value={profile.user_id}>{profile.display_name || profile.user_id}</option>
                ))}
              </select>
              {profilesError && <p className="text-xs text-destructive">Zuständige Personen konnten nicht geladen werden.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor={fieldId + '-due'}>Fällig am</Label>
              <Input id={fieldId + '-due'} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Abbrechen</Button>
            <Button type="submit" disabled={saving || !title.trim()}>{saving ? 'Wird erstellt …' : 'Aufgabe erstellen'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
