import { useAuth, useClerk, useUser } from '@clerk/expo';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { UserAvatar } from '@/components/profile/UserAvatar';
import {
  SettingsRow,
  SettingsScreen,
  SettingsSection,
  SettingsSegmented,
} from '@/components/settings/SettingsPrimitives';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { getAccountType, setAccountType } from '@/lib/account';
import { haptics } from '@/lib/haptics';
import { completeOnboarding } from '@/lib/onboarding-storage';
import { updateUserProfile } from '@/lib/profile-api';
import { useSettings } from '@/lib/settings-context';
import { signOutFinora } from '@/lib/sign-out';

export default function AccountSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { settings, loading, refresh, t } = useSettings();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [accountType, setAccountTypeLocal] = useState(getAccountType());

  useFocusEffect(
    useCallback(() => {
      void refresh();
      setAccountTypeLocal(getAccountType());
    }, [refresh]),
  );

  const handleAccountType = async (type: 'personal' | 'business') => {
    if (type === accountType) return;

    setAccountType(type);
    setAccountTypeLocal(type);
    await completeOnboarding(type);
    haptics.selection();

    try {
      await updateUserProfile(getToken, { accountType: type });
    } catch (error) {
      // Keep the local selection usable; profile sync will retry it on the next session.
      if (__DEV__) console.warn('Account type sync deferred.', error);
    }
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

  return (
    <SettingsScreen loading={loading}>
      <SettingsSection>
        <View className='flex-row items-center gap-3.5 px-3.5 py-4'>
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
            <Text className='font-sans-medium text-[15px] text-muted-foreground'>
              @{settings.finoraTag} · {settings.email}
            </Text>
          </View>
        </View>
      </SettingsSection>

      <SettingsSection
        title={t('account_type_title')}
        footer={t('account_type_footer')}
      >
        <View className='px-3.5 py-3.5'>
          <SettingsSegmented
            value={accountType}
            onChange={(id) => void handleAccountType(id as 'personal' | 'business')}
            options={[
              { id: 'personal', label: t('account_type_personal') },
              { id: 'business', label: t('account_type_business') },
            ]}
          />
        </View>
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
    </SettingsScreen>
  );
}
