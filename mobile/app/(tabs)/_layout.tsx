import { useRef, useEffect } from 'react';
import { Animated, Easing, Pressable, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme';

// Flame icon with organic flicker loop when Roast tab is active
function FlameTabIcon({ color, size, focused }: { color: string; size: number; focused: boolean }) {
  const flickerOpacity   = useRef(new Animated.Value(1)).current;
  const flickerScale     = useRef(new Animated.Value(1)).current;
  const flickerTranslateY = useRef(new Animated.Value(0)).current;
  const flickerAnim      = useRef<Animated.CompositeAnimation | null>(null);

  const step = (opacity: number, scale: number, y: number, duration: number) =>
    Animated.parallel([
      Animated.timing(flickerOpacity,    { toValue: opacity,  duration, easing: Easing.sin, useNativeDriver: true }),
      Animated.timing(flickerScale,      { toValue: scale,    duration, easing: Easing.sin, useNativeDriver: true }),
      Animated.timing(flickerTranslateY, { toValue: y,        duration, easing: Easing.sin, useNativeDriver: true }),
    ]);

  useEffect(() => {
    if (focused) {
      flickerAnim.current = Animated.loop(
        Animated.sequence([
          step(0.65, 0.90, 1.5,  110),
          step(1.0,  1.11, -2.5, 150),
          step(0.78, 0.94, 0.5,  95),
          step(0.96, 1.07, -1.5, 130),
          step(0.70, 0.92, 1.0,  100),
          step(1.0,  1.0,  0,    115),
        ])
      );
      flickerAnim.current.start();
    } else {
      flickerAnim.current?.stop();
      flickerOpacity.setValue(1);
      flickerScale.setValue(1);
      flickerTranslateY.setValue(0);
    }
    return () => flickerAnim.current?.stop();
  }, [focused]);

  return (
    <Animated.View style={{ opacity: flickerOpacity, transform: [{ scale: flickerScale }, { translateY: flickerTranslateY }] }}>
      <Ionicons name="flame" size={size} color={color} />
    </Animated.View>
  );
}

// Tab button that bounces the icon+label on every press
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Tracker',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="annual"
        options={{
          title: 'Annual',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
