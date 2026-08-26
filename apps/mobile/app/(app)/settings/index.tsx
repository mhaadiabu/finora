import { useClerk, useUser } from '@clerk/expo';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { UserAvatar } from '@/components/profile/UserAvatar';
import {
  SettingsRow,
  SettingsScreen,
  SettingsSection,
} from '@/components/settings/SettingsPrimitives';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { getAccountFullLabel, getAccountType } from '@/lib/account';
import { useAuthGate } from '@/lib/auth-gate';
import { haptics } from '@/lib/haptics';
import { useOnboardingGate } from '@/lib/onboarding-gate';
import { hasPasscode } from '@/lib/passcode-storage';
import { resetFinoraSession } from '@/lib/reset-session';
import { useSettings } from '@/lib/settings-context';
import { signOutFinora } from '@/lib/sign-out';
import { usePressGuard } from '@/lib/use-press-guard';

export default function SettingsHubScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { settings, loading, refresh, t } = useSettings();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { markTagUnconfigured } = useAuthGate();
  const { markIncomplete } = useOnboardingGate();
  const [hasPin, setHasPin] = useState(false);
  const [accountType, setAccountTypeLocal] = useState(getAccountType());
  const navigateOnce = usePressGuard();

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void hasPasscode().then(setHasPin);
      setAccountTypeLocal(getAccountType());
    }, [refresh]),
  );

  const themeLabel = () => {
    switch (settings.theme) {
      case 'light':
        return t('settings_theme_light');
      case 'dark':
        return t('settings_theme_dark');
      default:
        return t('settings_theme_system');
    }
  };

  const notifSummary = () => {
    const on = [
      settings.notifications.approvals,
      settings.notifications.payments,
      settings.notifications.invoices,
      settings.notifications.marketing,
    ].filter(Boolean).length;
    if (on === 0) return t('settings_notif_off');
    if (on === 4) return t('settings_notif_all_on');
    return `${on} on`;
  };

  const handleSignOut = () => {
    Alert.alert(t('settings_sign_out'), t('settings_sign_out_confirm'), [
      { text: t('action_cancel'), style: 'cancel' },
      {
        text: t('settings_sign_out'),
        style: 'destructive',
        onPress: async () => {
          haptics.selection();
          await signOutFinora(signOut);
          haptics.success();
          router.replace('/auth' as Href);
        },
      },
    ]);
  };

  const handleReset = () => {
    Alert.alert(t('settings_reset_title'), t('settings_reset_confirm'), [
      { text: t('action_cancel'), style: 'cancel' },
      {
        text: t('settings_reset_title'),
        style: 'destructive',
        onPress: async () => {
          haptics.selection();
          await resetFinoraSession();
          await signOut();
          markTagUnconfigured();
          markIncomplete();
          haptics.success();
          router.replace('/onboarding' as Href);
        },
      },
    ]);
  };

  return (
    <SettingsScreen loading={loading}>
      <SettingsSection>
        <Pressable
          onPress={() => {
            haptics.selection();
            navigateOnce(() => router.push('/settings/account' as Href));
          }}
          className='flex-row items-center gap-3.5 px-3.5 py-4'
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <UserAvatar
            accountType={accountType}
            backgroundColor={colors.muted}
            displayName={settings.displayName}
            foregroundColor={colors.foreground}
            imageUrl={user?.imageUrl}
            seed={user?.id ?? settings.email}
            size={52}
          />
          <View className='min-w-0 flex-1 gap-0.5'>
            <Text className='font-sans-semibold text-lg tracking-[-0.3px] text-foreground'>
              {settings.displayName}
            </Text>
            <Text
              className='font-sans-medium text-[15px] text-muted-foreground'
              numberOfLines={1}
            >
              {settings.email}
            </Text>
            <Text className='mt-0.5 font-sans-medium text-sm text-muted-foreground'>
              {getAccountFullLabel(accountType)}
            </Text>
          </View>
          <Icon
            name='chevron-right'
            size={18}
            color={colors.mutedForeground}
          />
        </Pressable>
      </SettingsSection>

      <SettingsSection title={t('settings_section_app')}>
        <SettingsRow
          label={t('settings_security_label')}
          detail={hasPin ? t('settings_passcode_on') : t('settings_passcode_off')}
          icon='shield'
          showChevron
          onPress={() => navigateOnce(() => router.push('/settings/security' as Href))}
        />
        <SettingsRow
          label={t('settings_memory_label')}
          detail={t('settings_memory_detail')}
          icon='brain'
          showChevron
          onPress={() => navigateOnce(() => router.push('/settings/memory' as Href))}
        />
        <SettingsRow
          label={t('settings_notifications_label')}
          detail={notifSummary()}
          icon='activity'
          showChevron
          onPress={() => navigateOnce(() => router.push('/settings/notifications' as Href))}
        />
        <SettingsRow
          label={t('settings_appearance_label')}
          detail={`${themeLabel()} \u00b7 ${settings.language === 'fr' ? t('settings_lang_fr') : t('settings_lang_en')}`}
          icon='eye'
          showChevron
          isLast
          onPress={() => navigateOnce(() => router.push('/settings/display' as Href))}
        />
      </SettingsSection>

      <SettingsSection title={t('settings_section_more')}>
        <SettingsRow
          label={t('settings_integrations_label')}
          detail={t('settings_integrations_detail')}
          icon='integrations'
          showChevron
          onPress={() => navigateOnce(() => router.push('/integrations' as Href))}
        />
        <SettingsRow
          label={t('settings_approvals_label')}
          detail={t('settings_approvals_detail')}
          icon='shield'
          showChevron
          onPress={() => navigateOnce(() => router.push('/approvals' as Href))}
        />
        <SettingsRow
          label={t('settings_about_label')}
          detail={`v${Constants.expoConfig?.version ?? '0.1.0'}`}
          icon='info'
          showChevron
          isLast
          onPress={() => navigateOnce(() => router.push('/settings/about' as Href))}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          label={t('settings_sign_out')}
          icon='arrow-up'
          destructive
          showChevron
          isLast
          onPress={handleSignOut}
        />
      </SettingsSection>

      {__DEV__ ? (
        <SettingsSection
          title={t('settings_section_developer')}
          footer={t('settings_dev_footer')}
        >
          <SettingsRow
            label={t('settings_reset_label')}
            detail={t('settings_reset_detail')}
            icon='reload'
            destructive
            showChevron
            isLast
            onPress={handleReset}
          />
        </SettingsSection>
      ) : null}
    </SettingsScreen>
  );
}
