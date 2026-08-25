import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { applyPayrollProposal, cancelPayrollProposal } from '@/lib/payroll-api';

type Change = {
  rowId: string;
  operation: 'update' | 'delete';
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};
type Result = {
  proposalId?: string;
  sourceName?: string;
  before?: { employeeCount?: number; total?: number; currency?: string };
  after?: { employeeCount?: number; total?: number; currency?: string };
  changes?: Change[];
};

const FIELD_LABELS: Record<string, string> = {
  employeeName: 'Name',
  employeeId: 'Employee ID',
  role: 'Position',
  amount: 'Amount',
  currency: 'Currency',
  destinationType: 'Destination type',
  destination: 'Destination',
  rail: 'Network / bank',
  period: 'Pay period',
  payDate: 'Pay date',
  reference: 'Reference',
};

function changeDiffs(change: Change) {
  if (change.operation === 'delete') return [];
  return Object.keys(FIELD_LABELS).flatMap((key) =>
    JSON.stringify(change.before?.[key]) === JSON.stringify(change.after?.[key])
      ? []
      : [
          {
            key,
            label: FIELD_LABELS[key],
            before: String(change.before?.[key] ?? 'Not set'),
            after: String(change.after?.[key] ?? 'Not set'),
          },
        ],
  );
}

export const ProposePayrollChangesToolUI = makeAssistantToolUI<Record<string, unknown>, Result>({
  toolName: 'propose_payroll_changes',
  display: 'standalone',
  render: function ProposePayrollChangesToolContent({ result, status }) {
    const { colors } = useTheme();
    const { getToken } = useAuth();
    const [phase, setPhase] = useState<'pending' | 'applying' | 'applied' | 'cancelled'>('pending');
    const [error, setError] = useState<string | null>(null);
    if (status.type === 'running' && !result)
      return (
        <View
          className='my-2 min-h-[68px] border p-4 items-center justify-center gap-2 border-border bg-composer'
          style={[styles.loading]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='text-muted-foreground'>Preparing payroll changes...</Text>
        </View>
      );
    if (!result?.proposalId || !result.changes)
      return (
        <View
          className='my-2 border p-4 gap-3 border-border bg-composer'
          style={[styles.card]}
        >
          <Text className='text-destructive'>
            I could not prepare a safe payroll change proposal.
          </Text>
        </View>
      );
    if (phase === 'applied' || phase === 'cancelled')
      return (
        <Animated.View
          entering={FadeInDown.duration(220)}
          className='my-2 border p-4 gap-3 border-border bg-composer'
          style={[styles.card]}
        >
          <View className='flex-row items-center gap-2.5'>
            <View className='w-[34px] h-[34px] rounded-[17px] justify-center items-center bg-muted'>
              <Icon
                name={phase === 'applied' ? 'check' : 'close-circle'}
                size={17}
                color={colors.foreground}
              />
            </View>
            <View className='flex-1'>
              <Text className='text-[12px] font-semibold text-muted-foreground'>
                {phase === 'applied' ? 'Payroll updated' : 'Changes cancelled'}
              </Text>
              <Text className='text-[16px] font-bold text-foreground'>
                {result.sourceName ?? 'Payroll'}
              </Text>
            </View>
          </View>
          <Text className='text-[13px] text-muted-foreground'>
            {phase === 'applied'
              ? 'The approved changes are saved. No money was moved.'
              : 'No payroll data was changed.'}
          </Text>
        </Animated.View>
      );
    const before = result.before ?? {};
    const after = result.after ?? {};
    const cancel = async () => {
      setError(null);
      try {
        await cancelPayrollProposal(result.proposalId!, getToken);
        setPhase('cancelled');
        haptics.selection();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not cancel payroll changes.');
      }
    };
    const approve = async () => {
      setPhase('applying');
      setError(null);
      try {
        await applyPayrollProposal(result.proposalId!, getToken);
        setPhase('applied');
        haptics.success();
      } catch (cause) {
        setPhase('pending');
        setError(cause instanceof Error ? cause.message : 'Could not apply payroll changes.');
      }
    };
    return (
      <Animated.View
        entering={FadeInDown.duration(260)}
        className='my-2 border p-4 gap-3 border-border bg-composer'
        style={[styles.card]}
      >
        <View className='flex-row items-center gap-2.5'>
          <View className='w-[34px] h-[34px] rounded-[17px] justify-center items-center bg-muted'>
            <Icon
              name='edit'
              size={17}
              color={colors.foreground}
            />
          </View>
          <View className='flex-1'>
            <Text className='text-[12px] font-semibold text-muted-foreground'>Review changes</Text>
            <Text className='text-[16px] font-bold text-foreground'>
              {result.sourceName ?? 'Payroll'}
            </Text>
          </View>
          <Text className='text-[18px] font-bold text-foreground'>{result.changes.length}</Text>
        </View>
        <Text className='text-[13px] text-muted-foreground'>
          {before.employeeCount ?? 0} employees to {after.employeeCount ?? 0} Â·{' '}
          {String(after.currency ?? before.currency ?? '')}{' '}
          {Number(before.total ?? 0).toLocaleString()} to{' '}
          {Number(after.total ?? 0).toLocaleString()}
        </Text>
        <View>
          {result.changes.map((change, index) => {
            const name = String(
              change.before?.employeeName ?? change.after?.employeeName ?? 'Employee',
            );
            const diffs = changeDiffs(change);
            return (
              <Animated.View
                entering={FadeInUp.delay(index * 35).duration(180)}
                key={`${change.rowId}:${index}`}
                className='min-h-[46px] border-t py-[9px] flex-row items-start gap-[9px]'
                style={[{ borderTopColor: colors.border }]}
              >
                <View
                  className='w-[7px] h-[7px] rounded-[4px] mt-1.5'
                  style={[
                    {
                      backgroundColor:
                        change.operation === 'delete' ? colors.destructive : colors.foreground,
                    },
                  ]}
                />
                <View className='flex-1'>
                  <Text className='text-[14px] font-semibold mb-[3px] text-foreground'>{name}</Text>
                  {change.operation === 'delete' ? (
                    <Text className='text-[13px] text-destructive'>Removed from payroll</Text>
                  ) : (
                    diffs.map((diff) => (
                      <View
                        key={diff.key}
                        className='min-h-[22px] flex-row items-center gap-[5px]'
                      >
                        <Text className='w-[74px] text-[11px] text-muted-foreground'>
                          {diff.label}
                        </Text>
                        <Text
                          numberOfLines={1}
                          className='max-w-[74px] text-[12px] line-through text-muted-foreground'
                        >
                          {diff.before}
                        </Text>
                        <Icon
                          name='chevron-right'
                          size={12}
                          color={colors.mutedForeground}
                        />
                        <Text
                          numberOfLines={1}
                          className='flex-1 text-[12px] font-semibold text-foreground'
                        >
                          {diff.after}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
                <Icon
                  name={change.operation === 'delete' ? 'remove' : 'edit'}
                  size={16}
                  color={
                    change.operation === 'delete' ? colors.destructive : colors.mutedForeground
                  }
                />
              </Animated.View>
            );
          })}
        </View>
        {error ? <Text className='text-destructive'>{error}</Text> : null}
        <View className='flex-row gap-2'>
          <Pressable
            disabled={phase === 'applying'}
            onPress={() => void cancel()}
            className='flex-1 min-h-11 border items-center justify-center border-border'
            style={[styles.secondary]}
          >
            <Text className='text-foreground'>Cancel</Text>
          </Pressable>
          <Pressable
            disabled={phase === 'applying'}
            onPress={() => void approve()}
            className='flex-[1.4] min-h-11 items-center justify-center bg-primary'
            style={[styles.primary, { opacity: phase === 'applying' ? 0.6 : 1 }]}
          >
            <Text className='text-primary-foreground'>
              {phase === 'applying' ? 'Applying...' : 'Approve changes'}
            </Text>
          </Pressable>
        </View>
        <Text className='text-[12px] text-center text-muted-foreground'>
          Edits payroll data only. No money is moved.
        </Text>
      </Animated.View>
    );
  },
});

const styles = {
  loading: {
    borderRadius: Radius.card,
  },
  card: {
    borderRadius: Radius.card,
  },
  secondary: {
    borderRadius: Radius.composer,
  },
  primary: {
    borderRadius: Radius.composer,
  },
};
