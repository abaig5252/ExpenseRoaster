import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../src/lib/auth';
import { apiGet, apiPost, API_BASE_URL } from '../../src/lib/api';
import { colors, spacing, radius, typography } from '../../src/theme';

interface AnnualReport {
  year: number;
  totalSpent: number;
  currency: string;
  topCategory: string;
  roast: string;
  advice: string;
  monthlyBreakdown: Array<{ month: string; totalCents: number }>;
}

export default function AnnualScreen() {
  const { user, refreshUser } = useAuth();
  const [purchasing, setPurchasing] = useState(false);

  const hasAccess = user?.hasAnnualReport;

  const { data: report, isLoading } = useQuery<AnnualReport>({
    queryKey: ['/api/expenses/financial-advice'],
    queryFn: () => apiGet('/api/expenses/financial-advice'),
    enabled: hasAccess,
  });

  async function purchaseReport() {
    setPurchasing(true);
    try {
      const data = await apiPost<{ url?: string }>('/api/stripe/checkout', {
        plan: 'annual_report',
        mode: 'payment',
      });
      if (data.url) {
        await Linking.openURL(data.url);
      }
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setPurchasing(false);
    }
  }

  if (!hasAccess) {
    return (
      <SafeAreaView style={s.root}>
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.header}>
            <Ionicons name="trophy" size={40} color={colors.primary} />
            <Text style={s.pageTitle}>Annual Report</Text>
          </View>

          <View style={s.promoCard}>
            <Text style={s.promoTitle}>Your Year in Shame</Text>
            <Text style={s.promoSub}>
              Get a brutally honest AI-powered breakdown of your entire year's spending habits — complete with roasts, insights, and financial advice.
            </Text>

            <View style={s.featureList}>
              {[
                'Full year spending analysis',
                'Category-by-category breakdown',
                'Your biggest splurges',
                'Personalized AI roast of your year',
                'Actionable financial advice',
              ].map(f => (
                <View key={f} style={s.feature}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={s.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            <View style={s.priceRow}>
              <Text style={s.price}>$29.99</Text>
              <Text style={s.priceNote}>one-time payment</Text>
            </View>

            <TouchableOpacity
              style={s.purchaseBtn}
              onPress={purchaseReport}
              disabled={purchasing}
              activeOpacity={0.85}
            >
              {purchasing ? <ActivityIndicator color="#0D0D0D" /> : (
                <>
                  <Ionicons name="trophy" size={20} color="#0D0D0D" />
                  <Text style={s.purchaseBtnText}>Get My Annual Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={typography.bodyMuted}>Generating your annual roast…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Ionicons name="trophy" size={32} color={colors.primary} />
          <Text style={s.pageTitle}>Annual Report</Text>
        </View>

        {report && (
          <>
            <View style={s.summaryCard}>
              <Text style={s.summaryLabel}>Total Spent {new Date().getFullYear()}</Text>
              <Text style={s.summaryAmount}>
                {(report.totalSpent / 100).toFixed(2)} {report.currency}
              </Text>
              {report.topCategory && (
                <View style={s.topCatRow}>
                  <Ionicons name="flame" size={14} color={colors.primary} />
                  <Text style={s.topCatText}>Biggest weakness: {report.topCategory}</Text>
                </View>
              )}
            </View>

            <View style={s.roastCard}>
              <Text style={s.roastLabel}>YOUR YEAR IN A ROAST</Text>
              <Text style={s.roastText}>"{report.roast}"</Text>
            </View>

            <View style={s.adviceCard}>
              <View style={s.adviceHeader}>
                <Ionicons name="bulb-outline" size={18} color={colors.primary} />
                <Text style={s.adviceTitle}>Financial Advice</Text>
              </View>
              <Text style={s.adviceText}>{report.advice}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pageTitle: { ...typography.h2 },
  promoCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.lg,
    borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)',
  },
  promoTitle: { ...typography.h2, textAlign: 'center' },
  promoSub: { ...typography.bodyMuted, textAlign: 'center', lineHeight: 22 },
  featureList: { gap: spacing.sm },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  featureText: { ...typography.body, flex: 1 },
  priceRow: { alignItems: 'center', gap: spacing.xs },
  price: { fontSize: 40, fontWeight: '800', color: colors.primary },
  priceNote: { ...typography.bodyMuted },
  purchaseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.lg,
  },
  purchaseBtnText: { fontSize: 16, fontWeight: '700', color: '#0D0D0D' },
  summaryCard: {
    backgroundColor: colors.primaryDim, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)',
  },
  summaryLabel: { ...typography.label, color: colors.primary },
  summaryAmount: { fontSize: 36, fontWeight: '800', color: colors.primary },
  topCatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  topCatText: { ...typography.bodyMuted },
  roastCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(0,230,118,0.25)',
  },
  roastLabel: { ...typography.label, color: colors.primary },
  roastText: { ...typography.body, fontStyle: 'italic', lineHeight: 26, fontSize: 17 },
  adviceCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  adviceHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  adviceTitle: { ...typography.h3, color: colors.primary },
  adviceText: { ...typography.body, lineHeight: 24 },
});
