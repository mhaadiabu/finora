import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

type Args = {
  importId?: string;
  rowId?: string;
  amount?: number;
  currency?: string;
  reference?: string;
};
type Employee = {
  name: string;
  role?: string;
  destination: { label: string; kind: string; value: string };
};
type Result = {
  employee?: Employee;
  amount?: number;
  currency?: string;
  memo?: string;
  preparationId?: string;
  approvalId?: string;
};

function EmployeePayCard({
  employee,
  amount,
  currency,
  memo,
}: {
  employee: Employee;
  amount: number;
  currency: string;
  memo?: string;
}) {
  const { colors } = useTheme();
  const { requestApproval, modal } = usePasscodeApproval();
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  return (
    <>
      <View
        className='w-[100%] border p-4 gap-3 my-1.5 bg-composer border-border'
        style={[styles.card]}
      >
        <View className='flex-row items-center gap-3'>
          <View className='w-9 h-9 rounded-[18px] items-center justify-center bg-muted'>
            <Icon
              name={approved ? 'check' : 'contacts'}
              size={16}
              color={colors.foreground}
            />
          </View>
          <View className='flex-1 gap-0.5 min-w-0'>
            <Text className='text-[12px] font-semibold text-muted-foreground'>
              {approved ? 'Approval recorded' : 'Employee payment ready'}
            </Text>
            <Text className='text-[16px] font-semibold text-foreground'>{employee.name}</Text>
          </View>
          <Text className='text-[16px] font-bold text-foreground'>
            {formatPaymentAmount(amount, currency)}
          </Text>
        </View>
        <Text className='text-[13px] font-medium text-muted-foreground'>
          {employee.role || 'Employee'} · {employee.destination.label}
          {memo ? ` · ${memo}` : ''}
        </Text>
        {approved ? (
          <Text className='text-[13px] font-medium text-muted-foreground'>
            Approved for platform execution. No money was moved by chat.
          </Text>
        ) : (
          <Pressable
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              const ok = await requestApproval();
              setBusy(false);
              if (!ok) return;
              setApproved(true);
              haptics.success();
            }}
            className='min-h-11 items-center justify-center'
            style={({ pressed }) => [
              { backgroundColor: colors.primary, opacity: pressed || busy ? 0.85 : 1 },
            ]}
          >
            <Text
              style={{ color: colors.primaryForeground }}
              className='text-[15px] font-semibold'
            >
              Approve payment
            </Text>
          </Pressable>
        )}
      </View>
      {modal}
    </>
  );
}

export const PrepareEmployeePaymentToolUI = makeAssistantToolUI<Args, Result>({
  toolName: 'prepare_employee_payment',
  display: 'standalone',
  render: function PrepareEmployeePaymentToolContent({ result, status }) {
    const { colors } = useTheme();
    if (status.type === 'running' && !result?.employee)
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='text-[13px] font-medium text-muted-foreground'>
            Preparing employee payment...
          </Text>
        </View>
      );
    if (!result?.employee || result.amount == null || !result.currency)
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <Text className='text-[13px] font-medium text-muted-foreground'>
            Could not prepare that employee payment. Confirm the employee and payroll import.
          </Text>
        </View>
      );
    return (
      <EmployeePayCard
        employee={result.employee}
        amount={result.amount}
        currency={result.currency}
        memo={result.memo}
      />
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
  btn: {
    borderRadius: Radius.composer,
  },
};
