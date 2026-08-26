import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import type { RecurringFrequency } from '@/components/recurring/types';

import { RecurringPaymentCard, type RecurringDraft } from '@/components/chat/RecurringPaymentCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PrepareRecurringArgs = {
  amount?: number | { amount?: number; currency?: string };
  currency?: string;
  recipientName?: string;
  frequency?: RecurringFrequency;
  destinationKind?: RecurringDraft['destination']['kind'];
  destinationLabel?: string;
  destinationValue?: string;
  reference?: string;
};

type PrepareRecurringResult = {
  status?: 'active' | 'cancelled';
  recurringId?: string;
};

function asDraft(args: PrepareRecurringArgs): RecurringDraft {
  const amount =
    typeof args.amount === 'number'
      ? args.amount
      : typeof args.amount?.amount === 'number'
        ? args.amount.amount
        : 0;
  const currency = typeof args.amount === 'object' ? args.amount.currency : undefined;
  return {
    amount,
    currency: currency ?? args.currency ?? 'GHS',
    recipientName: args.recipientName ?? 'Recipient',
    frequency: args.frequency ?? 'monthly',
    destination: {
      kind: args.destinationKind ?? 'bank_account',
      label: args.destinationLabel ?? 'Bank account',
      value: args.destinationValue ?? '—',
    },
    reference: args.reference,
  };
}

export const PrepareRecurringToolUI = makeAssistantToolUI<
  PrepareRecurringArgs,
  PrepareRecurringResult
>({
  toolName: 'prepare_recurring',
  display: 'standalone',
  render: function PrepareRecurringToolContent({ args, status, addResult }) {
    const { colors } = useTheme();
    const hasArgs = args != null && (args.amount != null || Boolean(args.recipientName));

    if (status.type === 'running' && !hasArgs) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center border-border bg-composer'
          style={[styles.preparing]}
        >
          <LoadingIcon color={colors.mutedForeground} />
        </View>
      );
    }

    return (
      <RecurringPaymentCard
        draft={asDraft(args ?? {})}
        onCreated={(payment) => {
          addResult({ status: 'active', recurringId: payment.id });
        }}
        onCancelled={() => {
          addResult({ status: 'cancelled' });
        }}
      />
    );
  },
});

const styles = {
  preparing: {
    borderRadius: Radius.card,
  },
};
