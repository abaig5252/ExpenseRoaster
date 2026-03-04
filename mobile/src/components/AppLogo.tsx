import { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';

const SIZES = { xs: 60, sm: 80, md: 104, lg: 132 };

interface Props {
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function AppLogo({ size = 'md' }: Props) {
  const box = SIZES[size];
  const outerOpacity = useRef(new Animated.Value(0.85)).current;
  const innerScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const outer = Animated.loop(
      Animated.sequence([
        Animated.timing(outerOpacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(outerOpacity, { toValue: 0.85, duration: 750, useNativeDriver: true }),
      ])
    );
    const inner = Animated.loop(
      Animated.sequence([
        Animated.timing(innerScale, { toValue: 1.06, duration: 400, useNativeDriver: true }),
        Animated.timing(innerScale, { toValue: 0.94, duration: 400, useNativeDriver: true }),
      ])
    );
    outer.start();
    inner.start();
    return () => { outer.stop(); inner.stop(); };
  }, [outerOpacity, innerScale]);

  const textSize = box < 70 ? 8 : box < 90 ? 10 : box < 110 ? 12 : 14;

  return (
    <View style={styles.container}>
      <View style={{ width: box, height: box }}>
        <Animated.View style={{ opacity: outerOpacity, position: 'absolute', width: box, height: box }}>
          <Svg width={box} height={box} viewBox="0 0 120 120">
            <Rect
              x="10" y="10" width="100" height="100" rx="22"
              fill="#0D0D0D" stroke="#7CFF4D" strokeWidth="5"
            />
            <Path
              d="M60 20 L45 45 C40 55 38 62 42 70 C44 74 38 72 36 68 C32 78 38 92 48 96 C44 90 46 84 50 80 C52 88 56 92 60 95 C64 92 68 88 70 80 C74 84 76 90 72 96 C82 92 88 78 84 68 C82 72 76 74 78 70 C82 62 80 55 75 45 L60 20 Z"
              fill="none"
              stroke="#7CFF4D"
              strokeWidth="3"
              strokeLinejoin="miter"
            />
          </Svg>
        </Animated.View>
        <Animated.View
          style={{ position: 'absolute', width: box, height: box, transform: [{ scaleY: innerScale }] }}
        >
          <Svg width={box} height={box} viewBox="0 0 120 120">
            <Path
              d="M60 50 L52 70 C52 70 50 85 60 85 C70 85 68 70 68 70 L60 50 Z"
              fill="#7CFF4D"
            />
          </Svg>
        </Animated.View>
      </View>
      <Text style={[styles.label, { fontSize: textSize, marginTop: -Math.round(box * 0.06) }]}>
        EXPENSE ROASTER
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  label: { color: '#7CFF4D', fontWeight: '700', letterSpacing: 1 },
});
