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
import { defaultPayrollPeriod, type Employee } from '@/lib/employees-storage';
import { haptics } from '@/lib/haptics';

type PreparePayrollArgs = {
  period?: string;
  importId: string;
};

type PreparePayrollResult = {
  period?: string;
  employees?: Employee[];
  total?: number;
  currency?: string;
  preparationId?: string;
};

function PayrollConfirmCard({
  period,
  employees,
  total,
  currency,
}: {
  period: string;
  employees: Employee[];
  total: number;
  currency: string;
}) {
  const { colors } = useTheme();
  const { requestApproval, modal } = usePasscodeApproval();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'approved'>('idle');

  return (
    <>
      <View
        className='w-[100%] border p-4 gap-3.5 my-1.5 bg-composer border-border'
        style={[styles.card]}
      >
        <View className='flex-row items-center gap-3'>
          <View className='w-9 h-9 rounded-[18px] items-center justify-center bg-muted'>
            {
              <Icon
                name={phase === 'approved' ? 'check' : 'contacts'}
                size={16}
                color={colors.foreground}
              />
            }
          </View>
          <View className='flex-1 gap-0.5 min-w-0'>
            <Text className='font-sans-semibold text-[12px] text-muted-foreground'>
              {phase === 'approved' ? 'Approval recorded' : 'Payroll ready'}
            </Text>
            <Text className='font-sans-semibold text-[16px] text-foreground'>{period}</Text>
          </View>
          <Text className='font-sans-semibold text-[16px] text-foreground'>
            {formatPaymentAmount(total, currency)}
          </Text>
        </View>

        <View className='gap-2.5'>
          {employees.map((employee, index) => (
            <View
              key={`${employee.id}:${index}`}
              className='flex-row items-center gap-2.5'
            >
              <View className='flex-1 gap-0.5 min-w-0'>
                <Text className='font-sans-semibold text-[15px] text-foreground'>
                  {employee.name}
                </Text>
                <Text className='font-sans-medium text-[13px] text-muted-foreground'>
                  {employee.role} · {employee.destination.label}
                </Text>
              </View>
              <Text className='font-sans-semibold text-[14px] text-foreground'>
                {formatPaymentAmount(employee.salary, employee.currency)}
              </Text>
            </View>
          ))}
        </View>

        {phase === 'idle' ? (
          <Pressable
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              const ok = await requestApproval();
              setBusy(false);
              if (!ok) return;
              setPhase('approved');
              haptics.success();
            }}
            className='min-h-11 items-center justify-center'
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                opacity: pressed || busy ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={{ color: colors.primaryForeground }}
              className='font-sans-semibold text-[15px]'
            >
              Approve payroll
            </Text>
          </Pressable>
        ) : null}
      </View>
      {modal}
    </>
  );
}

export const PreparePayrollToolUI = makeAssistantToolUI<PreparePayrollArgs, PreparePayrollResult>({
  toolName: 'prepare_payroll',
  display: 'standalone',
  render: function PreparePayrollToolContent({ args, result, status }) {
    const { colors } = useTheme();
    const employees = result?.employees;
    const period = result?.period ?? args.period ?? defaultPayrollPeriod();
    const total = result?.total;
    const currency = result?.currency ?? 'USD';

    if (status.type === 'running' && !employees) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.preparing]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[14px] text-muted-foreground'>
            Preparing payroll…
          </Text>
        </View>
      );
    }

    if (!employees?.length || total == null) {
      return (
        <View
          className='my-2 border p-4 border-border bg-composer'
          style={[styles.empty]}
        >
          <Text className='font-sans-medium text-[15px] leading-[20px] text-muted-foreground'>
            Payroll could not be prepared. Resolve the import validation issues and try again.
          </Text>
        </View>
      );
    }

    return (
      <PayrollConfirmCard
        period={period}
        employees={employees}
        total={total}
        currency={currency}
      />
    );
  },
});

const styles = {
  preparing: {
    borderRadius: Radius.card,
  },
  empty: {
    borderRadius: Radius.card,
  },
  card: {
    borderRadius: Radius.card,
  },
  btn: {
    borderRadius: Radius.composer,
  },
};
