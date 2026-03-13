import { useRef, useEffect } from 'react';
import { Animated, Easing, Pressable, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme';

// ── Roast: organic flame flicker ─────────────────────────────────────────────
function FlameTabIcon({ color, size, focused }: { color: string; size: number; focused: boolean }) {
  const opacity    = useRef(new Animated.Value(1)).current;
  const scale      = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const anim       = useRef<Animated.CompositeAnimation | null>(null);

  const step = (op: number, sc: number, y: number, dur: number) =>
    Animated.parallel([
      Animated.timing(opacity,    { toValue: op,  duration: dur, easing: Easing.sin, useNativeDriver: true }),
      Animated.timing(scale,      { toValue: sc,  duration: dur, easing: Easing.sin, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: y,   duration: dur, easing: Easing.sin, useNativeDriver: true }),
    ]);

  useEffect(() => {
    if (focused) {
      anim.current = Animated.sequence([
        step(0.65, 0.90,  1.5,  110),
        step(1.0,  1.11, -2.5,  150),
        step(0.78, 0.94,  0.5,   95),
        step(0.96, 1.07, -1.5,  130),
        step(0.70, 0.92,  1.0,  100),
        step(1.0,  1.0,   0,    115),
      ]);
      anim.current.start();
    } else {
      anim.current?.stop();
      opacity.setValue(1); scale.setValue(1); translateY.setValue(0);
    }
    return () => anim.current?.stop();
  }, [focused]);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }, { translateY }] }}>
      <Ionicons name="flame" size={size} color={color} />
    </Animated.View>
  );
}

// ── Bank: quick horizontal nudge, like filing a document ─────────────────────
function BankTabIcon({ color, size, focused }: { color: string; size: number; focused: boolean }) {
  const tx   = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (focused) {
      anim.current = Animated.sequence([
        Animated.timing(tx, { toValue:  5, duration:  80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(tx, { toValue: -3, duration:  80, easing: Easing.sin,              useNativeDriver: true }),
        Animated.timing(tx, { toValue:  2, duration:  70, easing: Easing.sin,              useNativeDriver: true }),
        Animated.timing(tx, { toValue:  0, duration:  80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]);
      anim.current.start();
    } else {
      anim.current?.stop();
      tx.setValue(0);
    }
    return () => anim.current?.stop();
  }, [focused]);

  return (
    <Animated.View style={{ transform: [{ translateX: tx }] }}>
      <Ionicons name="document-text" size={size} color={color} />
    </Animated.View>
  );
}

// ── Tracker: bar-chart pulse — quick grow then settle ────────────────────────
function TrackerTabIcon({ color, size, focused }: { color: string; size: number; focused: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const anim  = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (focused) {
      anim.current = Animated.sequence([
        Animated.timing(scale, { toValue: 1.28, duration: 110, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.88, duration:  95, easing: Easing.sin,                 useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.06, duration:  85, easing: Easing.sin,                 useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0,  duration:  80, easing: Easing.out(Easing.quad),    useNativeDriver: true }),
      ]);
      anim.current.start();
    } else {
      anim.current?.stop();
      scale.setValue(1);
    }
    return () => anim.current?.stop();
  }, [focused]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name="bar-chart" size={size} color={color} />
    </Animated.View>
  );
}

// ── Annual: trophy shimmy — left-right rock ───────────────────────────────────
function AnnualTabIcon({ color, size, focused }: { color: string; size: number; focused: boolean }) {
  const rotate = useRef(new Animated.Value(0)).current;
  const anim   = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (focused) {
      anim.current = Animated.sequence([
        Animated.timing(rotate, { toValue: -8, duration:  90, easing: Easing.sin,              useNativeDriver: true }),
        Animated.timing(rotate, { toValue:  7, duration: 110, easing: Easing.sin,              useNativeDriver: true }),
        Animated.timing(rotate, { toValue: -4, duration:  90, easing: Easing.sin,              useNativeDriver: true }),
        Animated.timing(rotate, { toValue:  2, duration:  80, easing: Easing.sin,              useNativeDriver: true }),
        Animated.timing(rotate, { toValue:  0, duration:  80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]);
      anim.current.start();
    } else {
      anim.current?.stop();
      rotate.setValue(0);
    }
    return () => anim.current?.stop();
  }, [focused]);

  const deg = rotate.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] });

  return (
    <Animated.View style={{ transform: [{ rotate: deg }] }}>
      <Ionicons name="trophy" size={size} color={color} />
    </Animated.View>
  );
}

// ── Profile: person pop — dip then spring back ────────────────────────────────
function ProfileTabIcon({ color, size, focused }: { color: string; size: number; focused: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const anim  = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (focused) {
      anim.current = Animated.sequence([
        Animated.timing(scale, { toValue: 0.72, duration:  80, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1,    friction: 4,   tension: 180,                   useNativeDriver: true }),
      ]);
      anim.current.start();
    } else {
      anim.current?.stop();
      scale.setValue(1);
    }
    return () => anim.current?.stop();
  }, [focused]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name="person" size={size} color={color} />
    </Animated.View>
  );
}

// ── Tab button with bounce press feedback ─────────────────────────────────────
function BounceTabButton(props: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.72, duration: 75,  useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1,    friction: 4, tension: 200, useNativeDriver: true }),
    ]).start();
    props.onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={props.style}
      accessibilityRole={props.accessibilityRole}
      accessibilityState={props.accessibilityState}
      accessibilityLabel={props.accessibilityLabel}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center', flex: 1 }}>
        {props.children}
      </Animated.View>
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111111',
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
        tabBarButton: (props) => <BounceTabButton {...props} />,
      }}
    >
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Roast',
          tabBarIcon: ({ color, size, focused }) => (
            <FlameTabIcon color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="bank"
        options={{
          title: 'Bank',
          tabBarIcon: ({ color, size, focused }) => (
            <BankTabIcon color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Tracker',
          tabBarIcon: ({ color, size, focused }) => (
            <TrackerTabIcon color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="annual"
        options={{
          title: 'Annual',
          tabBarIcon: ({ color, size, focused }) => (
            <AnnualTabIcon color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <ProfileTabIcon color={color} size={size} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
