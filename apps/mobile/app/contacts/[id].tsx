import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/AuthContext';
import { useToast } from '@/ui/Toast';

interface ContactDetail {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  organization: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  business_phone: string | null;
  category: string | null;
  notes: string | null;
  tenant_id: string;
}
interface MemoryItem {
  id: string;
  kind: string | null;
  content: string | null;
  question: string | null;
  answer: string | null;
  updated_at: string;
}

export default function ContactDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const toast = useToast();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [callOpen, setCallOpen] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [callSaving, setCallSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('contacts')
      .select('id,name,first_name,last_name,organization,role,email,phone,mobile_phone,business_phone,category,notes,tenant_id')
      .eq('id', id)
      .maybeSingle();
    setContact((data as ContactDetail) ?? null);
    const { data: mem } = await supabase
      .from('contact_briefing_memory')
      .select('id, kind, content, question, answer, updated_at')
      .eq('contact_id', id)
      .order('updated_at', { ascending: false })
      .limit(20);
    setMemories((mem ?? []) as MemoryItem[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const callPhone = (num: string) => { void Linking.openURL(`tel:${num.replace(/\s/g, '')}`); };
  const mailTo = (m: string) => { void Linking.openURL(`mailto:${m}`); };

  const saveCall = async () => {
    if (!contact || !session?.user.id) return;
    setCallSaving(true);
    const { error } = await supabase.from('call_logs').insert({
      user_id: session.user.id,
      tenant_id: contact.tenant_id,
      contact_id: contact.id,
      call_type: 'incoming',
      call_date: new Date().toISOString(),
      notes: callNotes.trim() || null,
      caller_name: contact.name ?? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || null,
    });
    setCallSaving(false);
    if (error) { toast.show('Fehler', 'error'); return; }
    setCallNotes('');
    setCallOpen(false);
    toast.show('Anruf protokolliert', 'success');
  };

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!contact) return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Zurück</Text></Pressable></View>
      <Text style={styles.empty}>Kontakt nicht gefunden.</Text>
    </SafeAreaView>
  );

  const fullName = contact.name ?? [contact.first_name, contact.last_name].filter(Boolean).join(' ') ?? '—';
  const phones = [
    { label: 'Mobil', value: contact.mobile_phone },
    { label: 'Telefon', value: contact.phone },
    { label: 'Geschäft', value: contact.business_phone },
  ].filter((p): p is { label: string; value: string } => Boolean(p.value));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Zurück</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={styles.title}>{fullName}</Text>
        {contact.organization ? <Text style={styles.subtitle}>{contact.organization}{contact.role ? ` · ${contact.role}` : ''}</Text> : null}
        {contact.category ? <Text style={styles.chip}>{contact.category}</Text> : null}

        {phones.length > 0 || contact.email ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Kontakt</Text>
            {phones.map((p) => (
              <Pressable key={p.label} onPress={() => callPhone(p.value)} style={styles.linkRow}>
                <Text style={styles.linkText}>📞 {p.label}: {p.value}</Text>
              </Pressable>
            ))}
            {contact.email ? (
              <Pressable onPress={() => mailTo(contact.email!)} style={styles.linkRow}>
                <Text style={styles.linkText}>✉️ {contact.email}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Schnellaktionen</Text>
          <Pressable onPress={() => setCallOpen((v) => !v)} style={[styles.btn, styles.btnPrimary]}>
            <Text style={styles.btnPrimaryText}>📞 Anruf protokollieren</Text>
          </Pressable>
          {callOpen ? (
            <View style={{ gap: 8 }}>
              <TextInput
                value={callNotes}
                onChangeText={setCallNotes}
                placeholder="Notizen zum Anruf…"
                multiline
                style={styles.input}
              />
              <Pressable disabled={callSaving} onPress={saveCall} style={[styles.btn, styles.btnPrimary, callSaving && { opacity: 0.5 }]}>
                <Text style={styles.btnPrimaryText}>{callSaving ? 'Speichern…' : 'Speichern'}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Briefing-Memory</Text>
          {memories.length === 0 ? (
            <Text style={styles.empty}>Noch keine Einträge.</Text>
          ) : memories.map((m) => (
            <View key={m.id} style={styles.memRow}>
              <Text style={styles.memMeta}>{m.kind ?? 'note'} · {new Date(m.updated_at).toLocaleDateString('de-DE')}</Text>
              {m.question ? <Text style={styles.memQ}>F: {m.question}</Text> : null}
              {m.answer ? <Text style={styles.memBody}>A: {m.answer}</Text> : null}
              {m.content ? <Text style={styles.memBody}>{m.content}</Text> : null}
            </View>
          ))}
        </View>

        {contact.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notizen</Text>
            <Text style={styles.body}>{contact.notes}</Text>
          </View>
        ) : null}
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
  subtitle: { fontSize: 14, color: '#6B7280' },
  chip: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', color: '#155EEF', backgroundColor: '#EEF4FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { fontSize: 14, color: '#0D1B2A', lineHeight: 20 },
  linkRow: { paddingVertical: 6 },
  linkText: { fontSize: 14, color: '#155EEF', fontWeight: '600' },
  btn: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' },
  btnPrimary: { backgroundColor: '#155EEF' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, minHeight: 70, textAlignVertical: 'top', fontSize: 14, backgroundColor: '#fff' },
  memRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  memMeta: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  memQ: { fontSize: 13, color: '#0D1B2A', fontWeight: '600' },
  memBody: { fontSize: 13, color: '#374151', marginTop: 2 },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 12 },
});
