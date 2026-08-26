import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import type { BusinessExpense } from '@/lib/expenses-storage';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Result = { expenses?: BusinessExpense[]; total?: number; currency?: string };

export const ListExpensesToolUI = makeAssistantToolUI<Record<string, never>, Result>({
  toolName: 'list_expenses',
  display: 'standalone',
  render: function ListExpensesToolContent({ result, status }) {
    const { colors } = useTheme();
    const expenses = result?.expenses;

    if (status.type === 'running' && !expenses) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[13px] text-muted-foreground'>
            Loading business expenses…
          </Text>
        </View>
      );
    }

    if (!expenses?.length) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <Text className='font-sans-medium text-[13px] text-muted-foreground'>
            No business expenses this month.
          </Text>
        </View>
      );
    }

    const total = result?.total ?? expenses.reduce((s, e) => s + e.amount, 0);
    const currency = result?.currency ?? expenses[0]?.currency ?? 'USD';

    return (
      <View
        className='my-1.5 border p-4 gap-3 border-border bg-composer'
        style={[styles.card]}
      >
        <Text className='font-sans-semibold text-[13px] text-muted-foreground'>
          Business expenses · {formatPaymentAmount(total, currency)}
        </Text>
        {expenses.map((e) => (
          <View
            key={e.id}
            className='flex-row items-center gap-2.5'
          >
            <View className='flex-1 gap-0.5 min-w-0'>
              <Text className='font-sans-semibold text-[15px] text-foreground'>{e.merchant}</Text>
              <Text className='font-sans-medium text-[13px] text-muted-foreground'>
                {e.category}
                {e.cardLabel ? ` · ${e.cardLabel}` : ''}
              </Text>
            </View>
            <Text className='font-sans-semibold text-[14px] text-foreground'>
              {formatPaymentAmount(e.amount, e.currency)}
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
