import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import type { Beneficiary } from '@/lib/beneficiaries-storage';

import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Result = { beneficiaries?: Beneficiary[] };

export const ListBeneficiariesToolUI = makeAssistantToolUI<Record<string, never>, Result>({
  toolName: 'list_beneficiaries',
  display: 'standalone',
  render: function ListBeneficiariesToolContent({ result, status }) {
    const { colors } = useTheme();
    const beneficiaries = result?.beneficiaries;

    if (status.type === 'running' && !beneficiaries) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[13px] text-muted-foreground'>
            Loading beneficiaries…
          </Text>
        </View>
      );
    }

    if (!beneficiaries?.length) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <Text className='font-sans-medium text-[13px] text-muted-foreground'>
            No payout beneficiaries saved yet.
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
          {beneficiaries.length} beneficiar{beneficiaries.length === 1 ? 'y' : 'ies'}
        </Text>
        {beneficiaries.map((b) => (
          <View
            key={b.id}
            className='flex-row items-center gap-2.5'
          >
            <View className='flex-1 gap-0.5 min-w-0'>
              <Text className='font-sans-semibold text-[15px] text-foreground'>{b.name}</Text>
              <Text className='font-sans-medium text-[13px] text-muted-foreground'>
                {b.rail ?? b.method} · {b.identifier}
                {b.verified ? ' · Verified' : ''}
              </Text>
            </View>
            <Text className='font-sans-semibold text-[14px] text-muted-foreground'>
              {b.currency}
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
