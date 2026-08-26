import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import type { ReceiveMethod } from '@/components/chat/ReceiveMoneyCard';

import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Result = { accounts?: ReceiveMethod[] };

export const ListVirtualAccountsToolUI = makeAssistantToolUI<Record<string, never>, Result>({
  toolName: 'list_virtual_accounts',
  display: 'standalone',
  render: function ListVirtualAccountsToolContent({ result, status }) {
    const { colors } = useTheme();
    const accounts = result?.accounts;

    if (status.type === 'running' && !accounts) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
            Loading virtual accounts…
          </Text>
        </View>
      );
    }

    if (!accounts?.length) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
            No virtual accounts yet. Fund via bank transfer to issue one.
          </Text>
        </View>
      );
    }

    return (
      <View
        className='my-1.5 border p-4 gap-3 border-border bg-composer'
        style={[styles.card]}
      >
        <Text className='font-sans-semibold text-[13px] text-muted-foreground'>
          {accounts.length} virtual account{accounts.length === 1 ? '' : 's'}
        </Text>
        {accounts.map((account) => (
          <View
            key={account.id}
            className='flex-row items-start gap-2.5'
          >
            <View className='flex-1 gap-0.5 min-w-0'>
              <Text className='font-sans-semibold text-[15px] text-foreground'>
                {account.title}
              </Text>
              <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
                {account.fields
                  .slice(0, 2)
                  .map((f) => `${f.label}: ${f.value}`)
                  .join(' · ')}
              </Text>
            </View>
            <Text className='font-sans-semibold text-[14px] text-muted-foreground'>
              {account.currency}
            </Text>
          </View>
        ))}
      </View>
    );
  },
});

const styles = {
  box: {
    borderRadius: Radius.card,
  },
  card: {
    borderRadius: Radius.card,
  },
};
