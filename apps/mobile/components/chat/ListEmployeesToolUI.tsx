import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListEmployeesResult = {
  employees?: Array<{
    id?: string;
    importId?: string;
    rowId?: string;
    name: string;
    role: string;
    salary: number;
    currency: string;
    destination: { label: string };
  }>;
};

export const ListEmployeesToolUI = makeAssistantToolUI<Record<string, never>, ListEmployeesResult>({
  toolName: 'list_employees',
  display: 'standalone',
  render: function ListEmployeesToolContent({ result, status }) {
    const { colors } = useTheme();
    const employees = result?.employees;

    if (status.type === 'running' && !employees) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.preparing]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[14px] text-muted-foreground'>
            Loading team roster…
          </Text>
        </View>
      );
    }

    if (!employees?.length) {
      return (
        <View
          className='my-2 border p-4 border-border bg-composer'
          style={[styles.empty]}
        >
          <Text className='font-sans-medium text-[15px] leading-[20px] text-muted-foreground'>
            No employees yet. Open Payroll to add your team, or say “Add employee…”.
          </Text>
        </View>
      );
    }

    const total = employees.reduce((sum, e) => sum + e.salary, 0);
    const currency = employees[0]?.currency ?? 'USD';

    return (
      <View
        className='my-1.5 border p-4 gap-3 border-border bg-composer'
        style={[styles.card]}
      >
        <Text className='font-sans-semibold text-[13px] text-muted-foreground'>
          {employees.length} employee{employees.length === 1 ? '' : 's'} · payroll{' '}
          {formatPaymentAmount(total, currency)}
        </Text>
        {employees.map((employee, index) => (
          <View
            key={employee.id ?? `${employee.importId ?? 'payroll'}:${employee.rowId ?? index}`}
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
};
