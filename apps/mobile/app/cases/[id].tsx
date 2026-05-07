import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/AuthContext';
import { useToast } from '@/ui/Toast';

interface CaseDetail {
  id: string;
  subject: string | null;
  summary: string | null;
  status: string | null;
  priority: string | null;
  due_at: string | null;
  reporter_name: string | null;
}
interface Interaction {
  id: string;
  channel: string | null;
  body: string | null;
  occurred_at: string;
}

const STATUSES = ['open', 'in_progress', 'waiting', 'closed'];

export default function CaseDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const toast = useToast();
  const [item, setItem] = useState<CaseDetail | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [newInteraction, setNewInteraction] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('case_items')
      .select('id,subject,summary,status,priority,due_at,reporter_name')
      .eq('id', id)
      .maybeSingle();
    setItem((data as CaseDetail) ?? null);
    const { data: ints } = await supabase
      .from('case_item_interactions')
      .select('id, channel, body, occurred_at')
      .eq('case_item_id', id)
      .order('occurred_at', { ascending: false })
      .limit(30);
    setInteractions((ints ?? []) as Interaction[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const setStatus = async (status: string) => {
    if (!item) return;
    setItem({ ...item, status });
    await supabase.from('case_items').update({ status }).eq('id', item.id);
    toast.show(`Status: ${status}`, 'success');
  };

  const addInteraction = async () => {
    if (!newInteraction.trim() || !item || !session?.user.id) return;
    setSaving(true);
    const { error } = await supabase.from('case_item_interactions').insert({
      case_item_id: item.id,
      channel: 'mobile_note',
      body: newInteraction.trim(),
      created_by: session.user.id,
      occurred_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { toast.show('Fehler beim Speichern', 'error'); return; }
    setNewInteraction('');
    toast.show('Eintrag hinzugefügt', 'success');
    void load();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!item) return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Zurück</Text></Pressable></View>
      <Text style={styles.empty}>Vorgang nicht gefunden.</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Zurück</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={styles.title}>{item.subject ?? '(ohne Betreff)'}</Text>
        {item.reporter_name ? <Text style={styles.meta}>👤 {item.reporter_name}</Text> : null}
        {item.summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Zusammenfassung</Text>
            <Text style={styles.body}>{item.summary}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Status</Text>
          <View style={styles.btnRow}>
            {STATUSES.map((s) => (
              <Pressable key={s} onPress={() => setStatus(s)} style={[styles.btn, item.status === s && styles.btnActive]}>
                <Text style={[styles.btnText, item.status === s && styles.btnTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Interaktion erfassen</Text>
          <TextInput
            value={newInteraction}
            onChangeText={setNewInteraction}
            placeholder="Was ist passiert? Notiz zum Vorgang…"
            multiline
            style={styles.input}
          />
          <Pressable disabled={saving || !newInteraction.trim()} onPress={addInteraction} style={[styles.saveBtn, (saving || !newInteraction.trim()) && { opacity: 0.5 }]}>
            <Text style={styles.saveBtnText}>{saving ? 'Speichern…' : 'Hinzufügen'}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Verlauf</Text>
          {interactions.length === 0 ? (
            <Text style={styles.empty}>Noch keine Einträge.</Text>
          ) : interactions.map((i) => (
            <View key={i.id} style={styles.intRow}>
              <Text style={styles.intMeta}>{new Date(i.occurred_at).toLocaleString('de-DE')} · {i.channel ?? ''}</Text>
              {i.body ? <Text style={styles.intBody}>{i.body}</Text> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 16 },
  back: { color: '#155EEF', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: '#0D1B2A' },
  meta: { fontSize: 13, color: '#6B7280' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { fontSize: 14, color: '#0D1B2A', lineHeight: 20 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F3F4F6' },
  btnActive: { backgroundColor: '#155EEF' },
  btnText: { color: '#374151', fontWeight: '600', fontSize: 12 },
  btnTextActive: { color: '#fff' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, minHeight: 80, textAlignVertical: 'top', fontSize: 14, backgroundColor: '#fff' },
  saveBtn: { backgroundColor: '#155EEF', borderRadius: 10, padding: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  intRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  intMeta: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  intBody: { fontSize: 14, color: '#0D1B2A' },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 12 },
});
