import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import type { RecurringFrequency } from '@/components/recurring/types';

import {
  SchedulePaymentWizard,
  type ScheduleWizardSeed,
} from '@/components/chat/SchedulePaymentWizard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScheduleWizardArgs = ScheduleWizardSeed & {
  frequency?: RecurringFrequency;
};

type ScheduleWizardResult = {
  status?: 'active' | 'cancelled';
  recurringId?: string;
};

export const SchedulePaymentWizardToolUI = makeAssistantToolUI<
  ScheduleWizardArgs,
  ScheduleWizardResult
>({
  toolName: 'schedule_payment_wizard',
  display: 'standalone',
  render: function SchedulePaymentWizardToolContent({ args, status, addResult }) {
    const { colors } = useTheme();

    if (status.type === 'running' && args == null) {
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
      <SchedulePaymentWizard
        seed={args ?? {}}
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
