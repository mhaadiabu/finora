import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import type { Automation } from '@/lib/automations-storage';

import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Result = { automations?: Automation[] };

export const ListAutomationsToolUI = makeAssistantToolUI<Record<string, never>, Result>({
  toolName: 'list_automations',
  display: 'standalone',
  render: function ListAutomationsToolContent({ result, status }) {
    const { colors } = useTheme();
    const automations = result?.automations;

    if (status.type === 'running' && !automations) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
            Loading automations…
          </Text>
        </View>
      );
    }

    if (!automations?.length) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
            No automations yet. Rules only prepare actions — money still needs your approval.
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
          {automations.length} automation{automations.length === 1 ? '' : 's'}
        </Text>
        {automations.map((a) => (
          <View
            key={a.id}
            className='flex-row items-start gap-2.5'
          >
            <View className='flex-1 gap-0.5 min-w-0'>
              <Text className='font-sans-semibold text-[15px] text-foreground'>{a.name}</Text>
              <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
                When {a.trigger} → {a.action}
              </Text>
            </View>
            <Text
              className='font-sans-semibold text-[12px]'
              style={[
                { color: a.status === 'active' ? colors.foreground : colors.mutedForeground },
              ]}
            >
              {a.status === 'active' ? 'Active' : 'Paused'}
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
