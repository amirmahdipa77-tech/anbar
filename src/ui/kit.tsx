import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion, palette as paletteFor, radius, space, type, type Palette, type ThemeName } from '../theme';

/* ------------------------------------------------------------------- theme */

type ThemeValue = {
  palette: Palette;
  name: ThemeName;
};

const ThemeContext = createContext<ThemeValue>({ palette: paletteFor('light'), name: 'light' });

export function ThemeProvider({ name, children }: { name: ThemeName; children: React.ReactNode }) {
  const value = useMemo<ThemeValue>(() => ({ palette: paletteFor(name), name }), [name]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/* -------------------------------------------------------------------- text */

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'mono';

export function AppText({
  children,
  variant = 'body',
  muted = false,
  faint = false,
  color,
  style,
  numberOfLines,
  selectable,
}: {
  children?: React.ReactNode;
  variant?: TextVariant;
  muted?: boolean;
  faint?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const { palette } = useTheme();
  const base = variant === 'mono' ? { ...type.caption, fontFamily: 'monospace' } : type[variant];
  const tint = color ?? (faint ? palette.faint : muted ? palette.muted : palette.text);
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[base as TextStyle, { color: tint }, style]}
    >
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------- touch */

/**
 * Every tappable surface goes through here.
 *
 * Android's default feedback is a rectangle that bleeds outside round shapes;
 * this keeps the ripple circular and inside the element, and uses a plain
 * opacity change on iOS and the web.
 */
export function Touch({
  children,
  onPress,
  onLongPress,
  disabled,
  round = false,
  rippleColor,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  round?: boolean;
  rippleColor?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'tab' | 'link';
}) {
  const { palette } = useTheme();
  const tint =
    rippleColor ?? (palette.glassTint === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(17,17,20,0.10)');
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: tint, borderless: round, radius: round ? 24 : undefined }}
      style={({ pressed }) => [
        style,
        Platform.OS === 'android' ? null : { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
        disabled ? { opacity: 0.4 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

/* ----------------------------------------------------------------- buttons */

export function Button({
  label,
  onPress,
  variant = 'secondary',
  icon,
  disabled,
  size = 'md',
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useTheme();
  const [pressed, setPressed] = useState(false);

  const surface =
    variant === 'primary'
      ? palette.accent
      : variant === 'danger'
        ? palette.danger
        : variant === 'ghost'
          ? 'transparent'
          : palette.surface;

  const textColor =
    variant === 'primary' ? palette.onAccent : variant === 'danger' ? '#FFFFFF' : palette.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[
        styles.button,
        size === 'sm' && styles.buttonSm,
        {
          backgroundColor: surface,
          borderColor: variant === 'ghost' ? 'transparent' : palette.line,
          opacity: disabled ? 0.45 : pressed ? 0.86 : 1,
        },
        variant === 'secondary' && { backgroundColor: palette.surface },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={size === 'sm' ? 15 : 17} color={textColor} /> : null}
      <AppText variant="label" style={{ color: textColor, fontWeight: '600' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  tone = 'default',
  size = 20,
  disabled,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: 'default' | 'accent' | 'danger';
  size?: number;
  disabled?: boolean;
}) {
  const { palette } = useTheme();
  const color =
    tone === 'danger' ? palette.danger : tone === 'accent' ? palette.accent : palette.muted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { opacity: disabled ? 0.4 : pressed ? 0.55 : 1 },
      ]}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------- lists */

export function Row({
  title,
  subtitle,
  meta,
  left,
  right,
  onPress,
  onLongPress,
  selected,
  mono,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  mono?: boolean;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? palette.accentSoft : 'transparent',
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      {left ? <View style={styles.rowLeft}>{left}</View> : null}
      <View style={styles.rowBody}>
        <AppText
          variant={mono ? 'mono' : 'body'}
          numberOfLines={1}
          style={mono ? { color: palette.text } : undefined}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" muted numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {meta ? (
        <AppText variant="caption" faint style={{ marginRight: right ? space.sm : 0 }}>
          {meta}
        </AppText>
      ) : null}
      {right}
    </Pressable>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { palette } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.line, marginLeft: inset }} />;
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <AppText
      variant="caption"
      faint
      style={{ textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: space.sm, marginTop: space.lg }}
    >
      {children}
    </AppText>
  );
}

/* ------------------------------------------------------------------- cards */

export function Card({
  children,
  style,
  sheen = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  sheen?: boolean;
}) {
  const { palette } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.line },
        style,
      ]}
    >
      {sheen ? (
        <LinearGradient
          pointerEvents="none"
          colors={
            palette.glassTint === 'dark'
              ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0)']
              : ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children}
    </View>
  );
}

export function Chip({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warn' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { palette } = useTheme();
  const color =
    tone === 'accent'
      ? palette.accent
      : tone === 'success'
        ? palette.success
        : tone === 'warn'
          ? palette.warn
          : tone === 'danger'
            ? palette.danger
            : palette.muted;
  const background =
    tone === 'accent'
      ? palette.accentSoft
      : tone === 'success'
        ? 'rgba(30,127,82,0.10)'
        : tone === 'warn'
          ? 'rgba(138,91,0,0.10)'
          : tone === 'danger'
            ? 'rgba(192,57,43,0.10)'
            : palette.surfaceAlt;

  return (
    <View style={[styles.chip, { backgroundColor: background }]}>
      {icon ? <Ionicons name={icon} size={11} color={color} /> : null}
      <AppText variant="caption" style={{ color, fontWeight: '600' }}>
        {label}
      </AppText>
    </View>
  );
}

/* ------------------------------------------------------------------ fields */

export function Field({
  label,
  hint,
  error,
  ...inputProps
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  const { palette } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: space.md }}>
      <AppText variant="label" muted style={{ marginBottom: 6 }}>
        {label}
      </AppText>
      <TextInput
        {...inputProps}
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          inputProps.onBlur?.(event);
        }}
        placeholderTextColor={palette.faint}
        style={[
          styles.input,
          {
            backgroundColor: palette.surfaceAlt,
            borderColor: error ? palette.danger : focused ? palette.accent : palette.line,
            color: palette.text,
          },
          inputProps.style,
        ]}
      />
      {error ? (
        <AppText variant="caption" style={{ color: palette.danger, marginTop: 5 }}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" faint style={{ marginTop: 5 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ sheets */

export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.sheetRoot, { backgroundColor: palette.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.acrylic,
              borderColor: palette.glassLine,
              paddingBottom: insets.bottom + space.lg,
              transform: [
                {
                  translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }),
                },
              ],
              opacity: slide,
            },
          ]}
        >
          <BlurView
            pointerEvents="none"
            intensity={Platform.OS === 'android' ? 100 : 80}
            tint={palette.glassTint}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.sheetHandle, { backgroundColor: palette.line }]} />
          <View style={styles.sheetHeader}>
            <AppText variant="heading">{title}</AppText>
            <IconButton name="close" onPress={onClose} accessibilityLabel="Close" />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 460 }}
            contentContainerStyle={{ paddingBottom: space.sm }}
          >
            {children}
          </ScrollView>
          {footer ? <View style={{ marginTop: space.sm }}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ toasts */

type ToastKind = 'info' | 'success' | 'error';
type ToastValue = (message: string, kind?: ToastKind) => void;

const ToastContext = createContext<ToastValue>(() => undefined);

export function ToastProvider({
  children,
  onMount,
}: {
  children: React.ReactNode;
  onMount?: (show: ToastValue) => void;
}) {
  const { palette } = useTheme();
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ToastValue>(
    (message, kind = 'info') => {
      setToast({ message, kind });
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(fade, {
        toValue: 1,
        duration: motion.fast,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(() => {
        Animated.timing(fade, {
          toValue: 0,
          duration: motion.fast,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 2600);
    },
    [fade],
  );

  useEffect(() => {
    onMount?.(show);
  }, [onMount, show]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              backgroundColor: palette.text,
              opacity: fade,
              transform: [
                { translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
              ],
            },
          ]}
        >
          <AppText variant="label" style={{ color: palette.bg }}>
            {toast.message}
          </AppText>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  return useContext(ToastContext);
}

/* -------------------------------------------------------------- segmented */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; badge?: number }>;
  onChange: (next: T) => void;
}) {
  const { palette } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: palette.surfaceAlt, borderColor: palette.line }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.segment,
              active && { backgroundColor: palette.surface, borderColor: palette.line },
            ]}
          >
            <AppText
              variant="label"
              style={{ color: active ? palette.text : palette.muted, fontWeight: '600' }}
            >
              {option.label}
              {option.badge ? ` ${option.badge}` : ''}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ empty */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  const { palette } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: palette.surfaceAlt, borderColor: palette.line }]}>
        <Ionicons name={icon} size={22} color={palette.faint} />
      </View>
      <AppText variant="heading" style={{ marginTop: space.md, textAlign: 'center' }}>
        {title}
      </AppText>
      {body ? (
        <AppText
          variant="body"
          muted
          style={{ marginTop: 6, textAlign: 'center', maxWidth: 300, lineHeight: 21 }}
        >
          {body}
        </AppText>
      ) : null}
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}

/* --------------------------------------------------------------- utilities */

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useTheme();
  return <View style={[{ flex: 1, backgroundColor: palette.bg }, style]}>{children}</View>;
}

export function Header({
  title,
  subtitle,
  onBack,
  actions,
  large,
  leading,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  large?: boolean;
  leading?: React.ReactNode;
}) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + 4, backgroundColor: palette.bg, borderBottomColor: palette.line },
      ]}
    >
      <View style={styles.headerRow}>
        {onBack || leading ? (
          <View style={styles.headerSlot}>
            {onBack ? (
              <Touch round onPress={onBack} accessibilityLabel="Back" style={styles.slotTouch}>
                <Ionicons name="chevron-back" size={22} color={palette.text} />
              </Touch>
            ) : (
              leading ?? null
            )}
          </View>
        ) : null}

        <View style={styles.headerTitleWrap}>
          <AppText variant={large ? 'display' : 'title'} numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" faint numberOfLines={1} style={{ marginTop: 1 }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>

        <View style={styles.headerActions}>{actions}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: space.xl,
    paddingVertical: 12,
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonSm: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: 9,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingVertical: 13,
    paddingHorizontal: space.lg,
    gap: space.md,
    borderRadius: 10,
  },
  rowLeft: { width: 22, alignItems: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    overflow: 'hidden',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 15,
  },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.14,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: -6 },
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: space.sm,
    opacity: 0.9,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  toast: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: 28,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    borderRadius: 12,
  },
  segmented: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
    paddingVertical: space.xxxl,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    paddingHorizontal: space.md,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    gap: 2,
  },
  headerSlot: { width: 40, alignItems: 'flex-start', justifyContent: 'center' },
  slotTouch: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, minWidth: 0, paddingLeft: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
