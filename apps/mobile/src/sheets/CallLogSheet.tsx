import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { SheetShell } from '@/ui/SheetShell';
import { useToast } from '@/ui/Toast';

interface ContactRow { id: string; name: string }

export function CallLogSheet({
  visible, onClose, userId, tenantId,
}: { visible: boolean; onClose: () => void; userId: string; tenantId: string | null }): React.JSX.Element {
  const [contactQuery, setContactQuery] = useState('');
  const [results, setResults] = useState<ContactRow[]>([]);
  const [contact, setContact] = useState<ContactRow | null>(null);
  const [callerName, setCallerName] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('outgoing');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!visible) {
      setContact(null); setContactQuery(''); setResults([]);
      setCallerName(''); setCallerPhone(''); setDirection('outgoing');
      setDuration(''); setNotes(''); setFollowUp(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || contact || !tenantId) return;
    const term = contactQuery.trim();
    if (term.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id,name')
        .eq('tenant_id', tenantId)
        .ilike('name', `%${term}%`)
        .limit(8);
      setResults((data ?? []) as ContactRow[]);
    }, 250);
    return () => clearTimeout(t);
  }, [contactQuery, visible, contact, tenantId]);

  const save = async () => {
    if (!tenantId) { toast.error('Tenant fehlt'); return; }
    if (!contact && !callerPhone.trim() && !callerName.trim()) {
      toast.error('Kontakt oder Name/Nummer angeben');
      return;
    }
    setBusy(true);
    const { data: profile } = await supabase
      .from('profiles').select('display_name').eq('user_id', userId).eq('tenant_id', tenantId).maybeSingle();
    const dur = parseInt(duration, 10);
    const { error } = await supabase.from('call_logs').insert({
      user_id: userId,
      tenant_id: tenantId,
      contact_id: contact?.id ?? null,
      caller_name: contact ? null : (callerName.trim() || null),
      caller_phone: contact ? null : (callerPhone.trim() || null),
      call_type: direction,
      duration_minutes: Number.isFinite(dur) && dur > 0 ? dur : null,
      notes: notes.trim() || null,
      follow_up_required: followUp,
      created_by_name: profile?.display_name ?? null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Anruf erfasst');
    onClose();
  };

  return (
    <SheetShell visible={visible} onClose={onClose} title="Anruf erfassen">
      {!contact ? (
        <>
          <Text style={styles.label}>Kontakt suchen</Text>
          <TextInput
            placeholder="Name…"
            value={contactQuery}
            onChangeText={setContactQuery}
            style={styles.input}
          />
          {results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(i) => i.id}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 180 }}
              renderItem={({ item }) => (
                <Pressable onPress={() => setContact(item)} style={styles.row}>
                  <Text style={styles.rowText}>{item.name}</Text>
                </Pressable>
              )}
            />
          ) : null}
          <Text style={styles.divider}>oder unbekannte Nummer</Text>
          <TextInput placeholder="Anrufer-Name" value={callerName} onChangeText={setCallerName} style={styles.input} />
          <TextInput placeholder="Telefonnummer" value={callerPhone} onChangeText={setCallerPhone} keyboardType="phone-pad" style={styles.input} />
        </>
      ) : (
        <View style={styles.contactPill}>
          <Text style={styles.contactPillText}>{contact.name}</Text>
          <Pressable onPress={() => setContact(null)}><Text style={styles.changeLink}>Ändern</Text></Pressable>
        </View>
      )}

      <View style={styles.directionRow}>
        {(['outgoing', 'incoming'] as const).map((d) => (
          <Pressable
            key={d}
            onPress={() => setDirection(d)}
            style={[styles.dirBtn, direction === d && styles.dirBtnActive]}
          >
            <Text style={[styles.dirText, direction === d && styles.dirTextActive]}>
              {d === 'outgoing' ? '↗ Ausgehend' : '↙ Eingehend'}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput placeholder="Dauer (Min., optional)" value={duration} onChangeText={setDuration} keyboardType="number-pad" style={styles.input} />
      <TextInput
        placeholder="Notizen"
        value={notes}
        onChangeText={setNotes}
        multiline
        style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
      />
      <View style={styles.switchRow}>
        <Text style={styles.label}>Follow-up nötig</Text>
        <Switch value={followUp} onValueChange={setFollowUp} />
      </View>

      <Pressable onPress={save} disabled={busy} style={styles.primaryBtn}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Speichern</Text>}
      </Pressable>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  rowText: { fontSize: 15, color: '#0D1B2A' },
  divider: { textAlign: 'center', color: '#6B7280', fontSize: 12, marginVertical: 6 },
  contactPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EEF4FF', padding: 12, borderRadius: 10,
  },
  contactPillText: { fontSize: 15, fontWeight: '600', color: '#0D1B2A' },
  changeLink: { color: '#155EEF', fontWeight: '600' },
  directionRow: { flexDirection: 'row', gap: 8 },
  dirBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' },
  dirBtnActive: { backgroundColor: '#155EEF', borderColor: '#155EEF' },
  dirText: { color: '#1F2937', fontWeight: '600' },
  dirTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryBtn: { backgroundColor: '#155EEF', borderRadius: 10, alignItems: 'center', paddingVertical: 12, marginTop: 'auto' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
});
