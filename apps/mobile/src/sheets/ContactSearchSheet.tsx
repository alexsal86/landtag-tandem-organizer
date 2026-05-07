import { useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { SheetShell } from '@/ui/SheetShell';

interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  business_phone: string | null;
  mobile_phone: string | null;
}

export function ContactSearchSheet({
  visible, onClose, tenantId,
}: { visible: boolean; onClose: () => void; tenantId: string | null }): React.JSX.Element {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ContactRow[]>([]);

  useEffect(() => { if (!visible) { setQ(''); setResults([]); } }, [visible]);

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

  return (
    <SheetShell visible={visible} onClose={onClose} title="Kontakt suchen">
      <TextInput placeholder="Name suchen…" value={q} onChangeText={setQ} style={styles.input} autoFocus />
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              {(item.mobile_phone || item.business_phone || item.phone) ? (
                <Pressable onPress={() => call(item)} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>Anrufen</Text>
                </Pressable>
              ) : null}
              {item.email ? (
                <Pressable onPress={() => Linking.openURL(`mailto:${item.email}`)} style={[styles.smallBtn, styles.secondary]}>
                  <Text style={[styles.smallBtnText, { color: '#155EEF' }]}>Mail</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
        ListEmptyComponent={
          q.trim().length >= 2 ? (
            <Text style={styles.muted}>Keine Treffer.</Text>
          ) : (
            <Text style={styles.muted}>Mindestens 2 Buchstaben eingeben.</Text>
          )
        }
      />
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  name: { fontSize: 15, fontWeight: '600', color: '#0D1B2A' },
  smallBtn: { backgroundColor: '#155EEF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  secondary: { backgroundColor: '#EEF4FF' },
  smallBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  muted: { color: '#6B7280', textAlign: 'center', marginTop: 16 },
});
