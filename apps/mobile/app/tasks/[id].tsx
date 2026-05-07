import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/AuthContext';
import { useToast } from '@/ui/Toast';

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  status: string | null;
  due_date: string | null;
  category: string | null;
  assigned_to: string | null;
}
interface Member { user_id: string; display_name: string | null }

export default function TaskDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('tasks')
      .select('id,title,description,priority,status,due_date,category,assigned_to')
      .eq('id', id)
      .maybeSingle();
    setTask((data as TaskDetail) ?? null);
    if (activeTenantId) {
      const { data: tu } = await supabase
        .from('tenant_users')
        .select('user_id')
        .eq('tenant_id', activeTenantId)
        .eq('active', true);
      const userIds = (tu ?? []).map((r) => (r as { user_id: string }).user_id);
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);
        setMembers((profs ?? []) as Member[]);
      }
    }
    setLoading(false);
  }, [id, activeTenantId]);

  useEffect(() => { void load(); }, [load]);

  const setStatus = async (status: string) => {
    if (!task) return;
    setTask({ ...task, status });
    await supabase.from('tasks').update({ status }).eq('id', task.id);
    toast.show(`Status: ${status}`, 'success');
  };

  const snooze = async (hours: number) => {
    if (!task) return;
    const due = new Date(); due.setHours(due.getHours() + hours);
    setTask({ ...task, due_date: due.toISOString() });
    await supabase.from('tasks').update({ due_date: due.toISOString() }).eq('id', task.id);
    toast.show('Verschoben', 'success');
  };

  const delegate = async (userId: string) => {
    if (!task) return;
    setTask({ ...task, assigned_to: userId });
    await supabase.from('tasks').update({ assigned_to: userId }).eq('id', task.id);
    toast.show('Delegiert', 'success');
  };

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!task) return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Zurück</Text></Pressable></View>
      <Text style={styles.empty}>Aufgabe nicht gefunden.</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Zurück</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={styles.title}>{task.title}</Text>
        <View style={styles.metaRow}>
          {task.status ? <Text style={styles.chip}>{task.status}</Text> : null}
          {task.priority ? <Text style={styles.chip}>{task.priority}</Text> : null}
          {task.category ? <Text style={styles.chip}>{task.category}</Text> : null}
          {task.due_date ? <Text style={styles.chip}>📅 {new Date(task.due_date).toLocaleString('de-DE')}</Text> : null}
        </View>
        {task.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Beschreibung</Text>
            <Text style={styles.body}>{task.description}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Aktionen</Text>
          <View style={styles.btnRow}>
            <Pressable onPress={() => setStatus('completed')} style={[styles.btn, styles.btnPrimary]}>
              <Text style={styles.btnPrimaryText}>✅ Erledigen</Text>
            </Pressable>
            <Pressable onPress={() => setStatus('in_progress')} style={styles.btn}>
              <Text style={styles.btnText}>▶ In Arbeit</Text>
            </Pressable>
          </View>
          <View style={styles.btnRow}>
            <Pressable onPress={() => snooze(1)} style={styles.btn}><Text style={styles.btnText}>+1 h</Text></Pressable>
            <Pressable onPress={() => snooze(8)} style={styles.btn}><Text style={styles.btnText}>Heute Abend</Text></Pressable>
            <Pressable onPress={() => snooze(24)} style={styles.btn}><Text style={styles.btnText}>Morgen</Text></Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Delegieren an</Text>
          {members.map((m) => (
            <Pressable key={m.user_id} onPress={() => delegate(m.user_id)} style={styles.memberRow}>
              <Text style={styles.memberName}>{m.display_name ?? m.user_id.slice(0, 8)}</Text>
              {task.assigned_to === m.user_id ? <Text style={styles.assignedDot}>●</Text> : null}
            </Pressable>
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
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { fontSize: 12, fontWeight: '600', color: '#374151', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { fontSize: 14, color: '#0D1B2A', lineHeight: 20 },
  btnRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F3F4F6', flexGrow: 1, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#155EEF' },
  btnText: { color: '#0D1B2A', fontWeight: '600' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  memberName: { fontSize: 14, color: '#0D1B2A' },
  assignedDot: { color: '#155EEF', fontSize: 16 },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
});
