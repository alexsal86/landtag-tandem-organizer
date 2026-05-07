import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/AuthContext';

type Tab = 'inbox' | 'today' | 'week';

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  status: string | null;
  due_date: string | null;
  category: string | null;
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'today', label: 'Heute' },
  { key: 'week', label: 'Woche' },
];

export default function TasksScreen(): React.JSX.Element {
  const { session, activeTenantId, initializing } = useAuth();
  const [tab, setTab] = useState<Tab>('today');
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!initializing && !session) router.replace('/login');
  }, [initializing, session]);

  const load = useCallback(async () => {
    if (!session?.user.id || !activeTenantId) return;
    let q = supabase
      .from('tasks')
      .select('id,title,description,priority,status,due_date,category')
      .eq('tenant_id', activeTenantId)
      .neq('status', 'completed')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(200);

    const now = new Date();
    if (tab === 'today') {
      const end = new Date(); end.setHours(23, 59, 59, 999);
      q = q.lte('due_date', end.toISOString());
    } else if (tab === 'week') {
      const end = new Date(now); end.setDate(end.getDate() + 7); end.setHours(23, 59, 59, 999);
      q = q.lte('due_date', end.toISOString());
    } else {
      q = q.is('due_date', null);
    }

    const { data, error } = await q;
    if (!error && data) setTasks(data as TaskRow[]);
    setLoading(false);
    setRefreshing(false);
  }, [session?.user.id, activeTenantId, tab]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  const counts = useMemo(() => ({ count: tasks.length }), [tasks]);

  const completeTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from('tasks').update({ status: 'completed' }).eq('id', id);
  };

  const snoozeTask = async (id: string, hours: number) => {
    const due = new Date(); due.setHours(due.getHours() + hours);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from('tasks').update({ due_date: due.toISOString() }).eq('id', id);
  };

  if (!session) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/home')} style={styles.back}>
          <Text style={styles.backText}>‹ Start</Text>
        </Pressable>
        <Text style={styles.h1}>Aufgaben</Text>
        <Text style={styles.count}>{counts.count}</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void load(); }}
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>Keine Aufgaben.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable onPress={() => router.push({ pathname: '/tasks/[id]', params: { id: item.id } })} style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <View style={styles.metaRow}>
                  {item.priority ? <Text style={[styles.badge, prioStyle(item.priority)]}>{item.priority}</Text> : null}
                  {item.due_date ? <Text style={styles.meta}>📅 {fmtDate(item.due_date)}</Text> : null}
                  {item.category ? <Text style={styles.meta}>{item.category}</Text> : null}
                </View>
              </Pressable>
              <View style={styles.actions}>
                <Pressable onPress={() => completeTask(item.id)} style={styles.actBtn}><Text>✅</Text></Pressable>
                <Pressable onPress={() => snoozeTask(item.id, 24)} style={styles.actBtn}><Text>⏰</Text></Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}
function prioStyle(p: string): { backgroundColor: string; color: string } {
  if (p === 'high' || p === 'urgent') return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
  if (p === 'medium') return { backgroundColor: '#FEF3C7', color: '#92400E' };
  return { backgroundColor: '#E5E7EB', color: '#374151' };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  back: { padding: 6 },
  backText: { color: '#155EEF', fontSize: 16, fontWeight: '600' },
  h1: { fontSize: 22, fontWeight: '700', color: '#0D1B2A', flex: 1 },
  count: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 6 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  tabActive: { backgroundColor: '#155EEF', borderColor: '#155EEF' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  tabTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', gap: 8, alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '600', color: '#0D1B2A' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, alignItems: 'center' },
  meta: { fontSize: 12, color: '#6B7280' },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  actions: { flexDirection: 'column', gap: 4 },
  actBtn: { padding: 8, borderRadius: 8, backgroundColor: '#F3F4F6' },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
});
