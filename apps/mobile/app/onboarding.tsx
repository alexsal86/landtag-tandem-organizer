import { useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

const SLIDES = [
  { icon: '⚡', title: 'Schnell erfassen', body: 'Notizen, Aufgaben, Termine, Anrufe – mit zwei Tipps in deine Akten.' },
  { icon: '🔒', title: 'Sicher anmelden', body: 'Beim ersten Mal mit E-Mail oder Magic Link, danach per Face ID oder Fingerabdruck.' },
  { icon: '🎙', title: 'Berechtigungen', body: 'Wir fragen Mikrofon, Kamera und Fotos nur, wenn du eine entsprechende Aktion startest.' },
];

export default function OnboardingScreen(): React.JSX.Element {
  const [index, setIndex] = useState(0);
  const ref = useRef<FlatList>(null);

  const finish = async () => {
    await SecureStore.setItemAsync('landtag.onboardingDone', '1');
    router.replace('/login');
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      const nextIndex = index + 1;
      setIndex(nextIndex);
      ref.current?.scrollToIndex({ index: nextIndex, animated: true });
    } else {
      finish();
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={finish} style={styles.skip}><Text style={styles.skipText}>Überspringen</Text></Pressable>
      <FlatList
        ref={ref}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      <Pressable onPress={next} style={styles.cta}>
        <Text style={styles.ctaText}>{index === SLIDES.length - 1 ? 'Los geht’s' : 'Weiter'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#155EEF', paddingTop: 60, paddingBottom: 40 },
  skip: { position: 'absolute', top: 50, right: 16, padding: 8, zIndex: 10 },
  skipText: { color: '#fff', opacity: 0.85, fontWeight: '600' },
  slide: { paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center', flex: 1 },
  icon: { fontSize: 80, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 12 },
  body: { fontSize: 16, color: '#E0E7FF', textAlign: 'center', lineHeight: 22 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 20 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#fff', width: 24 },
  cta: { marginHorizontal: 24, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#155EEF', fontWeight: '700', fontSize: 16 },
});
