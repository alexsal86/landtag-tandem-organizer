import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import {
  Sparkles,
  Mic,
  Phone,
  Calendar,
  Camera,
  CheckSquare,
  FileText,
  Fingerprint,
  ShieldCheck,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

type Slide = {
  id: string;
  icon: LucideIcon;
  accent: string;
  title: string;
  body: string;
  preview?: { icon: LucideIcon; label: string }[];
};

const SLIDES: Slide[] = [
  {
    id: 'welcome',
    icon: Sparkles,
    accent: '#6366F1',
    title: 'Dein Büro in der Tasche',
    body: 'Mobile Erfassung für dein Abgeordnetenbüro – damit unterwegs nichts mehr verloren geht.',
  },
  {
    id: 'capture',
    icon: Mic,
    accent: '#8B5CF6',
    title: 'Schnell erfassen',
    body: 'Sprachnotiz, Anruf, Termin, Foto, Aufgabe oder Notiz – mit zwei Tipps in deine Akten.',
    preview: [
      { icon: Mic, label: 'Sprache' },
      { icon: Phone, label: 'Anruf' },
      { icon: Calendar, label: 'Termin' },
      { icon: Camera, label: 'Foto' },
      { icon: CheckSquare, label: 'Aufgabe' },
      { icon: FileText, label: 'Notiz' },
    ],
  },
  {
    id: 'auth',
    icon: Fingerprint,
    accent: '#10B981',
    title: 'Sicher & nahtlos',
    body: 'Beim ersten Mal mit Magic Link oder Passwort. Danach reicht Face ID oder Fingerabdruck.',
  },
  {
    id: 'permissions',
    icon: ShieldCheck,
    accent: '#F59E0B',
    title: 'Berechtigungen on demand',
    body: 'Mikrofon, Kamera und Fotos werden erst angefragt, wenn du eine entsprechende Aktion startest.',
  },
];

export default function OnboardingScreen(): React.JSX.Element {
  const [index, setIndex] = useState(0);
  const ref = useRef<FlatList<Slide>>(null);
  const iconAnim = useRef(new Animated.Value(1)).current;
  const textAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    iconAnim.setValue(0);
    textAnim.setValue(0);
    Animated.parallel([
      Animated.spring(iconAnim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 60 }),
      Animated.timing(textAnim, { toValue: 1, duration: 350, delay: 100, useNativeDriver: true }),
    ]).start();
  }, [index, iconAnim, textAnim]);

  const finish = async () => {
    await SecureStore.setItemAsync('landtag.onboardingDone', '1');
    router.replace('/');
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      const ni = index + 1;
      setIndex(ni);
      ref.current?.scrollToIndex({ index: ni, animated: true });
    } else {
      finish();
    }
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <LinearGradient colors={['#1E40AF', '#155EEF']} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Progress */}
        <View style={styles.progress}>
          {SLIDES.map((s, i) => (
            <View key={s.id} style={[styles.progressSeg, i <= index && styles.progressSegActive]} />
          ))}
        </View>

        <Pressable onPress={finish} style={styles.skip} hitSlop={12}>
          <Text style={styles.skipText}>Überspringen</Text>
        </Pressable>

        <FlatList
          ref={ref}
          data={SLIDES}
          keyExtractor={(s) => s.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item, index: i }) => {
            const Icon = item.icon;
            const active = i === index;
            return (
              <View style={[styles.slide, { width }]}>
                <Animated.View
                  style={[
                    styles.iconBadge,
                    {
                      backgroundColor: item.accent,
                      opacity: active ? iconAnim : 1,
                      transform: [
                        {
                          scale: active
                            ? iconAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] })
                            : 1,
                        },
                      ],
                    },
                  ]}
                >
                  <Icon size={48} color="#fff" strokeWidth={2} />
                </Animated.View>

                <Animated.View style={{ opacity: active ? textAnim : 1, alignItems: 'center' }}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.body}>{item.body}</Text>
                </Animated.View>

                {item.preview ? (
                  <Animated.View style={[styles.previewGrid, { opacity: active ? textAnim : 1 }]}>
                    {item.preview.map((p) => {
                      const PIcon = p.icon;
                      return (
                        <View key={p.label} style={styles.previewTile}>
                          <PIcon size={22} color="#fff" strokeWidth={2} />
                          <Text style={styles.previewLabel}>{p.label}</Text>
                        </View>
                      );
                    })}
                  </Animated.View>
                ) : null}
              </View>
            );
          }}
        />

        <Pressable onPress={next} style={styles.cta}>
          <Text style={styles.ctaText}>{isLast ? 'Loslegen' : 'Weiter'}</Text>
          <ChevronRight size={20} color="#155EEF" strokeWidth={2.5} />
        </Pressable>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  progress: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  progressSeg: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressSegActive: { backgroundColor: '#fff' },
  skip: { position: 'absolute', top: 8, right: 16, padding: 12, zIndex: 10 },
  skipText: { color: 'rgba(255,255,255,0.75)', fontWeight: '600', fontSize: 14 },
  slide: { paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center', flex: 1 },
  iconBadge: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 32,
    maxWidth: 280,
  },
  previewTile: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  previewLabel: { color: '#fff', fontSize: 11, fontWeight: '500' },
  cta: {
    marginHorizontal: 24,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ctaText: { color: '#155EEF', fontWeight: '700', fontSize: 16 },
});
