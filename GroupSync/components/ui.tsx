import React from 'react';

import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from 'react-native';

import { theme } from '@/lib/theme';

export function Page({ children, ...props }: ViewProps) {
  return (
    <View style={styles.page} {...props}>
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
  disabled,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        secondary && styles.buttonSecondary,
        disabled && { opacity: 0.55 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && styles.buttonSecondaryText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        placeholderTextColor={theme.colors.faint}
        style={[
          styles.input,
          props.multiline && {
            minHeight: 92,
            textAlignVertical: 'top',
          },
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
      <Text style={styles.emptyIcon}>✦</Text>
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

export function Pill({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: color || theme.colors.mint,
        },
      ]}
    >
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

const styles = {
  page: {
    flex: 1,
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
    marginTop: 8,
  },

  buttonSecondary: {
    backgroundColor: theme.colors.mint,
  },

  buttonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },

  buttonSecondaryText: {
    color: theme.colors.primaryDark,
  },

  field: {
    marginBottom: 12,
  },

  label: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },

  input: {
    backgroundColor: 'white',
    borderColor: theme.colors.line,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: theme.colors.ink,
    fontSize: 15,
  },

  empty: {
    alignItems: 'center',
    paddingVertical: 28,
    marginTop: 8,
  },

  emptyIcon: {
    color: theme.colors.primary,
    fontSize: 25,
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
    fontWeight: '800',
  },
} as const;