import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/AuthContext';

interface CaseRow {
  id: string;
  subject: string | null;
  summary: string | null;
  status: string | null;
  priority: string | null;
  due_at: string | null;
  updated_at: string;
}

export default function CasesScreen(): React.JSX.Element {
  const { activeTenantId } = useAuth();
  const [items, setItems] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    const { data } = await supabase
      .from('case_items')
      .select('id,subject,summary,status,priority,due_at,updated_at')
      .eq('tenant_id', activeTenantId)
      .neq('status', 'closed')
      .order('updated_at', { ascending: false })
      .limit(100);
    setItems((data ?? []) as CaseRow[]);
    setLoading(false);
    setRefreshing(false);
  }, [activeTenantId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/home')}><Text style={styles.back}>‹ Start</Text></Pressable>
        <Text style={styles.h1}>Vorgänge</Text>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator /></View> : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
          ListEmptyComponent={<Text style={styles.empty}>Keine offenen Vorgänge.</Text>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/cases/[id]', params: { id: item.id } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.title} numberOfLines={2}>{item.subject ?? '(ohne Betreff)'}</Text>
              {item.summary ? <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text> : null}
              <View style={styles.metaRow}>
                {item.status ? <Text style={styles.chip}>{item.status}</Text> : null}
                {item.priority ? <Text style={styles.chip}>{item.priority}</Text> : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  back: { color: '#155EEF', fontSize: 16, fontWeight: '600' },
  h1: { fontSize: 22, fontWeight: '700', color: '#0D1B2A' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  title: { fontSize: 15, fontWeight: '600', color: '#0D1B2A' },
  summary: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { fontSize: 11, fontWeight: '600', color: '#374151', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
});
