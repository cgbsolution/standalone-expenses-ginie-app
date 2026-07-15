import React from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../components/ui/tokens';

const ACCENT = tokens.color.accent;
const ACCENT_PILL = '#E6F1FB';
const INACTIVE = '#6B7280';
const BAR_BG = '#FFFFFF';

function TabButton({ iconName, label, focused, onPress, onLongPress, badgeDot }) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, { toValue: 0.94, duration: 80, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabButton}
      hitSlop={8}
    >
      <Animated.View
        style={[
          styles.tabInner,
          focused && styles.tabInnerActive,
          { transform: [{ scale }] },
        ]}
      >
        <View>
          <Ionicons
            name={iconName}
            size={22}
            color={focused ? ACCENT : INACTIVE}
          />
          {badgeDot ? <View style={styles.badgeDot} /> : null}
        </View>
        <Text
          style={[styles.tabLabel, focused && styles.tabLabelActive]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function CenterFab({ onPress }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  return (
    <View style={styles.fabSlot} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.timing(scale, { toValue: 0.92, duration: 80, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start()}
        hitSlop={6}
      >
        <Animated.View style={[styles.fab, { transform: [{ scale }] }]}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Animated.View>
      </Pressable>
    </View>
  );
}

export default function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          if (options.tabBarVariant === 'fab') {
            return <CenterFab key={route.key} onPress={onPress} />;
          }

          return (
            <TabButton
              key={route.key}
              iconName={focused ? options.tabBarIconActive : options.tabBarIconInactive}
              label={options.tabBarLabel ?? route.name}
              focused={focused}
              badgeDot={!!options.tabBarBadgeDot}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BAR_BG,
    borderRadius: 36,
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radius.lg,
    gap: 4,
    minWidth: 56,
  },
  tabInnerActive: {
    backgroundColor: ACCENT_PILL,
  },
  tabLabel: {
    color: INACTIVE,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  tabLabelActive: {
    color: ACCENT,
    fontWeight: '600',
  },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.color.danger,
    borderWidth: 1.5,
    borderColor: BAR_BG,
  },
  fabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: tokens.radius.full,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    marginTop: -16,
  },
});
