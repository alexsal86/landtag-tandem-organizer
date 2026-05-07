import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { SheetShell } from '@/ui/SheetShell';
import { useToast } from '@/ui/Toast';
import { ensurePermission } from '@/lib/permissions';
import { enqueue, flushOutbox } from '@/lib/offlineOutbox';

export function VoiceNoteSheet({
  visible, onClose, userId,
}: { visible: boolean; onClose: () => void; userId: string }): React.JSX.Element {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!visible) {
      stopAndCleanup();
      setUri(null); setTitle(''); setSeconds(0);
    }
    return () => { void stopAndCleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const stopAndCleanup = async () => {
    if (interval.current) { clearInterval(interval.current); interval.current = null; }
    if (recording) {
      try { await recording.stopAndUnloadAsync(); } catch { /* noop */ }
    }
  };

  const start = async () => {
    const ok = await ensurePermission('microphone');
    if (!ok) return;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await rec.startAsync();
    setRecording(rec);
    setSeconds(0);
    interval.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stop = async () => {
    if (!recording) return;
    if (interval.current) { clearInterval(interval.current); interval.current = null; }
    await recording.stopAndUnloadAsync();
    const u = recording.getURI();
    setRecording(null);
    setUri(u);
  };

  const save = async () => {
    if (!uri) return;
    setBusy(true);
    try {
      const fileName = `${userId}/quicknotes/${Date.now()}.m4a`;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

      // Try transcription (best-effort, falls back to length placeholder)
      let transcript = '';
      try {
        const { data, error } = await supabase.functions.invoke('transcribe-voice-note', {
          body: { audioBase64: base64, mimeType: 'audio/m4a', language: 'de' },
        });
        if (!error && data && typeof (data as { text?: string }).text === 'string') {
          transcript = (data as { text: string }).text.trim();
        }
      } catch {
        // offline → leave transcript empty, will sync later
      }

      const noteContent = transcript
        ? `🎙 Sprachnotiz (${seconds}s)\n\n${transcript}\n\nstorage://audio-recordings/${fileName}`
        : `🎙 Sprachnotiz (${seconds}s)\nstorage://audio-recordings/${fileName}`;
      const noteTitle = title.trim() || (transcript ? transcript.slice(0, 60) : `Sprachnotiz (${seconds}s)`);

      try {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const { error: upErr } = await supabase.storage
          .from('audio-recordings')
          .upload(fileName, bytes, { contentType: 'audio/m4a', upsert: false });
        if (upErr) throw upErr;
        const { error: nErr } = await supabase.from('quick_notes').insert({
          user_id: userId,
          title: noteTitle,
          content: noteContent,
          category: 'mobile-voice',
        });
        if (nErr) throw nErr;
        toast.success('Sprachnotiz gespeichert');
      } catch (uploadErr) {
        // Offline / upload failed → enqueue text-only note for later sync
        await enqueue('quick_note', {
          user_id: userId,
          title: noteTitle,
          content: noteContent,
          category: 'mobile-voice-offline',
        });
        toast.success('Offline gespeichert – Sync bei Verbindung');
        // best-effort flush in background
        void flushOutbox();
        throw uploadErr instanceof Error ? uploadErr : new Error(String(uploadErr));
      }
      onClose();
    } catch (e) {
      // Already enqueued above; only show generic error if neither path worked
      if (e instanceof Error && e.message && !e.message.includes('Offline')) {
        // toast already shown
      }
    } finally {
      setBusy(false);
    }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <SheetShell visible={visible} onClose={onClose} title="Sprachnotiz">
      <View style={styles.timerWrap}>
        <Text style={styles.timer}>{mm}:{ss}</Text>
      </View>
      {!uri ? (
        recording ? (
          <Pressable onPress={stop} style={[styles.recBtn, styles.stopBtn]}>
            <Text style={styles.recBtnText}>■ Stopp</Text>
          </Pressable>
        ) : (
          <Pressable onPress={start} style={styles.recBtn}>
            <Text style={styles.recBtnText}>● Aufnahme starten</Text>
          </Pressable>
        )
      ) : (
        <>
          <TextInput
            placeholder="Titel (optional)"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            editable={!busy}
          />
          <Pressable onPress={save} disabled={busy} style={styles.saveBtn}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Speichern</Text>}
          </Pressable>
          <Pressable onPress={() => { setUri(null); setSeconds(0); }} disabled={busy}>
            <Text style={styles.discard}>Verwerfen & neu aufnehmen</Text>
          </Pressable>
        </>
      )}
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  timerWrap: { alignItems: 'center', paddingVertical: 24 },
  timer: { fontSize: 56, fontWeight: '700', fontVariant: ['tabular-nums'], color: '#0D1B2A' },
  recBtn: { backgroundColor: '#DC2626', borderRadius: 999, paddingVertical: 18, alignItems: 'center' },
  stopBtn: { backgroundColor: '#0D1B2A' },
  recBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  saveBtn: { backgroundColor: '#155EEF', borderRadius: 10, alignItems: 'center', paddingVertical: 12 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  discard: { color: '#6B7280', textAlign: 'center', marginTop: 8 },
});
