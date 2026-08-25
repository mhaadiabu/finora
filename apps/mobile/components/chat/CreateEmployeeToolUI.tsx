import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import type { Employee } from '@/lib/employees-storage';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';

type CreateEmployeeArgs = {
  name?: string;
  role?: string;
  salary?: number;
  currency?: string;
};

type CreateEmployeeResult = {
  employee?: Employee;
};

function EmployeeAddedCard({ employee }: { employee: Employee }) {
  const aui = useAui();
  const followedUp = useRef(false);

  useEffect(() => {
    if (followedUp.current) return;
    followedUp.current = true;
    appendAgentFollowUp(
      aui,
      `Added ${employee.name} (${employee.role}) at ${formatPaymentAmount(
        employee.salary,
        employee.currency,
      )}/period. Say “Run payroll” when you’re ready.`,
    );
  }, [aui, employee]);

  return (
    <View
      className='my-1.5 border p-4 gap-1 border-border bg-composer'
      style={[styles.card]}
    >
      <Text className='font-sans-semibold text-[12px] text-muted-foreground'>Employee added</Text>
      <Text className='font-sans-semibold text-[16px] text-foreground'>{employee.name}</Text>
      <Text className='font-sans-medium text-[13px] text-muted-foreground'>
        {employee.role} · {formatPaymentAmount(employee.salary, employee.currency)} ·{' '}
        {employee.destination.label}
      </Text>
    </View>
  );
}

export const CreateEmployeeToolUI = makeAssistantToolUI<CreateEmployeeArgs, CreateEmployeeResult>({
  toolName: 'create_employee',
  display: 'standalone',
  render: function CreateEmployeeToolContent({ result, status }) {
    const { colors } = useTheme();
    const employee = result?.employee;

    if (status.type === 'running' && !employee) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.preparing]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[14px] text-muted-foreground'>
            Adding employee…
          </Text>
        </View>
      );
    }

    if (!employee) {
      return (
        <View
          className='my-2 border p-4 border-border bg-composer'
          style={[styles.empty]}
        >
          <Text className='font-sans-medium text-[15px] leading-[20px] text-muted-foreground'>
            Couldn’t add that employee. Try “Add employee Ama Boateng designer 2500 USD”.
          </Text>
        </View>
      );
    }

    return <EmployeeAddedCard employee={employee} />;
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
};
