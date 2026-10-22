import React, { useEffect, useState } from 'react';

import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from 'react-native';

import { theme } from '@/lib/theme';

export function Page({ children, style, ...props }: ViewProps) {
  return (
    <View style={[styles.page, style]} {...props}>
      {children}
    </View>
  );
}

export function Title({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <View style={styles.titleWrap}>
      <Text style={styles.title}>{children}</Text>

      {subtitle ? (
        <Text style={styles.subtitle}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  secondary,
  light,
  disabled,
  busy,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  light?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  const blocked = Boolean(disabled || busy);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: Boolean(busy) }}
      onPress={() => {
        if (!blocked) onPress();
      }}
      disabled={blocked}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        light && styles.buttonLight,
        pressed && !blocked && (secondary || light ? styles.buttonSecondaryPressed : styles.buttonPressed),
        blocked && styles.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary || light ? theme.colors.primaryDark : theme.colors.onPrimary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            secondary && styles.buttonSecondaryText,
            light && styles.buttonLightText,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function TextButton({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, pressed && styles.textButtonPressed]}
    >
      <Text style={styles.textButtonLabel}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  onFocus,
  onBlur,
  style,
  ...props
}: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        placeholderTextColor={theme.colors.faint}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          props.multiline && {
            minHeight: 92,
            textAlignVertical: 'top',
          },
          focused && styles.inputFocused,
          style,
        ]}
        {...props}
      />
    </View>
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <Card style={styles.empty}>
      <View style={styles.emptyMark} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </Card>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.colors.primary} />
      <Text style={styles.subtitle}>
        Loading your workspace…
      </Text>
    </View>
  );
}

export function ErrorText({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {children}
    </Text>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && !active && styles.chipPressed,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export type PillTone = 'neutral' | 'high' | 'medium' | 'low' | 'blocked' | 'done' | 'active';

const pillTones: Record<PillTone, { backgroundColor: string; color: string }> = {
  neutral: { backgroundColor: theme.colors.mint, color: theme.colors.primaryDark },
  high: { backgroundColor: theme.colors.dangerBg, color: theme.colors.red },
  medium: { backgroundColor: theme.colors.warningBg, color: theme.colors.warning },
  low: { backgroundColor: theme.colors.line, color: theme.colors.ink },
  blocked: { backgroundColor: theme.colors.dangerBg, color: theme.colors.red },
  done: { backgroundColor: theme.colors.mint, color: theme.colors.primaryDark },
  active: { backgroundColor: theme.colors.infoBg, color: theme.colors.blue },
};

export function priorityTone(priority: string): PillTone {
  if (priority === 'high') return 'high';
  if (priority === 'medium') return 'medium';
  if (priority === 'low') return 'low';
  return 'neutral';
}

export function statusTone(status: string): PillTone {
  if (status === 'completed') return 'done';
  if (status === 'blocked') return 'blocked';
  if (status === 'in_progress') return 'active';
  return 'neutral';
}

export function Pill({
  children,
  color,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  color?: string;
  tone?: PillTone;
}) {
  const chosen = pillTones[tone];
  const backgroundColor = color || chosen.backgroundColor;
  const ink = color === theme.colors.dangerBg
    ? theme.colors.red
    : color === theme.colors.warningBg
      ? theme.colors.warning
      : color
        ? theme.colors.primaryDark
        : chosen.color;
  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <Text style={[styles.pillText, { color: ink }]}>{children}</Text>
    </View>
  );
}

export function Section({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function SelectCard({
  title,
  detail,
  selected,
  onPress,
}: {
  title: string;
  detail?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectCard,
        selected && styles.selectCardOn,
        pressed && styles.selectCardPressed,
      ]}
    >
      <View style={styles.selectMark}>
        <View style={[styles.radio, selected && styles.radioOn]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.selectTitle}>{title}</Text>
        {detail ? <Text style={styles.selectDetail}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

export function ProgressBar({
  value,
  label,
  color,
}: {
  value: number;
  label?: string;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const [motion] = useState(() => new Animated.Value(clamped));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      motion.setValue(clamped);
      return;
    }
    Animated.timing(motion, {
      toValue: clamped,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [clamped, motion, reduceMotion]);

  const width = motion.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.progressWrap}>
      {label ? <Text style={styles.meta}>{label}</Text> : null}
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: clamped }}
        style={styles.track}
      >
        <Animated.View style={[styles.fill, { width, backgroundColor: color || theme.colors.primary }]} />
      </View>
    </View>
  );
}

const styles = {
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  titleWrap: {
    marginBottom: 18,
  },

  title: {
    color: theme.colors.ink,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  subtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },

  card: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    marginBottom: 12,
  },

  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 8,
  },

  buttonPressed: {
    backgroundColor: theme.colors.primaryDark,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.mint,
  },
  buttonSecondaryPressed: {
    backgroundColor: '#D5EBE6',
  },
  buttonLight: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },

  buttonText: {
    color: theme.colors.onPrimary,
    fontWeight: '700',
    fontSize: 15,
  },

  buttonSecondaryText: {
    color: theme.colors.primaryDark,
  },
  buttonLightText: {
    color: theme.colors.primaryDark,
  },
  disabled: {
    opacity: 0.55,
  },
  textButton: {
    marginTop: 4,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
  },
  textButtonPressed: {
    opacity: 0.6,
  },
  textButtonLabel: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },

  field: {
    marginBottom: 12,
  },

  label: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },

  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.line,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: theme.colors.ink,
    fontSize: 15,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
  },

  empty: {
    alignItems: 'center',
    paddingVertical: 28,
    marginTop: 8,
  },

  emptyMark: {
    width: 28,
    height: 4,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  section: {
    color: theme.colors.ink,
    fontSize: theme.type.section,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginTop: 16,
    marginBottom: 8,
  },
  meta: {
    color: theme.colors.muted,
    fontSize: theme.type.caption,
    lineHeight: 18,
  },
  progressWrap: {
    marginTop: 8,
    gap: 6,
  },
  track: {
    height: 6,
    borderRadius: 6,
    backgroundColor: theme.colors.line,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },

  emptyTitle: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },

  emptyBody: {
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 5,
    maxWidth: 270,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.background,
  },

  error: {
    color: theme.colors.red,
    fontSize: 14,
    marginVertical: 8,
  },

  pill: {
    alignSelf: 'flex-start',
    borderRadius: 30,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  pillText: {
    color: theme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipPressed: {
    backgroundColor: theme.colors.mint,
    borderColor: theme.colors.primary,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  selectCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 10,
  },
  selectCardOn: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.mint,
  },
  selectCardPressed: {
    borderColor: theme.colors.primaryDark,
  },
  selectMark: {
    paddingTop: 2,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.faint,
    backgroundColor: theme.colors.surface,
  },
  radioOn: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  selectTitle: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  selectDetail: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  chipText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: theme.colors.onPrimary,
  },
} as const;