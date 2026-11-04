import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion, navGap, navHeight, palette as paletteFor, space } from '../theme';
import { useTheme } from './kit';

export type TabKey = 'projects' | 'activity' | 'search' | 'settings';

const ITEMS: Array<{ key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }> = [
  { key: 'projects', label: 'Projects', icon: 'albums-outline', active: 'albums' },
  { key: 'activity', label: 'Activity', icon: 'pulse-outline', active: 'pulse' },
  { key: 'search', label: 'Search', icon: 'search-outline', active: 'search' },
  { key: 'settings', label: 'Settings', icon: 'options-outline', active: 'options' },
];

/**
 * Floating glass tab bar.
 *
 * One blurred pill that hovers above the content, with a soft highlight that
 * slides between tabs instead of appearing and disappearing. The highlight is a
 * single view translated by an Animated value, so switching tabs costs one
 * animation and no layout work.
 */
export function BottomNav({
  value,
  onChange,
  badge,
}: {
  value: TabKey;
  onChange: (next: TabKey) => void;
  badge?: Partial<Record<TabKey, number>>;
}) {
  const { palette, name } = useTheme();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const index = ITEMS.findIndex((item) => item.key === value);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: index,
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, slide]);

  const cell = width > 0 ? (width - 10) / ITEMS.length : 0;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + navGap }]}
    >
      <View style={styles.shadow}>
        <BlurView
          intensity={Platform.OS === 'android' ? 70 : 46}
          tint={palette.glassTint}
          style={[styles.bar, { borderColor: palette.glassLine, backgroundColor: palette.glass }]}
        >
          <View
            style={styles.track}
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          >
            {cell > 0 ? (
              <Animated.View
                style={[
                  styles.pill,
                  {
                    width: cell,
                    backgroundColor: name === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(17,17,20,0.06)',
                    transform: [
                      {
                        translateX: slide.interpolate({
                          inputRange: ITEMS.map((_, i) => i),
                          outputRange: ITEMS.map((_, i) => i * cell),
                        }),
                      },
                    ],
                  },
                ]}
              />
            ) : null}

            {ITEMS.map((item) => {
              const active = item.key === value;
              const count = badge?.[item.key] ?? 0;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="tab"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    if (active) return;
                    if (Platform.OS !== 'web') {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                    }
                    onChange(item.key);
                  }}
                  style={styles.cell}
                >
                  <View>
                    <Ionicons
                      name={active ? item.active : item.icon}
                      size={21}
                      color={active ? palette.text : palette.faint}
                    />
                    {count > 0 ? (
                      <View style={[styles.badge, { backgroundColor: palette.accent }]}>
                        <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      fontSize: 10.5,
                      marginTop: 3,
                      fontWeight: active ? '600' : '500',
                      color: active ? palette.text : palette.faint,
                    }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

/** Height a screen must reserve at the bottom so content never hides behind the bar. */
export function useNavPadding(): number {
  const insets = useSafeAreaInsets();
  return navHeight + navGap * 2 + Math.max(insets.bottom, 10);
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    alignItems: 'stretch',
  },
  shadow: {
    borderRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.16,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 10 },
      default: {},
    }),
  },
  bar: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    height: navHeight,
    justifyContent: 'center',
  },
  track: {
    flexDirection: 'row',
    paddingHorizontal: 5,
    alignItems: 'center',
    height: navHeight,
  },
  pill: {
    position: 'absolute',
    left: 5,
    top: 6,
    bottom: 6,
    borderRadius: 16,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: navHeight - 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -9,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
});

export const paletteForTab = paletteFor;
