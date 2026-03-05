import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../src/lib/auth';
import { apiGet, apiUploadFile, API_BASE_URL, getToken } from '../../src/lib/api';
import { AppLogo } from '../../src/components/AppLogo';
import { colors, spacing, radius, typography } from '../../src/theme';

interface Expense {
  id: number;
  description: string;
  amountCents: number;
  category: string;
  roast: string;
  currency: string;
}

interface UploadResult { expense: Expense }

const TONES = [
  { value: 'savage', label: '🔥 Savage' },
  { value: 'playful', label: '😄 Playful' },
  { value: 'supportive', label: '💛 Supportive' },
];

export default function UploadScreen() {
  const { user, refreshUser } = useAuth();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [tone, setTone] = useState('savage');
  const [result, setResult] = useState<Expense | null>(null);
  const [uploading, setUploading] = useState(false);

  const isPremium = user?.tier === 'premium';
  const atLimit = !isPremium && (user?.monthlyUploadCount ?? 0) >= 1;

  const { data: recentRoasts, refetch } = useQuery<Expense[]>({
    queryKey: ['/api/expenses'],
    queryFn: () => apiGet('/api/expenses'),
    enabled: isPremium,
  });

  async function pickImage(from: 'camera' | 'gallery') {
    if (atLimit) {
      Alert.alert('Limit Reached', 'Free plan allows 1 upload per month. Upgrade to Premium for unlimited uploads.');
      return;
    }
    try {
      let res;
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission denied', 'Camera access needed.'); return; }
        res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission denied', 'Photo library access needed.'); return; }
        res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
      }
      if (!res.canceled && res.assets[0]) {
        setImageUri(res.assets[0].uri);
        setResult(null);
      }
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function uploadReceipt() {
    if (!imageUri || uploading) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('receipt', { uri: imageUri, type: 'image/jpeg', name: 'receipt.jpg' } as never);
      fd.append('tone', tone);

      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/expenses/upload`, {
        method: 'POST', headers, body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error((err as { message?: string }).message || 'Upload failed');
      }
      const data = await res.json() as UploadResult;
      setResult(data.expense);
      await refreshUser();
      refetch();
    } catch (e: unknown) {
      Alert.alert('Upload Failed', (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <AppLogo size="xs" />
          <Text style={s.pageTitle}>Receipt Roaster</Text>
        </View>

        {!isPremium && (
          <View style={s.usageBadge}>
            <Ionicons name="flame" size={14} color={colors.primary} />
            <Text style={s.usageText}>
              {user?.monthlyUploadCount ?? 0}/1 free uploads this month
            </Text>
          </View>
        )}

        <View style={s.toneRow}>
          {TONES.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[s.toneChip, tone === t.value && s.toneChipActive]}
              onPress={() => setTone(t.value)}
            >
              <Text style={[s.toneText, tone === t.value && s.toneTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.uploadZone}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={s.preview} resizeMode="cover" />
              <TouchableOpacity style={s.clearBtn} onPress={() => { setImageUri(null); setResult(null); }}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={s.placeholder}>
              <Ionicons name="receipt-outline" size={40} color={colors.textDim} />
              <Text style={s.placeholderText}>No receipt selected</Text>
            </View>
          )}
        </View>

        <View style={s.pickRow}>
          <TouchableOpacity style={[s.pickBtn, { flex: 1 }]} onPress={() => pickImage('camera')} activeOpacity={0.8}>
            <Ionicons name="camera" size={20} color={colors.primary} />
            <Text style={s.pickBtnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.pickBtn, { flex: 1 }]} onPress={() => pickImage('gallery')} activeOpacity={0.8}>
            <Ionicons name="images" size={20} color={colors.primary} />
            <Text style={s.pickBtnText}>Gallery</Text>
          </TouchableOpacity>
        </View>

        {imageUri && (
          <TouchableOpacity
            style={[s.uploadBtn, (uploading || atLimit) && s.uploadBtnDisabled]}
            onPress={uploadReceipt}
            disabled={uploading || atLimit}
            activeOpacity={0.85}
          >
            {uploading ? (
              <ActivityIndicator color="#0D0D0D" />
            ) : (
              <>
                <Ionicons name="flame" size={20} color="#0D0D0D" />
                <Text style={s.uploadBtnText}>Roast This Receipt</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {atLimit && (
          <View style={s.limitBanner}>
            <Ionicons name="lock-closed" size={18} color={colors.primary} />
            <Text style={s.limitText}>
              You've used your free upload. Upgrade to Premium for unlimited roasts.
            </Text>
          </View>
        )}

        {result && (
          <View style={s.roastCard}>
            <Text style={s.roastLabel}>THE ROAST</Text>
            <Text style={s.roastText}>"{result.roast}"</Text>
            <View style={s.roastMeta}>
              <Text style={s.metaText}>{result.description}</Text>
              <Text style={s.metaAmount}>
                {(result.amountCents / 100).toFixed(2)} {result.currency}
              </Text>
            </View>
            <View style={s.categoryChip}>
              <Text style={s.categoryText}>{result.category}</Text>
            </View>
          </View>
        )}

        {isPremium && recentRoasts && recentRoasts.length > 0 && (
          <View style={s.history}>
            <Text style={s.historyTitle}>Recent Roasts</Text>
            {recentRoasts.slice(0, 5).map(exp => (
              <View key={exp.id} style={s.historyItem}>
                <View style={s.historyTop}>
                  <Text style={s.historyDesc} numberOfLines={1}>{exp.description}</Text>
                  <Text style={s.historyAmount}>{(exp.amountCents / 100).toFixed(2)} {exp.currency}</Text>
                </View>
                <Text style={s.historyRoast} numberOfLines={2}>"{exp.roast}"</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  pageTitle: { ...typography.h2 },
  usageBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.primaryDim, borderRadius: radius.full,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(0,230,118,0.15)',
  },
  usageText: { ...typography.caption, color: colors.primary },
  toneRow: { flexDirection: 'row', gap: spacing.sm },
  toneChip: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  toneChipActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  toneText: { ...typography.caption, color: colors.textMuted },
  toneTextActive: { color: colors.primary, fontWeight: '600' },
  uploadZone: {
    height: 200, borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  preview: { width: '100%', height: '100%' },
  clearBtn: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  placeholder: { alignItems: 'center', gap: spacing.sm },
  placeholderText: { ...typography.bodyMuted },
  pickRow: { flexDirection: 'row', gap: spacing.sm },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  pickBtnText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primary,
    paddingVertical: spacing.md, borderRadius: radius.lg,
  },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText: { fontSize: 16, fontWeight: '700', color: '#0D0D0D' },
  limitBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.primaryDim, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)',
  },
  limitText: { ...typography.body, color: colors.text, flex: 1 },
  roastCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(0,230,118,0.25)',
  },
  roastLabel: { ...typography.label, color: colors.primary },
  roastText: { ...typography.body, fontStyle: 'italic', lineHeight: 24, fontSize: 16 },
  roastMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  metaText: { ...typography.bodyMuted, flex: 1 },
  metaAmount: { ...typography.body, fontWeight: '700', color: colors.primary },
  categoryChip: {
    backgroundColor: colors.primaryDim, borderRadius: radius.full,
    paddingVertical: 2, paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
  },
  categoryText: { ...typography.caption, color: colors.primary },
  history: { gap: spacing.sm },
  historyTitle: { ...typography.h3 },
  historyItem: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.xs,
    borderWidth: 1, borderColor: colors.border,
  },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between' },
  historyDesc: { ...typography.body, flex: 1, marginRight: spacing.sm },
  historyAmount: { ...typography.body, fontWeight: '700', color: colors.primary },
  historyRoast: { ...typography.bodyMuted, fontStyle: 'italic' },
});
