import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { SheetShell } from '@/ui/SheetShell';
import { useToast } from '@/ui/Toast';
import { ensurePermission } from '@/lib/permissions';

type OcrKind = 'contact' | 'letter' | 'unknown';
interface OcrResult {
  kind: OcrKind;
  contact?: Record<string, string>;
  letter?: Record<string, string>;
  confidence?: number;
}

export function PhotoSheet({
  visible, onClose, userId,
}: { visible: boolean; onClose: () => void; userId: string }): React.JSX.Element {
  const [uri, setUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [ocrEnabled, setOcrEnabled] = useState(true);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!visible) { setUri(null); setCaption(''); setOcr(null); }
  }, [visible]);

  const fromCamera = async () => {
    const ok = await ensurePermission('camera');
    if (!ok) return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!r.canceled && r.assets[0]) { setUri(r.assets[0].uri); setOcr(null); }
  };

  const fromLibrary = async () => {
    const ok = await ensurePermission('mediaLibrary');
    if (!ok) return;
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!r.canceled && r.assets[0]) { setUri(r.assets[0].uri); setOcr(null); }
  };

  const runOcr = async (imageBase64: string): Promise<OcrResult | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('extract-photo-data', {
        body: { imageBase64, mimeType: 'image/jpeg', mode: 'auto' },
      });
      if (error) throw error;
      const payload = (data as { ok?: boolean; data?: OcrResult })?.data ?? null;
      return payload;
    } catch (e) {
      console.warn('OCR failed', e);
      return null;
    }
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

      // Best-effort OCR
      let ocrResult: OcrResult | null = null;
      if (ocrEnabled) {
        ocrResult = await runOcr(base64);
        setOcr(ocrResult);
      }

      // Auto-Anlage Kontakt
      if (ocrResult?.kind === 'contact' && ocrResult.contact) {
        const c = ocrResult.contact;
        const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.organization || 'Visitenkarte';
        const { error: cErr } = await supabase.from('contacts').insert({
          user_id: userId,
          name: fullName,
          email: c.email || null,
          phone: c.phone || c.mobile || null,
          organization: c.organization || null,
          role: c.role || null,
          category: 'stakeholder',
          notes: [c.notes, `Aus Visitenkarte: ${urlData.publicUrl}`].filter(Boolean).join('\n'),
        } as never);
        if (cErr) console.warn('Kontakt konnte nicht angelegt werden', cErr);
      }

      const ocrSummary = ocrResult?.kind === 'contact'
        ? `\nErkannt: Visitenkarte (${ocrResult.contact?.first_name ?? ''} ${ocrResult.contact?.last_name ?? ''})`
        : ocrResult?.kind === 'letter'
        ? `\nErkannt: Brief – ${ocrResult.letter?.subject ?? ''}`
        : '';

      const { error: nErr } = await supabase.from('quick_notes').insert({
        user_id: userId,
        title: caption.trim() || (ocrResult?.kind === 'letter' ? 'Brief-Foto' : 'Foto-Notiz'),
        content: `📷 ${caption.trim() || 'Foto'}\n${urlData.publicUrl}${ocrSummary}`,
        category: ocrResult?.kind === 'contact' ? 'mobile-photo-card' : 'mobile-photo',
      });
      if (nErr) throw nErr;
      toast.success(ocrResult?.kind === 'contact' ? 'Kontakt angelegt' : 'Foto gespeichert');
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
          <View style={styles.row}>
            <Text style={styles.rowLabel}>OCR (Visitenkarte/Brief)</Text>
            <Switch value={ocrEnabled} onValueChange={setOcrEnabled} disabled={busy} />
          </View>
          {ocr ? (
            <Text style={styles.ocrHint}>
              Erkannt: {ocr.kind === 'contact' ? 'Visitenkarte' : ocr.kind === 'letter' ? 'Brief' : 'Unbekannt'}
            </Text>
          ) : null}
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: '#374151', fontSize: 14 },
  ocrHint: { color: '#155EEF', fontSize: 13, fontStyle: 'italic' },
});
