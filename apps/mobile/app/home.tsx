import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/AuthContext';

type SheetKind = 'note' | 'task' | 'contact' | null;

interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  business_phone: string | null;
  mobile_phone: string | null;
}

export default function HomeScreen(): React.JSX.Element {
  const { session, initializing, tenants, activeTenantId, signOut } = useAuth();
  const [sheet, setSheet] = useState<SheetKind>(null);

  useEffect(() => {
    if (!initializing && !session) router.replace('/login');
  }, [initializing, session]);

  if (initializing || !session) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  const activeTenant = tenants.find((t) => t.id === activeTenantId);

  const tiles: { key: SheetKind | 'placeholder'; label: string; icon: string; placeholder?: string }[] = [
    { key: 'note', label: 'Notiz', icon: '📝' },
    { key: 'placeholder', label: 'Sprachnotiz', icon: '🎙', placeholder: 'Sprachnotiz' },
    { key: 'task', label: 'Aufgabe', icon: '✅' },
    { key: 'placeholder', label: 'Termin', icon: '📅', placeholder: 'Termin' },
    { key: 'contact', label: 'Kontakt suchen', icon: '👤' },
    { key: 'placeholder', label: 'Anruf erfassen', icon: '📞', placeholder: 'Anruf erfassen' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tenantLabel}>Aktiver Tenant</Text>
          <Text style={styles.tenantName}>{activeTenant?.name ?? '—'}</Text>
        </View>
        <Pressable onPress={() => router.push('/settings')} style={styles.iconBtn}>
          <Text style={{ fontSize: 18 }}>⚙️</Text>
        </Pressable>
      </View>

      <Text style={styles.h1}>Schnellaktionen</Text>

      <View style={styles.grid}>
        {tiles.map((t, i) => (
          <Pressable
            key={`${t.key}-${i}`}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
            onPress={() => {
              if (t.key === 'placeholder') {
                Alert.alert(t.placeholder ?? 'Bald verfügbar', 'Diese Aktion ist in Vorbereitung.');
              } else {
                setSheet(t.key as SheetKind);
              }
            }}
          >
            <Text style={styles.tileIcon}>{t.icon}</Text>
            <Text style={styles.tileLabel}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={signOut} style={styles.logout}>
        <Text style={styles.logoutText}>Abmelden</Text>
      </Pressable>

      <NoteSheet visible={sheet === 'note'} onClose={() => setSheet(null)} userId={session.user.id} />
      <TaskSheet
        visible={sheet === 'task'}
        onClose={() => setSheet(null)}
        userId={session.user.id}
        tenantId={activeTenantId}
      />
      <ContactSheet
        visible={sheet === 'contact'}
        onClose={() => setSheet(null)}
        tenantId={activeTenantId}
      />
    </SafeAreaView>
  );
}

function SheetShell({
  visible, onClose, title, children,
}: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose}><Text style={styles.sheetClose}>Schließen</Text></Pressable>
        </View>
        <View style={{ padding: 16, gap: 12, flex: 1 }}>{children}</View>
      </SafeAreaView>
    </Modal>
  );
}

function NoteSheet({ visible, onClose, userId }: { visible: boolean; onClose: () => void; userId: string }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

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
    if (error) {
      Alert.alert('Fehler', error.message);
      return;
    }
    setTitle(''); setContent(''); onClose();
  };

  return (
    <SheetShell visible={visible} onClose={onClose} title="Neue Notiz">
      <TextInput placeholder="Titel (optional)" value={title} onChangeText={setTitle} style={styles.input} />
      <TextInput
        placeholder="Inhalt"
        value={content}
        onChangeText={setContent}
        style={[styles.input, { height: 160, textAlignVertical: 'top' }]}
        multiline
      />
      <Pressable onPress={save} disabled={busy} style={styles.primaryBtn}>
        <Text style={styles.primaryBtnText}>{busy ? 'Speichere…' : 'Speichern'}</Text>
      </Pressable>
    </SheetShell>
  );
}

function TaskSheet({
  visible, onClose, userId, tenantId,
}: { visible: boolean; onClose: () => void; userId: string; tenantId: string | null }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    if (!tenantId) {
      Alert.alert('Tenant fehlt', 'Bitte zuerst Tenant auswählen.');
      return;
    }
    setBusy(true);
    // Resolve profile id for created_by
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
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
    if (error) {
      Alert.alert('Fehler', error.message);
      return;
    }
    setTitle(''); onClose();
  };

  return (
    <SheetShell visible={visible} onClose={onClose} title="Neue Aufgabe">
      <TextInput placeholder="Titel" value={title} onChangeText={setTitle} style={styles.input} />
      <Pressable onPress={save} disabled={busy} style={styles.primaryBtn}>
        <Text style={styles.primaryBtnText}>{busy ? 'Speichere…' : 'Anlegen'}</Text>
      </Pressable>
    </SheetShell>
  );
}

function ContactSheet({
  visible, onClose, tenantId,
}: { visible: boolean; onClose: () => void; tenantId: string | null }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ContactRow[]>([]);

  useEffect(() => {
    if (!visible || !tenantId) return;
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id,name,email,phone,business_phone,mobile_phone')
        .eq('tenant_id', tenantId)
        .ilike('name', `%${term}%`)
        .limit(20);
      setResults((data ?? []) as ContactRow[]);
    }, 250);
    return () => clearTimeout(t);
  }, [q, visible, tenantId]);

  const call = (c: ContactRow) => {
    const num = c.mobile_phone || c.business_phone || c.phone;
    if (num) Linking.openURL(`tel:${num}`);
  };
  const mail = (c: ContactRow) => { if (c.email) Linking.openURL(`mailto:${c.email}`); };

  return (
    <SheetShell visible={visible} onClose={onClose} title="Kontakt suchen">
      <TextInput placeholder="Name suchen…" value={q} onChangeText={setQ} style={styles.input} autoFocus />
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={styles.contactRow}>
            <Text style={styles.contactName}>{item.name}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              {(item.mobile_phone || item.business_phone || item.phone) ? (
                <Pressable onPress={() => call(item)} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>Anrufen</Text>
                </Pressable>
              ) : null}
              {item.email ? (
                <Pressable onPress={() => mail(item)} style={[styles.smallBtn, styles.secondaryBtn]}>
                  <Text style={[styles.smallBtnText, { color: '#155EEF' }]}>Mail</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
        ListEmptyComponent={q.length >= 2 ? <Text style={styles.muted}>Keine Treffer.</Text> : null}
      />
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', padding: 16, alignItems: 'center' },
  tenantLabel: { fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  tenantName: { fontSize: 16, fontWeight: '700', color: '#0D1B2A' },
  iconBtn: { padding: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  h1: { fontSize: 22, fontWeight: '700', color: '#0D1B2A', paddingHorizontal: 16, marginTop: 4, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12 },
  tile: {
    width: '47%', aspectRatio: 1, marginHorizontal: '1.5%', backgroundColor: '#fff',
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', gap: 8,
  },
  tileIcon: { fontSize: 36 },
  tileLabel: { fontSize: 14, fontWeight: '600', color: '#0D1B2A' },
  logout: { marginTop: 'auto', alignSelf: 'center', padding: 16 },
  logoutText: { color: '#DC2626', fontWeight: '600' },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E5E7EB',
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#0D1B2A' },
  sheetClose: { color: '#155EEF', fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff',
  },
  primaryBtn: { backgroundColor: '#155EEF', borderRadius: 10, alignItems: 'center', paddingVertical: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  contactRow: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  contactName: { fontSize: 15, fontWeight: '600', color: '#0D1B2A' },
  smallBtn: { backgroundColor: '#155EEF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  secondaryBtn: { backgroundColor: '#EEF4FF' },
  smallBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  muted: { color: '#6B7280', textAlign: 'center', marginTop: 12 },
});
