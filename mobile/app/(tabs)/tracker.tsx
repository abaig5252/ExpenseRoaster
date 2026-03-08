import { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator,
  Dimensions, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../src/lib/auth';
import { apiGet } from '../../src/lib/api';
import { colors, spacing, radius, typography } from '../../src/theme';

type SourceFilter = 'all' | 'receipt' | 'bank_statement';

const SOURCE_TABS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'receipt', label: 'Receipts' },
  { value: 'bank_statement', label: 'Bank Statement' },
];

interface Expense {
  id: number;
  description: string;
  amount: number;
  currency: string;
  source: string;
  category: string;
  roast: string | null;
  date: string;
}

interface MonthlySeries {
  month: string;
  total: number;
  count: number;
}

interface AdviceBreakdown {
  category: string;
  roast: string;
  insight: string;
  potentialSaving: number;
  alternatives: string[];
}

interface FinancialAdvice {
  advice: string;
  topCategory: string;
  savingsPotential: number;
  breakdown: AdviceBreakdown[];
}

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_H = 120;
const CATEGORY_COLORS = ['#E85D26', '#C4A832', '#7B6FE8', '#3BB8A0', '#E8526A', '#5BA85E', '#8A9099'];

function shortMonth(str: string) {
  const d = new Date(str + '-01');
  return d.toLocaleDateString('en-US', { month: 'short' });
}

export default function TrackerScreen() {
  const { user } = useAuth();
  const isPremium = user?.tier === 'premium';

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ['/api/expenses'],
    queryFn: () => apiGet('/api/expenses'),
    enabled: isPremium,
  });

  const { data: series, isLoading: seriesLoading } = useQuery<MonthlySeries[]>({
    queryKey: ['/api/expenses/monthly-series'],
    queryFn: () => apiGet('/api/expenses/monthly-series'),
    enabled: isPremium,
  });

  const adviceSource = sourceFilter !== 'all' ? `?source=${sourceFilter}` : '';
  const { data: advice } = useQuery<FinancialAdvice>({
    queryKey: ['/api/expenses/financial-advice', sourceFilter],
    queryFn: () => apiGet(`/api/expenses/financial-advice${adviceSource}`),
    enabled: isPremium && (expenses?.length ?? 0) > 0,
  });

  // ── Derived data ──────────────────────────────────────────────────
  const allExpenses = useMemo(() => {
    const all = expenses ?? [];
    if (sourceFilter === 'receipt') return all.filter(e => e.source === 'receipt');
    if (sourceFilter === 'bank_statement') return all.filter(e => e.source === 'bank_statement' || e.source === 'manual');
    return all;
  }, [expenses, sourceFilter]);

  const currentYM = new Date().toISOString().slice(0, 7);
  const isFiltered = selectedCats.size > 0 || selectedMonth !== null || selectedYear !== null;

  const availableYears = useMemo(() => {
    const years = new Set(allExpenses.map(e => (e.date ?? '').slice(0, 4)).filter(Boolean));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [allExpenses]);

  const availableMonthsForYear = useMemo(() => {
    if (!selectedYear) return [];
    const months = new Set(
      allExpenses
        .filter(e => (e.date ?? '').slice(0, 4) === selectedYear)
        .map(e => (e.date ?? '').slice(0, 7))
        .filter(Boolean)
    );
    return Array.from(months).sort();
  }, [allExpenses, selectedYear]);

  function changeSource(src: SourceFilter) {
    setSourceFilter(src);
    setSelectedCats(new Set());
    setSelectedMonth(null);
    setSelectedYear(null);
  }

  function toggleCat(cat: string) {
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function toggleMonth(month: string) {
    setSelectedMonth(prev => prev === month ? null : month);
  }

  function selectedMonthLabel() {
    if (!selectedMonth) return '';
    return new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  // Expenses filtered by selected month → selected year → last 12 months
  const monthFilteredExpenses = useMemo(() => {
    if (selectedMonth) {
      return allExpenses.filter(e => (e.date ?? '').slice(0, 7) === selectedMonth);
    }
    if (selectedYear) {
      return allExpenses.filter(e => (e.date ?? '').slice(0, 4) === selectedYear);
    }
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 11);
    cutoff.setDate(1);
    const cutoffYM = cutoff.toISOString().slice(0, 7);
    return allExpenses.filter(e => (e.date ?? '').slice(0, 7) >= cutoffYM);
  }, [allExpenses, selectedMonth, selectedYear]);

  // Expenses filtered by BOTH month and categories
  const filteredExpenses = useMemo(
    () => selectedCats.size === 0 ? monthFilteredExpenses : monthFilteredExpenses.filter(e => selectedCats.has(e.category)),
    [monthFilteredExpenses, selectedCats]
  );

  // Category totals from month-filtered expenses (reflects selected month)
  const categoryTotals = useMemo(() => {
    const acc: Record<string, number> = {};
    monthFilteredExpenses.forEach(e => { acc[e.category] = (acc[e.category] || 0) + e.amount; });
    return acc;
  }, [monthFilteredExpenses]);

  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const grandTotal = Object.values(categoryTotals).reduce((s, v) => s + v, 0);

  // Display total for stats card
  const displayMonthTotal = useMemo(() => {
    if (selectedMonth || selectedYear) return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    if (selectedCats.size > 0) {
      return allExpenses
        .filter(e => e.date?.slice(0, 7) === currentYM && selectedCats.has(e.category))
        .reduce((sum, e) => sum + e.amount, 0);
    }
    return allExpenses.filter(e => e.date?.slice(0, 7) === currentYM).reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses, selectedMonth, selectedYear, selectedCats, allExpenses, currentYM]);

  // Chart: when year selected build Jan-Dec from allExpenses; otherwise use API series
  const chartData = useMemo(() => {
    if (selectedYear) {
      const now = new Date();
      const yearNum = parseInt(selectedYear);
      const endMonth = yearNum === now.getFullYear() ? now.getMonth() + 1 : 12;
      const slots = Array.from({ length: endMonth }, (_, i) => {
        const m = String(i + 1).padStart(2, '0');
        return { month: `${selectedYear}-${m}`, total: 0, count: 0 };
      });
      const src = selectedCats.size > 0 ? allExpenses.filter(e => selectedCats.has(e.category)) : allExpenses;
      src.forEach(e => {
        if ((e.date ?? '').slice(0, 4) !== selectedYear) return;
        const ym = (e.date ?? '').slice(0, 7);
        const slot = slots.find(s => s.month === ym);
        if (slot) { slot.total += e.amount; slot.count++; }
      });
      return slots;
    }
    if (!series) return [];
    if (selectedCats.size === 0) return series;
    const byMonth: Record<string, number> = {};
    allExpenses.filter(e => selectedCats.has(e.category)).forEach(e => {
      const ym = (e.date ?? '').slice(0, 7);
      if (ym) byMonth[ym] = (byMonth[ym] || 0) + e.amount;
    });
    return series.map(row => ({ ...row, total: byMonth[row.month] ?? 0 }));
  }, [series, allExpenses, selectedYear, selectedCats]);

  const maxTotal = Math.max(...(chartData.map(m => m.total) ?? [1]), 1);

  // Filtered advice
  const filteredBreakdown = useMemo(() => {
    if (!advice?.breakdown) return [];
    if (!isFiltered) return advice.breakdown;
    return advice.breakdown.filter(b => selectedCats.has(b.category));
  }, [advice, selectedCats, isFiltered]);

  // Recent transactions (filtered)
  const recentTx = useMemo(() => {
    return filteredExpenses
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [filteredExpenses]);

  // ── Currency display — derive from filtered expenses, not user profile ──
  const displayCurrency = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const e of allExpenses) {
      const c = e.currency || user?.currency || 'USD';
      freq[c] = (freq[c] || 0) + e.amount;
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || user?.currency || 'USD';
  }, [allExpenses, user]);

  function fmt(cents: number) {
    return `${(cents / 100).toFixed(2)} ${displayCurrency}`;
  }

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

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Monthly Tracker</Text>

        {/* ── Source toggle ── */}
        <View style={s.sourceToggle}>
          {SOURCE_TABS.map(tab => (
            <TouchableOpacity
              key={tab.value}
              style={[s.sourceTab, sourceFilter === tab.value && s.sourceTabActive]}
              onPress={() => changeSource(tab.value)}
              activeOpacity={0.7}
            >
              <Text style={[s.sourceTabText, sourceFilter === tab.value && s.sourceTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Active filter chips */}
        {isFiltered && (
          <View style={s.filterBanner}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}>
              {selectedYear && !selectedMonth && (
                <TouchableOpacity style={[s.filterChip, s.filterChipYear]} onPress={() => setSelectedYear(null)}>
                  <Text style={[s.filterChipText, s.filterChipYearText]}>📆 {selectedYear}</Text>
                  <Ionicons name="close" size={11} color="#c084fc" />
                </TouchableOpacity>
              )}
              {selectedMonth && (
                <TouchableOpacity key="month" style={[s.filterChip, s.filterChipMonth]} onPress={() => setSelectedMonth(null)}>
                  <Text style={[s.filterChipText, s.filterChipMonthText]}>📅 {selectedMonthLabel()}</Text>
                  <Ionicons name="close" size={11} color="#7BD8E8" />
                </TouchableOpacity>
              )}
              {Array.from(selectedCats).map(cat => (
                <TouchableOpacity key={cat} style={s.filterChip} onPress={() => toggleCat(cat)}>
                  <Text style={s.filterChipText}>{cat}</Text>
                  <Ionicons name="close" size={11} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => { setSelectedCats(new Set()); setSelectedMonth(null); setSelectedYear(null); }} style={s.clearBtn}>
              <Text style={s.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Summary card */}
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>
            {selectedMonth
              ? selectedCats.size > 0
                ? `${new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} — Filtered`
                : selectedMonthLabel()
              : selectedYear
              ? selectedCats.size > 0 ? `${selectedYear} — Filtered` : `${selectedYear} Total`
              : selectedCats.size > 0
              ? 'Filtered — This Month'
              : 'This Month'}
          </Text>
          <Text style={s.summaryAmount}>{fmt(displayMonthTotal)}</Text>
          {isFiltered && (
            <Text style={s.summaryFiltered}>{filteredExpenses.length} transactions</Text>
          )}
        </View>

        {/* Monthly history chart */}
        {seriesLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : chartData.length > 0 ? (
          <View style={s.chartCard}>
            <View style={s.chartHeader}>
              <Text style={s.cardTitle}>
                {selectedCats.size > 0 ? 'Spending — Filtered' : 'Spending History'}
              </Text>
              {availableYears.length > 0 && (
                <View style={s.yearPillSection}>
                  {/* Year row */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.yearPillRow}>
                    <TouchableOpacity
                      style={[s.yearPill, !selectedYear && s.yearPillActive]}
                      onPress={() => { setSelectedYear(null); setSelectedMonth(null); }}
                    >
                      <Text style={[s.yearPillText, !selectedYear && s.yearPillTextActive]}>12 mo</Text>
                    </TouchableOpacity>
                    {availableYears.map(y => (
                      <TouchableOpacity
                        key={y}
                        style={[s.yearPill, selectedYear === y && s.yearPillActive]}
                        onPress={() => { setSelectedYear(selectedYear === y ? null : y); setSelectedMonth(null); }}
                      >
                        <Text style={[s.yearPillText, selectedYear === y && s.yearPillTextActive]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {/* Month sub-row — only when a year is selected */}
                  {selectedYear && availableMonthsForYear.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.monthPillRow}>
                      {availableMonthsForYear.map(ym => {
                        const label = new Date(ym + '-02').toLocaleDateString('en-US', { month: 'short' });
                        const isActive = selectedMonth === ym;
                        return (
                          <TouchableOpacity
                            key={ym}
                            style={[s.monthPill, isActive && s.monthPillActive]}
                            onPress={() => toggleMonth(ym)}
                            activeOpacity={0.7}
                          >
                            <Text style={[s.monthPillText, isActive && s.monthPillTextActive]}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>
            <Text style={s.tapHint}>
              {selectedMonth ? `${selectedMonthLabel()} — tap again to deselect` : 'Tap a bar to focus on that month'}
            </Text>
            <View style={[s.chart, { height: CHART_H + 48 }]}>
              {(selectedYear ? chartData : chartData.slice(-6)).map((m) => {
                const barH = Math.max(4, (m.total / maxTotal) * CHART_H);
                const isMonthSelected = selectedMonth === m.month;
                const hasMonthFilter = selectedMonth !== null;
                const barColor = hasMonthFilter
                  ? isMonthSelected ? '#7BD8E8' : 'rgba(255,255,255,0.12)'
                  : colors.primary;
                return (
                  <TouchableOpacity
                    key={m.month}
                    style={s.barCol}
                    onPress={() => toggleMonth(m.month)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.barAmount, isMonthSelected && { color: '#7BD8E8' }]}>
                      {m.total > 0 ? `${(m.total / 100).toFixed(0)}` : ''}
                    </Text>
                    <View style={[s.bar, { height: barH, backgroundColor: barColor }]} />
                    <Text style={[s.barLabel, isMonthSelected && { color: '#7BD8E8', fontWeight: '700' }]}>{shortMonth(m.month)}</Text>
                  </TouchableOpacity>
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

        {/* Spending by Category — clickable bars */}
        {sortedCategories.length > 0 && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View>
                <Text style={s.cardTitle}>Spending by Category</Text>
                {selectedMonth && (
                  <Text style={[s.tapHint, { color: '#7BD8E8', marginTop: 2 }]}>{selectedMonthLabel()}</Text>
                )}
              </View>
              {!isFiltered && <Text style={s.tapHint}>Tap to filter</Text>}
            </View>
            {sortedCategories.map(([cat, total], i) => {
              const pct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0;
              const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
              const isSelected = selectedCats.has(cat);
              const isDimmed = isFiltered && !isSelected;

              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => toggleCat(cat)}
                  activeOpacity={0.7}
                  style={[
                    s.catRow,
                    isSelected && s.catRowSelected,
                    isDimmed && s.catRowDimmed,
                  ]}
                >
                  <View style={s.catTop}>
                    <View style={s.catNameRow}>
                      <Text style={s.catName}>{cat}</Text>
                      {isSelected && (
                        <View style={s.checkBadge}>
                          <Ionicons name="checkmark" size={10} color="#0D0D0D" />
                        </View>
                      )}
                    </View>
                    <View style={s.catRight}>
                      <Text style={s.catPct}>{pct}%</Text>
                      <Text style={s.catTotal}>{fmt(total)}</Text>
                    </View>
                  </View>
                  <View style={s.barTrack}>
                    <View
                      style={[
                        s.barFill,
                        { width: `${pct}%` as any, backgroundColor: isSelected ? colors.primary : color },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Advice — filtered */}
        {advice && (
          <View style={s.adviceCard}>
            <View style={s.adviceHeader}>
              <Ionicons name="bulb-outline" size={18} color={colors.primary} />
              <Text style={s.adviceTitle}>
                {isFiltered ? 'Category Advice' : 'AI Financial Advice'}
              </Text>
            </View>

            {!isFiltered && (
              <Text style={s.adviceText}>{advice.advice}</Text>
            )}

            {filteredBreakdown.length > 0 ? (
              filteredBreakdown.map((b, i) => (
                <View key={b.category} style={[s.breakdownCard, i > 0 && { marginTop: spacing.sm }]}>
                  <View style={s.breakdownHeader}>
                    <View style={s.catChip}>
                      <Text style={s.catChipText}>{b.category}</Text>
                    </View>
                    {b.potentialSaving > 0 && (
                      <Text style={s.savingText}>save ~{fmt(b.potentialSaving)}/mo</Text>
                    )}
                  </View>
                  {b.roast ? (
                    <View style={s.roastBox}>
                      <Ionicons name="flame" size={12} color="#FFB800" />
                      <Text style={s.roastText}>"{b.roast}"</Text>
                    </View>
                  ) : null}
                  <Text style={s.insightText}>{b.insight}</Text>
                </View>
              ))
            ) : isFiltered ? (
              <Text style={[typography.bodyMuted, { textAlign: 'center', paddingVertical: spacing.md }]}>
                No advice available for selected categories.
              </Text>
            ) : null}
          </View>
        )}

        {/* Recent Transactions — filtered */}
        {recentTx.length > 0 && (
          <View style={s.section}>
            <Text style={s.cardTitle}>
              {isFiltered ? 'Filtered Transactions' : 'Recent Transactions'}
            </Text>
            {recentTx.map((exp, i) => {
              const catIdx = sortedCategories.findIndex(([c]) => c === exp.category);
              const catColor = CATEGORY_COLORS[catIdx % CATEGORY_COLORS.length] || colors.textMuted;
              return (
                <View key={exp.id} style={s.txItem}>
                  <View style={s.txTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.txDesc} numberOfLines={1}>{exp.description}</Text>
                      <View style={[s.txCatChip, { backgroundColor: catColor + '22' }]}>
                        <Text style={[s.txCatText, { color: catColor }]}>{exp.category}</Text>
                      </View>
                    </View>
                    <Text style={s.txAmount}>{fmt(exp.amount)}</Text>
                  </View>
                  {exp.roast && <Text style={s.txRoast} numberOfLines={2}>"{exp.roast}"</Text>}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.lg },
  lockedTitle: { ...typography.h2 },
  lockedSub: { ...typography.bodyMuted, textAlign: 'center', lineHeight: 22 },
  pageTitle: { ...typography.h2 },

  filterBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,230,118,0.07)',
    borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)',
    borderRadius: radius.lg, padding: spacing.sm, gap: spacing.sm,
  },
  filterScroll: { flex: 1 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primaryDim, borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.3)', borderRadius: radius.full,
    paddingVertical: 4, paddingHorizontal: spacing.sm, marginRight: spacing.xs,
  },
  filterChipText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  filterChipMonth: {
    backgroundColor: 'rgba(123,216,232,0.12)', borderColor: 'rgba(123,216,232,0.3)',
  },
  filterChipMonthText: { color: '#7BD8E8' },
  filterChipYear: {
    backgroundColor: 'rgba(192,132,252,0.12)', borderColor: 'rgba(192,132,252,0.3)',
  },
  filterChipYearText: { color: '#c084fc' },
  clearBtn: { paddingHorizontal: spacing.sm },
  clearText: { ...typography.caption, color: colors.textMuted },

  summaryCard: {
    backgroundColor: colors.primaryDim, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)',
  },
  summaryLabel: { ...typography.label, color: colors.primary },
  summaryAmount: { fontSize: 34, fontWeight: '800', color: colors.primary, marginTop: spacing.xs },
  summaryFiltered: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },

  chartCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  chartHeader: { gap: spacing.xs },
  sourceToggle: {
    flexDirection: 'row', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.xl, padding: 5,
  },
  sourceTab: {
    flex: 1, paddingVertical: 8, borderRadius: radius.lg,
    alignItems: 'center',
  },
  sourceTabActive: {
    backgroundColor: colors.primary,
  },
  sourceTabText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  sourceTabTextActive: { color: '#0D0D0D', fontWeight: '800' },

  yearPillSection: { gap: 6, marginTop: 4 },
  yearPillRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  yearPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  yearPillActive: {
    backgroundColor: colors.primaryDim, borderColor: colors.primaryBorder,
  },
  yearPillText: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  yearPillTextActive: { color: colors.primary, fontWeight: '700' },

  monthPillRow: { flexDirection: 'row', gap: 5, paddingVertical: 2 },
  monthPill: {
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  monthPillActive: {
    backgroundColor: colors.primaryDim, borderColor: colors.primaryBorder,
  },
  monthPillText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  monthPillTextActive: { color: colors.primary, fontWeight: '700' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  barCol: { flex: 1, alignItems: 'center', gap: spacing.xs },
  bar: { width: '60%', backgroundColor: colors.primary, borderRadius: radius.xs ?? 4, minHeight: 4 },
  barLabel: { ...typography.caption, fontSize: 10 },
  barAmount: { ...typography.caption, fontSize: 9, color: colors.textDim },

  emptyCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.xl, alignItems: 'center', gap: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  emptyText: { ...typography.bodyMuted, textAlign: 'center' },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...typography.h3 },
  tapHint: { ...typography.caption, color: colors.textDim },

  catRow: {
    padding: spacing.sm, borderRadius: radius.md, gap: spacing.xs,
  },
  catRowSelected: {
    backgroundColor: 'rgba(0,230,118,0.08)',
    borderWidth: 1, borderColor: 'rgba(0,230,118,0.3)',
  },
  catRowDimmed: { opacity: 0.35 },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  catName: { ...typography.body, fontWeight: '600' },
  checkBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  catRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catPct: { ...typography.caption },
  catTotal: { ...typography.body, fontWeight: '700', color: colors.primary },
  barTrack: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.full, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.full },

  adviceCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(0,230,118,0.15)',
  },
  adviceHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  adviceTitle: { ...typography.h3, color: colors.primary },
  adviceText: { ...typography.body, lineHeight: 24 },
  breakdownCard: {
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  breakdownHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catChip: {
    backgroundColor: colors.primaryDim, borderRadius: radius.full,
    paddingVertical: 3, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)',
  },
  catChipText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  savingText: { ...typography.caption, color: '#7B6FE8' },
  roastBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs,
    backgroundColor: 'rgba(255,184,0,0.08)', borderRadius: radius.sm,
    padding: spacing.sm, borderWidth: 1, borderColor: 'rgba(255,184,0,0.15)',
  },
  roastText: { ...typography.caption, fontStyle: 'italic', flex: 1, lineHeight: 18 },
  insightText: { ...typography.bodyMuted, fontSize: 13, lineHeight: 20 },

  section: { gap: spacing.sm },
  txItem: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.xs,
    borderWidth: 1, borderColor: colors.border,
  },
  txTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  txDesc: { ...typography.body, fontWeight: '600' },
  txCatChip: {
    alignSelf: 'flex-start', borderRadius: radius.full,
    paddingVertical: 2, paddingHorizontal: spacing.xs, marginTop: 2,
  },
  txCatText: { fontSize: 10, fontWeight: '600' },
  txAmount: { ...typography.body, fontWeight: '700', color: colors.primary, flexShrink: 0 },
  txRoast: { ...typography.bodyMuted, fontStyle: 'italic', fontSize: 12 },
});
