import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../src/lib/auth';
import { apiGet } from '../../src/lib/api';
import { colors, spacing, radius, typography } from '../../src/theme';

interface MonthlySeries {
  month: string;
  totalCents: number;
}

interface Summary {
  monthTotal: number;
  currency: string;
  recentRoasts: Array<{ description: string; amountCents: number; roast: string; currency: string }>;
}

interface Advice {
  advice: string;
  roast: string;
}

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - spacing.md * 2 - spacing.lg * 2;
const CHART_H = 120;

export default function TrackerScreen() {
  const { user } = useAuth();
  const isPremium = user?.tier === 'premium';

  const { data: series, isLoading: seriesLoading } = useQuery<MonthlySeries[]>({
    queryKey: ['/api/expenses/monthly-series'],
    queryFn: () => apiGet('/api/expenses/monthly-series'),
    enabled: isPremium,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<Summary>({
    queryKey: ['/api/expenses/summary'],
    queryFn: () => apiGet('/api/expenses/summary'),
    enabled: isPremium,
  });

  const { data: advice } = useQuery<Advice>({
    queryKey: ['/api/expenses/financial-advice'],
    queryFn: () => apiGet('/api/expenses/financial-advice'),
    enabled: isPremium && (summary?.recentRoasts?.length ?? 0) > 0,
  });

  if (!isPremium) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.locked}>
          <Ionicons name="lock-closed" size={48} color={colors.primary} />
          <Text style={s.lockedTitle}>Premium Feature</Text>
          <Text style={s.lockedSub}>Upgrade to Premium to see your monthly spending tracker and AI financial insights.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const maxTotal = Math.max(...(series?.map(m => m.totalCents) ?? [1]), 1);

  function shortMonth(str: string) {
    const d = new Date(str + '-01');
    return d.toLocaleDateString('en-US', { month: 'short' });
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Monthly Tracker</Text>

        {summaryLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : summary && (
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>This Month</Text>
            <Text style={s.summaryAmount}>
              {(summary.monthTotal / 100).toFixed(2)} {summary.currency}
            </Text>
          </View>
        )}

        {seriesLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : series && series.length > 0 ? (
          <View style={s.chartCard}>
            <Text style={s.cardTitle}>Spending History</Text>
            <View style={s.chart}>
              {series.slice(-6).map((m, i) => {
                const barH = Math.max(4, (m.totalCents / maxTotal) * CHART_H);
                return (
                  <View key={m.month} style={s.barCol}>
                    <Text style={s.barAmount}>
                      {m.totalCents > 0 ? `${(m.totalCents / 100).toFixed(0)}` : ''}
                    </Text>
                    <View style={[s.bar, { height: barH }]} />
                    <Text style={s.barLabel}>{shortMonth(m.month)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={s.emptyCard}>
            <Ionicons name="bar-chart-outline" size={32} color={colors.textDim} />
            <Text style={s.emptyText}>No spending data yet. Upload receipts to start tracking.</Text>
          </View>
        )}

        {advice && (
          <View style={s.adviceCard}>
            <View style={s.adviceHeader}>
              <Ionicons name="bulb-outline" size={18} color={colors.primary} />
              <Text style={s.adviceTitle}>AI Financial Advice</Text>
            </View>
            <Text style={s.adviceText}>{advice.advice}</Text>
            {advice.roast && (
              <View style={s.adviceRoast}>
                <Text style={s.roastText}>"{advice.roast}"</Text>
              </View>
            )}
          </View>
        )}

        {summary?.recentRoasts && summary.recentRoasts.length > 0 && (
          <View style={s.section}>
            <Text style={s.cardTitle}>Recent Transactions</Text>
            {summary.recentRoasts.map((r, i) => (
              <View key={i} style={s.txItem}>
                <View style={s.txTop}>
                  <Text style={s.txDesc} numberOfLines={1}>{r.description}</Text>
                  <Text style={s.txAmount}>{(r.amountCents / 100).toFixed(2)} {r.currency}</Text>
                </View>
                {r.roast && <Text style={s.txRoast} numberOfLines={2}>"{r.roast}"</Text>}
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
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.lg },
  lockedTitle: { ...typography.h2 },
  lockedSub: { ...typography.bodyMuted, textAlign: 'center', lineHeight: 22 },
  pageTitle: { ...typography.h2 },
  summaryCard: {
    backgroundColor: colors.primaryDim, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(124,255,77,0.2)',
  },
  summaryLabel: { ...typography.label, color: colors.primary },
  summaryAmount: { fontSize: 36, fontWeight: '800', color: colors.primary, marginTop: spacing.xs },
  chartCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { ...typography.h3 },
  chart: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    height: CHART_H + 40,
  },
  barCol: { flex: 1, alignItems: 'center', gap: spacing.xs },
  bar: {
    width: '60%', backgroundColor: colors.primary,
    borderRadius: radius.sm, minHeight: 4,
  },
  barLabel: { ...typography.caption, fontSize: 10 },
  barAmount: { ...typography.caption, fontSize: 9, color: colors.textDim },
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.xl, alignItems: 'center', gap: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  emptyText: { ...typography.bodyMuted, textAlign: 'center' },
  adviceCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(124,255,77,0.15)',
  },
  adviceHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  adviceTitle: { ...typography.h3, color: colors.primary },
  adviceText: { ...typography.body, lineHeight: 24 },
  adviceRoast: {
    backgroundColor: colors.primaryDim, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: 'rgba(124,255,77,0.15)',
  },
  roastText: { ...typography.body, fontStyle: 'italic' },
  section: { gap: spacing.sm },
  txItem: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.xs,
    borderWidth: 1, borderColor: colors.border,
  },
  txTop: { flexDirection: 'row', justifyContent: 'space-between' },
  txDesc: { ...typography.body, flex: 1, marginRight: spacing.sm },
  txAmount: { ...typography.body, fontWeight: '700', color: colors.primary },
  txRoast: { ...typography.bodyMuted, fontStyle: 'italic' },
});
