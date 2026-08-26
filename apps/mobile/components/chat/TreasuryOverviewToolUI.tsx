import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import type { TreasuryOverview } from '@/lib/treasury';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Result = { overview?: TreasuryOverview };

export const TreasuryOverviewToolUI = makeAssistantToolUI<Record<string, never>, Result>({
  toolName: 'get_treasury_overview',
  display: 'standalone',
  render: function TreasuryOverviewToolContent({ result, status }) {
    const { colors } = useTheme();
    const overview = result?.overview;

    if (status.type === 'running' && !overview) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
            Building treasury overview…
          </Text>
        </View>
      );
    }

    if (!overview) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
            Couldn’t load treasury.
          </Text>
        </View>
      );
    }

    return (
      <View
        className='my-1.5 border p-4 gap-2 border-border bg-composer'
        style={[styles.card]}
      >
        <Text className='font-sans-semibold text-[12px] text-muted-foreground'>Treasury</Text>
        <Text className='font-sans-semibold text-[28px] tracking-[-0.5px] text-foreground'>
          {formatPaymentAmount(overview.totalUsd, 'USD')}
        </Text>
        <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
          Total across wallets (USD equivalent)
        </Text>

        <View className='mt-1.5 gap-2'>
          {overview.balances.map((b) => (
            <View
              key={b.currency}
              className='flex-row items-center justify-between gap-2.5'
            >
              <Text className='font-sans-semibold text-[15px] text-foreground'>{b.currency}</Text>
              <Text className='font-sans-semibold text-[14px] text-foreground'>
                {formatPaymentAmount(b.balance, b.currency)}
              </Text>
            </View>
          ))}
        </View>

        {overview.upcomingOutflows.length > 0 ? (
          <View className='mt-1.5 gap-2'>
            <Text className='font-sans-semibold text-[12px] text-muted-foreground'>
              Upcoming outflows
            </Text>
            {overview.upcomingOutflows.slice(0, 5).map((item, i) => (
              <View
                key={`${item.label}-${i}`}
                className='flex-row items-center justify-between gap-2.5'
              >
                <Text
                  className='font-sans-semibold text-[15px] text-foreground'
                  style={[{ flex: 1 }]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                <Text className='font-sans-semibold text-[14px] text-foreground'>
                  {formatPaymentAmount(item.amount, item.currency)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {overview.notes.map((note) => (
          <Text
            key={note}
            className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'
          >
            {note}
          </Text>
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
