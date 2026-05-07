import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export function SheetShell({
  visible, onClose, title, children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose}><Text style={styles.close}>Schließen</Text></Pressable>
        </View>
        <View style={styles.body}>{children}</View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E5E7EB',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#0D1B2A' },
  close: { color: '#155EEF', fontWeight: '600' },
  body: { padding: 16, gap: 12, flex: 1 },
});
