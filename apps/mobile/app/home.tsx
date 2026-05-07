import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/state/AuthContext';
import { NoteSheet, TaskSheet } from '@/sheets/SimpleSheets';
import { ContactSearchSheet } from '@/sheets/ContactSearchSheet';
import { VoiceNoteSheet } from '@/sheets/VoiceNoteSheet';
import { CallLogSheet } from '@/sheets/CallLogSheet';
import { AppointmentSheet } from '@/sheets/AppointmentSheet';
import { PhotoSheet } from '@/sheets/PhotoSheet';

type SheetKind = 'note' | 'task' | 'contact' | 'voice' | 'call' | 'appointment' | 'photo' | null;

interface Tile { key: SheetKind; label: string; icon: string }

const TILES: Tile[] = [
  { key: 'note', label: 'Notiz', icon: '📝' },
  { key: 'voice', label: 'Sprachnotiz', icon: '🎙' },
  { key: 'task', label: 'Aufgabe', icon: '✅' },
  { key: 'appointment', label: 'Termin', icon: '📅' },
  { key: 'contact', label: 'Kontakt suchen', icon: '👤' },
  { key: 'call', label: 'Anruf erfassen', icon: '📞' },
  { key: 'photo', label: 'Foto-Notiz', icon: '📷' },
];

export default function HomeScreen(): React.JSX.Element {
  const { session, initializing, tenants, activeTenantId } = useAuth();
  const [sheet, setSheet] = useState<SheetKind>(null);

  useEffect(() => {
    if (!initializing && !session) router.replace('/login');
  }, [initializing, session]);

  if (initializing || !session) {
    return <View style={styles.loading}><ActivityIndicator /></View>;
  }

  const activeTenant = tenants.find((t) => t.id === activeTenantId);
  const initials = (session.user.email ?? '?').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tenantLabel}>Tenant</Text>
          <Text style={styles.tenantName} numberOfLines={1}>{activeTenant?.name ?? '—'}</Text>
        </View>
        <Pressable onPress={() => router.push('/today')} style={styles.iconBtn}>
          <Text style={{ fontSize: 18 }}>📆</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/settings')} style={styles.iconBtn}>
          <Text style={{ fontSize: 18 }}>⚙️</Text>
        </Pressable>
      </View>

      <Text style={styles.h1}>Schnellaktionen</Text>

      <View style={styles.grid}>
        {TILES.map((t) => (
          <Pressable
            key={t.key}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
            onPress={() => setSheet(t.key)}
          >
            <Text style={styles.tileIcon}>{t.icon}</Text>
            <Text style={styles.tileLabel}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <NoteSheet visible={sheet === 'note'} onClose={() => setSheet(null)} userId={session.user.id} />
      <VoiceNoteSheet visible={sheet === 'voice'} onClose={() => setSheet(null)} userId={session.user.id} />
      <TaskSheet visible={sheet === 'task'} onClose={() => setSheet(null)} userId={session.user.id} tenantId={activeTenantId} />
      <AppointmentSheet visible={sheet === 'appointment'} onClose={() => setSheet(null)} userId={session.user.id} tenantId={activeTenantId} />
      <ContactSearchSheet visible={sheet === 'contact'} onClose={() => setSheet(null)} tenantId={activeTenantId} />
      <CallLogSheet visible={sheet === 'call'} onClose={() => setSheet(null)} userId={session.user.id} tenantId={activeTenantId} />
      <PhotoSheet visible={sheet === 'photo'} onClose={() => setSheet(null)} userId={session.user.id} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', padding: 16, alignItems: 'center', gap: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 999, backgroundColor: '#155EEF',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700' },
  tenantLabel: { fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  tenantName: { fontSize: 16, fontWeight: '700', color: '#0D1B2A' },
  iconBtn: { padding: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  h1: { fontSize: 22, fontWeight: '700', color: '#0D1B2A', paddingHorizontal: 16, marginTop: 4, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12 },
  tile: {
    width: '47%', aspectRatio: 1, marginHorizontal: '1.5%', backgroundColor: '#fff',
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', gap: 8,
  },
  tileIcon: { fontSize: 36 },
  tileLabel: { fontSize: 14, fontWeight: '600', color: '#0D1B2A' },
});
