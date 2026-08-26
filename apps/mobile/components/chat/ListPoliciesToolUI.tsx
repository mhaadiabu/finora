import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import type { ApprovalPolicy } from '@/lib/policies-storage';

import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Result = {
  policies?: ApprovalPolicy[];
  simulation?: { requiresApproval: boolean; matched: string[] };
};

export const ListPoliciesToolUI = makeAssistantToolUI<
  { amountUsd?: number; isNewRecipient?: boolean },
  Result
>({
  toolName: 'list_policies',
  display: 'standalone',
  render: function ListPoliciesToolContent({ result, status }) {
    const { colors } = useTheme();
    const policies = result?.policies;
    const simulation = result?.simulation;

    if (status.type === 'running' && !policies) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
            Loading approval policies…
          </Text>
        </View>
      );
    }

    if (!policies?.length) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
            No approval policies configured.
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
          Approval policies
        </Text>
        {policies.map((p) => (
          <View
            key={p.id}
            className='flex-row items-start gap-2.5'
          >
            <View className='flex-1 gap-0.5 min-w-0'>
              <Text className='font-sans-semibold text-[15px] text-foreground'>{p.name}</Text>
              <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
                {p.rule}
              </Text>
            </View>
            <Text
              className='font-sans-semibold text-[13px]'
              style={[{ color: p.enabled ? colors.foreground : colors.mutedForeground }]}
            >
              {p.enabled ? 'On' : 'Off'}
            </Text>
          </View>
        ))}
        {simulation ? (
          <Text
            className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'
            style={[{ marginTop: 4 }]}
          >
            {simulation.requiresApproval
              ? `This action would require approval${
                  simulation.matched.length ? ` (${simulation.matched.join(', ')})` : ''
                }.`
              : 'This action would not hit an enabled policy rule.'}
          </Text>
        ) : null}
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
