import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { SheetShell } from '@/ui/SheetShell';
import { useToast } from '@/ui/Toast';

const DURATIONS = [15, 30, 60, 90];

export function AppointmentSheet({
  visible, onClose, userId, tenantId,
}: { visible: boolean; onClose: () => void; userId: string; tenantId: string | null }): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d;
  });
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState('');
  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!visible) { setTitle(''); setLocation(''); setDuration(60); setShowPicker(null); }
  }, [visible]);

  const save = async () => {
    if (!title.trim()) { toast.error('Titel fehlt'); return; }
    if (!tenantId) { toast.error('Tenant fehlt'); return; }
    setBusy(true);
    const end = new Date(start.getTime() + duration * 60_000);
    const { error } = await supabase.from('appointments').insert({
      user_id: userId,
      tenant_id: tenantId,
      title: title.trim(),
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      location: location.trim() || null,
      category: 'meeting',
      status: 'planned',
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Termin angelegt');
    onClose();
  };

  const dateLabel = start.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeLabel = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <SheetShell visible={visible} onClose={onClose} title="Neuer Termin">
      <TextInput placeholder="Titel" value={title} onChangeText={setTitle} style={styles.input} />

      <View style={styles.row}>
        <Pressable onPress={() => setShowPicker('date')} style={[styles.input, styles.dateBtn]}>
          <Text style={styles.dateText}>{dateLabel}</Text>
        </Pressable>
        <Pressable onPress={() => setShowPicker('time')} style={[styles.input, styles.dateBtn]}>
          <Text style={styles.dateText}>{timeLabel}</Text>
        </Pressable>
      </View>

      {showPicker ? (
        <DateTimePicker
          value={start}
          mode={showPicker}
          is24Hour
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, d) => {
            if (Platform.OS !== 'ios') setShowPicker(null);
            if (d) setStart(d);
          }}
        />
      ) : null}

      <Text style={styles.label}>Dauer</Text>
      <View style={styles.chips}>
        {DURATIONS.map((d) => (
          <Pressable
            key={d}
            onPress={() => setDuration(d)}
            style={[styles.chip, duration === d && styles.chipActive]}
          >
            <Text style={[styles.chipText, duration === d && styles.chipTextActive]}>{d} Min</Text>
          </Pressable>
        ))}
      </View>

      <TextInput placeholder="Ort (optional)" value={location} onChangeText={setLocation} style={styles.input} />

      <Pressable onPress={save} disabled={busy} style={styles.primaryBtn}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Termin anlegen</Text>}
      </Pressable>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  row: { flexDirection: 'row', gap: 8 },
  dateBtn: { flex: 1, justifyContent: 'center' },
  dateText: { fontSize: 15, color: '#0D1B2A' },
  label: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#D1D5DB' },
  chipActive: { backgroundColor: '#155EEF', borderColor: '#155EEF' },
  chipText: { color: '#1F2937', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  primaryBtn: { backgroundColor: '#155EEF', borderRadius: 10, alignItems: 'center', paddingVertical: 12, marginTop: 'auto' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
});
