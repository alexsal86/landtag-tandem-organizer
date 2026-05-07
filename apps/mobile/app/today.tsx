import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/AuthContext';

interface Appt {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  category: string | null;
}
interface Briefing {
  id: string;
  title: string;
  content: string | null;
  briefing_date: string;
}

const WEB_BASE = 'https://id-preview--7d09a65d-5cbe-421b-a580-38a4fe244277.lovable.app';

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function TodayScreen(): React.JSX.Element {
  const { session, activeTenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [briefings, setBriefings] = useState<Briefing[]>([]);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);

    const apptQ = supabase
      .from('appointments')
      .select('id,title,start_time,end_time,location,category')
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString())
      .order('start_time', { ascending: true });

    const briefQ = supabase
      .from('daily_briefings')
      .select('id,title,content,briefing_date')
      .eq('briefing_date', start.toISOString().slice(0, 10))
      .order('updated_at', { ascending: false })
      .limit(3);

    const [{ data: a, error: ae }, { data: b, error: be }] = await Promise.all([apptQ, briefQ]);
    if (!ae && a) setAppts(a as Appt[]);
    if (!be && b) setBriefings(b as Briefing[]);
    setLoading(false);
    setRefreshing(false);
  }, [session?.user.id, activeTenantId]);

  useEffect(() => { void load(); }, [load]);

  const openInWeb = (path: string) => {
    void Linking.openURL(`${WEB_BASE}${path}`);
  };

  if (!session) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/home')} style={styles.back}>
          <Text style={styles.backText}>‹ Start</Text>
        </Pressable>
        <Text style={styles.h1}>Heute</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={appts}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void load(); }}
            />
          }
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 8 }}>
              {briefings.length > 0 && (
                <View>
                  <Text style={styles.section}>Tagesbriefing</Text>
                  {briefings.map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() => openInWeb(`/briefings/${b.id}`)}
                      style={styles.briefCard}
                    >
                      <Text style={styles.briefTitle}>{b.title}</Text>
                      {b.content ? (
                        <Text style={styles.briefBody} numberOfLines={3}>
                          {b.content.replace(/<[^>]+>/g, '').trim()}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              )}
              <Text style={styles.section}>Termine heute</Text>
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Keine Termine heute.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openInWeb(`/calendar?date=${item.start_time.slice(0, 10)}&highlight=${item.id}`)}
              style={({ pressed }) => [styles.appt, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.apptTime}>
                {fmtTime(item.start_time)}{item.end_time ? `–${fmtTime(item.end_time)}` : ''}
              </Text>
              <Text style={styles.apptTitle} numberOfLines={2}>{item.title}</Text>
              {item.location ? <Text style={styles.apptMeta}>📍 {item.location}</Text> : null}
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
  back: { padding: 6 },
  backText: { color: '#155EEF', fontSize: 16, fontWeight: '600' },
  h1: { fontSize: 22, fontWeight: '700', color: '#0D1B2A' },
  section: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  briefCard: { backgroundColor: '#EEF4FF', borderRadius: 12, padding: 12, marginBottom: 8 },
  briefTitle: { fontSize: 15, fontWeight: '700', color: '#0D1B2A' },
  briefBody: { fontSize: 13, color: '#374151', marginTop: 4 },
  appt: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  apptTime: { fontSize: 12, fontWeight: '700', color: '#155EEF', marginBottom: 4 },
  apptTitle: { fontSize: 15, fontWeight: '600', color: '#0D1B2A' },
  apptMeta: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
});
