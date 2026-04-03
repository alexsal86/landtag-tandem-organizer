import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { LoginScreen } from '@/screens/LoginScreen';

export default function IndexScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Text style={styles.title}>Landtag Mobile</Text>
        <Text style={styles.subtitle}>Startpunkt für die native App (Android + iOS).</Text>
        <LoginScreen />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0D1B2A',
  },
  subtitle: {
    fontSize: 15,
    color: '#415A77',
    marginBottom: 8,
  },
});
