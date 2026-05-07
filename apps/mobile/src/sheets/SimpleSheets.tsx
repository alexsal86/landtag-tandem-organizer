import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { supabase } from '@/lib/supabase';
import { SheetShell } from '@/ui/SheetShell';
import { useToast } from '@/ui/Toast';

export function NoteSheet({
  visible, onClose, userId,
}: { visible: boolean; onClose: () => void; userId: string }): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const save = async () => {
    if (!content.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('quick_notes').insert({
      user_id: userId,
      title: title.trim() || null,
      content: content.trim(),
      category: 'mobile',
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Notiz gespeichert');
    setTitle(''); setContent(''); onClose();
  };

  return (
    <SheetShell visible={visible} onClose={onClose} title="Neue Notiz">
      <TextInput placeholder="Titel (optional)" value={title} onChangeText={setTitle} style={styles.input} editable={!busy} />
      <TextInput
        placeholder="Inhalt"
        value={content}
        onChangeText={setContent}
        multiline
        style={[styles.input, { height: 200, textAlignVertical: 'top' }]}
        editable={!busy}
      />
      <Pressable onPress={save} disabled={busy} style={styles.primary}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Speichern</Text>}
      </Pressable>
    </SheetShell>
  );
}

export function TaskSheet({
  visible, onClose, userId, tenantId,
}: { visible: boolean; onClose: () => void; userId: string; tenantId: string | null }): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const save = async () => {
    if (!title.trim()) return;
    if (!tenantId) { toast.error('Tenant fehlt'); return; }
    setBusy(true);
    const { data: profile } = await supabase
      .from('profiles').select('id').eq('user_id', userId).eq('tenant_id', tenantId).maybeSingle();
    const { error } = await supabase.from('tasks').insert({
      user_id: userId,
      tenant_id: tenantId,
      title: title.trim(),
      category: 'mobile',
      status: 'todo',
      priority: 'medium',
      created_by: profile?.id ?? null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Aufgabe angelegt');
    setTitle(''); onClose();
  };

  return (
    <SheetShell visible={visible} onClose={onClose} title="Neue Aufgabe">
      <TextInput placeholder="Titel" value={title} onChangeText={setTitle} style={styles.input} editable={!busy} autoFocus />
      <Pressable onPress={save} disabled={busy} style={styles.primary}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Anlegen</Text>}
      </Pressable>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  primary: { backgroundColor: '#155EEF', borderRadius: 10, alignItems: 'center', paddingVertical: 12 },
  primaryText: { color: '#fff', fontWeight: '700' },
});
