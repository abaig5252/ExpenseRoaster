import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/lib/auth';
import { apiPost, API_BASE_URL } from '../../src/lib/api';
import { AppLogo } from '../../src/components/AppLogo';
import { colors, spacing, radius, typography } from '../../src/theme';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'SGD', 'AED', 'CHF'];

export default function ProfileScreen() {
  const { user, signOut, refreshUser } = useAuth();

  async function manageSubscription() {
    try {
      const data = await apiPost<{ url: string }>('/api/stripe/portal');
      if (data.url) await Linking.openURL(data.url);
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function upgradeToPremiun() {
    try {
      const data = await apiPost<{ url: string }>('/api/stripe/checkout', {
        plan: 'premium',
        mode: 'subscription',
      });
      if (data.url) await Linking.openURL(data.url);
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Expense Roastee';
  const tierLabel = user?.tier === 'premium' ? 'Premium' : 'Free';
  const tierColor = user?.tier === 'premium' ? colors.primary : colors.textMuted;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={s.displayName}>{displayName}</Text>
          {user?.email && <Text style={s.email}>{user.email}</Text>}
          <View style={s.tierBadge}>
            <Ionicons name={user?.tier === 'premium' ? 'star' : 'star-outline'} size={13} color={tierColor} />
            <Text style={[s.tierText, { color: tierColor }]}>{tierLabel}</Text>
          </View>
        </View>

        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statValue}>{user?.monthlyUploadCount ?? 0}</Text>
            <Text style={s.statLabel}>This Month</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statValue}>{user?.currency ?? 'USD'}</Text>
            <Text style={s.statLabel}>Currency</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statValue}>{user?.hasAnnualReport ? '✓' : '—'}</Text>
            <Text style={s.statLabel}>Annual Report</Text>
          </View>
        </View>

        {user?.tier !== 'premium' && (
          <View style={s.upgradeCard}>
            <Ionicons name="star" size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.upgradeTitle}>Upgrade to Premium</Text>
              <Text style={s.upgradeSub}>Unlimited uploads, tracker, bank import • $9.99/mo</Text>
            </View>
            <TouchableOpacity style={s.upgradeBtn} onPress={upgradeToPremiun} activeOpacity={0.85}>
              <Text style={s.upgradeBtnText}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Account</Text>

          {user?.tier === 'premium' && (
            <TouchableOpacity style={s.menuItem} onPress={manageSubscription} activeOpacity={0.7}>
              <Ionicons name="card-outline" size={20} color={colors.textMuted} />
              <Text style={s.menuText}>Manage Subscription</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.menuItem} onPress={() => Linking.openURL(`${API_BASE_URL}/privacy`)} activeOpacity={0.7}>
            <Ionicons name="shield-outline" size={20} color={colors.textMuted} />
            <Text style={s.menuText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </TouchableOpacity>

          <TouchableOpacity style={s.menuItem} onPress={() => Linking.openURL(`${API_BASE_URL}/terms`)} activeOpacity={0.7}>
            <Ionicons name="document-text-outline" size={20} color={colors.textMuted} />
            <Text style={s.menuText}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </TouchableOpacity>

          <TouchableOpacity style={s.menuItem} onPress={() => Linking.openURL(`${API_BASE_URL}/contact`)} activeOpacity={0.7}>
            <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
            <Text style={s.menuText}>Contact Support</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={confirmSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={s.logoFooter}>
          <AppLogo size="xs" />
          <Text style={s.version}>v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl },
  avatarSection: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.primary,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: colors.primary },
  displayName: { ...typography.h2 },
  email: { ...typography.bodyMuted },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  tierText: { ...typography.caption, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xs },
  statValue: { ...typography.h3, color: colors.primary },
  statLabel: { ...typography.caption },
  statDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  upgradeCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.primaryDim, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)',
  },
  upgradeTitle: { ...typography.body, fontWeight: '700', color: colors.primary },
  upgradeSub: { ...typography.caption },
  upgradeBtn: {
    backgroundColor: colors.primary, paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md, borderRadius: radius.md,
  },
  upgradeBtnText: { fontSize: 13, fontWeight: '700', color: '#0D0D0D' },
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.label, marginBottom: spacing.xs },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  menuText: { ...typography.body, flex: 1 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,77,77,0.2)',
  },
  signOutText: { ...typography.body, color: colors.error, fontWeight: '600' },
  logoFooter: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  version: { ...typography.caption },
});
