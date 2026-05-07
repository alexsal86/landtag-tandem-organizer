import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { SheetShell } from '@/ui/SheetShell';
import { useToast } from '@/ui/Toast';
import { ensurePermission } from '@/lib/permissions';

export function PhotoSheet({
  visible, onClose, userId,
}: { visible: boolean; onClose: () => void; userId: string }): React.JSX.Element {
  const [uri, setUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => { if (!visible) { setUri(null); setCaption(''); } }, [visible]);

  const fromCamera = async () => {
    const ok = await ensurePermission('camera');
    if (!ok) return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!r.canceled && r.assets[0]) setUri(r.assets[0].uri);
  };

  const fromLibrary = async () => {
    const ok = await ensurePermission('mediaLibrary');
    if (!ok) return;
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!r.canceled && r.assets[0]) setUri(r.assets[0].uri);
  };

  const save = async () => {
    if (!uri) return;
    setBusy(true);
    try {
      const fileName = `${userId}/mobile/${Date.now()}.jpg`;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const { error: upErr } = await supabase.storage
        .from('documents')
        .upload(fileName, bytes, { contentType: 'image/jpeg', upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
      const { error: nErr } = await supabase.from('quick_notes').insert({
        user_id: userId,
        title: caption.trim() || 'Foto-Notiz',
        content: `📷 ${caption.trim() || 'Foto'}\n${urlData.publicUrl}`,
        category: 'mobile-photo',
      });
      if (nErr) throw nErr;
      toast.success('Foto gespeichert');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetShell visible={visible} onClose={onClose} title="Foto-Notiz">
      {!uri ? (
        <View style={{ gap: 12 }}>
          <Pressable onPress={fromCamera} style={styles.bigBtn}>
            <Text style={styles.bigBtnText}>📷 Kamera</Text>
          </Pressable>
          <Pressable onPress={fromLibrary} style={[styles.bigBtn, styles.secondaryBtn]}>
            <Text style={[styles.bigBtnText, { color: '#155EEF' }]}>🖼 Aus Galerie wählen</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Image source={{ uri }} style={styles.preview} />
          <TextInput
            placeholder="Beschreibung (optional)"
            value={caption}
            onChangeText={setCaption}
            style={styles.input}
            editable={!busy}
          />
          <Pressable onPress={save} disabled={busy} style={styles.primaryBtn}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Speichern</Text>}
          </Pressable>
          <Pressable onPress={() => setUri(null)} disabled={busy}>
            <Text style={styles.discard}>Anderes Bild wählen</Text>
          </Pressable>
        </>
      )}
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  bigBtn: { backgroundColor: '#155EEF', borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  secondaryBtn: { backgroundColor: '#EEF4FF' },
  bigBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  preview: { width: '100%', height: 240, borderRadius: 12, backgroundColor: '#F1F5F9' },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  primaryBtn: { backgroundColor: '#155EEF', borderRadius: 10, alignItems: 'center', paddingVertical: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  discard: { color: '#6B7280', textAlign: 'center', marginTop: 8 },
});
