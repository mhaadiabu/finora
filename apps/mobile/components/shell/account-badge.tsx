import { Animated, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getAccountFullLabel, getAccountLabel, getAccountType } from '@/lib/account';

type AccountBadgeProps = {
  /** Compact pill for headers; full label for drawer. */
  variant?: 'pill' | 'text';
};

export function AccountBadge({ variant = 'pill' }: AccountBadgeProps) {
  const { colors } = useTheme();
  const type = getAccountType();
  const label = getAccountLabel(type);

  if (variant === 'text') {
    return (
      <Text style={[styles.text, { color: colors.mutedForeground }]}>
        {getAccountFullLabel(type)}
      </Text>
    );
  }

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: colors.muted,
          borderColor: colors.border,
        },
      ]}
      accessibilityLabel={`${label} account`}
    >
      <View
        style={[
          styles.dot,
          {
            backgroundColor: type === 'business' ? colors.foreground : colors.mutedForeground,
          },
        ]}
      />
      <Text style={[styles.pillLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

type HeaderTitleProps = {
  title: string;
};

/** Centered header title with account type pill underneath. */
export function HeaderTitleWithAccount({ title }: HeaderTitleProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.headerTitle}>
      <Text
        numberOfLines={1}
        style={[styles.title, { color: colors.foreground }]}
      >
        {title}
      </Text>
      <AccountBadge />
    </View>
  );
}

export function CollapsibleHeaderTitle({
  title,
  scrollY,
  topInset = 0,
}: HeaderTitleProps & { scrollY: Animated.Value; topInset?: number }) {
  const { colors } = useTheme();
  const titleOpacity = scrollY.interpolate({
    inputRange: [28 - topInset, 72 - topInset],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const titleTranslateY = scrollY.interpolate({
    inputRange: [28 - topInset, 72 - topInset],
    outputRange: [5, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.headerTitle}>
      <Animated.Text
        numberOfLines={1}
        style={[
          styles.title,
          {
            color: colors.foreground,
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslateY }],
          },
        ]}
      >
        {title}
      </Animated.Text>
      <AccountBadge />
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  pillLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  text: {
    marginTop: 2,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
  },
});
