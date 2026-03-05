import { View, ActivityIndicator } from 'react-native';
import { colors } from '../src/theme';

export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
