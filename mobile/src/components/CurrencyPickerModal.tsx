import {
  Modal, View, Text, TouchableOpacity, FlatList, StyleSheet,
  SafeAreaView, TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';

export const CURRENCIES = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'EUR', label: 'Euro' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'CHF', label: 'Swiss Franc' },
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'NZD', label: 'New Zealand Dollar' },
  { code: 'HKD', label: 'Hong Kong Dollar' },
  { code: 'MXN', label: 'Mexican Peso' },
  { code: 'BRL', label: 'Brazilian Real' },
  { code: 'SEK', label: 'Swedish Krona' },
  { code: 'NOK', label: 'Norwegian Krone' },
  { code: 'DKK', label: 'Danish Krone' },
];

interface Props {
  visible: boolean;
  current: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

export function CurrencyPickerModal({ visible, current, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>

      <View style={s.sheet}>
        <SafeAreaView>
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={s.title}>Select Currency</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={CURRENCIES}
            keyExtractor={item => item.code}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
            renderItem={({ item }) => {
              const selected = item.code === current;
              return (
                <TouchableOpacity
                  style={[s.row, selected && s.rowSelected]}
                  onPress={() => { onSelect(item.code); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={s.rowLeft}>
                    <Text style={[s.code, selected && s.codeSelected]}>{item.code}</Text>
                    <Text style={s.label}>{item.label}</Text>
                  </View>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginTop: spacing.sm, marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderColor: colors.border,
  },
  title: { ...typography.h3, fontSize: 17 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    marginTop: spacing.xs, borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  rowSelected: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primaryBorder,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  code: { ...typography.body, fontWeight: '700', color: colors.text, minWidth: 44 },
  codeSelected: { color: colors.primary },
  label: { ...typography.body, color: colors.textMuted },
});
