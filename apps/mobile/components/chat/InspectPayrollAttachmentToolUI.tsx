import type { PayrollInspectionResponse } from '@finora/shared';

import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const InspectPayrollAttachmentToolUI = makeAssistantToolUI<
  { attachmentId: string },
  PayrollInspectionResponse
>({
  toolName: 'inspect_payroll_attachment',
  display: 'standalone',
  render: function InspectPayrollAttachmentToolContent({ result, status }) {
    const { colors } = useTheme();
    if (status.type === 'running' || !result) {
      return (
        <View
          className='w-[100%] border p-4 gap-2.5 my-1.5 min-h-[72px] flex-row items-center justify-center bg-composer border-border'
          style={[styles.card]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='text-muted-foreground'>Reading payroll attachment...</Text>
        </View>
      );
    }
    if (!result.ok) {
      return (
        <View
          className='w-[100%] border p-4 gap-2.5 my-1.5 bg-composer border-border'
          style={[styles.card]}
        >
          <Text className='text-[16px] font-bold text-foreground'>
            Payroll file could not be read
          </Text>
          <Text className='text-muted-foreground'>
            {result.errorCode ?? 'Please check the file and try again.'}
          </Text>
        </View>
      );
    }
    const blocked = (result.blockingIssues?.length ?? 0) > 0;
    return (
      <View
        className='w-[100%] border p-4 gap-2.5 my-1.5 bg-composer border-border'
        style={[styles.card]}
      >
        <Text className='text-[12px] font-semibold text-muted-foreground'>
          {blocked ? 'Needs review' : 'Payroll extracted'}
        </Text>
        <Text className='text-[16px] font-bold text-foreground'>{result.sourceName}</Text>
        <View className='flex-row items-center justify-between'>
          <Text className='text-foreground'>{result.rows?.length ?? 0} employees</Text>
          {result.totals ? (
            <Text className='font-bold text-foreground'>
              {formatPaymentAmount(result.totals.total, result.totals.currency)}
            </Text>
          ) : null}
        </View>
        {result.rows?.map((row) => (
          <View
            key={row.rowId}
            className='flex-row items-center gap-3'
          >
            <View className='flex-1 min-w-0'>
              <Text className='text-foreground'>{row.employeeName ?? 'Unnamed employee'}</Text>
              <Text className='text-[12px] text-muted-foreground'>
                {row.citations[0]?.location ?? 'Imported row'}
              </Text>
            </View>
            <Text className='text-foreground'>
              {row.amount == null
                ? 'Amount needed'
                : formatPaymentAmount(row.amount, row.currency ?? 'USD')}
            </Text>
          </View>
        ))}
        {blocked ? (
          <Text className='text-[13px] leading-[18px] text-destructive'>
            {result.blockingIssues?.[0]?.message} Fix the flagged rows before approval.
          </Text>
        ) : (
          <Text className='text-muted-foreground'>
            Validated and ready for payroll preparation. Approval is still required.
          </Text>
        )}
      </View>
    );
  },
});

const styles = {
  card: {
    borderRadius: Radius.card,
  },
};
