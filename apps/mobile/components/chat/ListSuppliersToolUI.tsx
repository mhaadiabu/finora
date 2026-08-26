import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import type { Supplier } from '@/lib/suppliers-storage';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListSuppliersResult = {
  suppliers?: Supplier[];
};

export const ListSuppliersToolUI = makeAssistantToolUI<Record<string, never>, ListSuppliersResult>({
  toolName: 'list_suppliers',
  display: 'standalone',
  render: function ListSuppliersToolContent({ result, status }) {
    const { colors } = useTheme();
    const suppliers = result?.suppliers;

    if (status.type === 'running' && !suppliers) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.preparing]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[14px] text-muted-foreground'>
            Loading suppliers…
          </Text>
        </View>
      );
    }

    if (!suppliers?.length) {
      return (
        <View
          className='my-2 border p-4 border-border bg-composer'
          style={[styles.empty]}
        >
          <Text className='font-sans-medium text-[15px] leading-[20px] text-muted-foreground'>
            No suppliers saved yet. Open Suppliers in the drawer to review the directory.
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
          {suppliers.length} supplier{suppliers.length === 1 ? '' : 's'}
        </Text>
        {suppliers.map((supplier) => (
          <View
            key={supplier.id}
            className='flex-row items-center gap-2.5'
          >
            <View className='flex-1 gap-0.5 min-w-0'>
              <Text className='font-sans-semibold text-[15px] text-foreground'>
                {supplier.name}
              </Text>
              <Text className='font-sans-medium text-[13px] text-muted-foreground'>
                {supplier.destination.label}
                {supplier.notes ? ` · ${supplier.notes}` : ''}
              </Text>
            </View>
            {supplier.defaultAmount != null ? (
              <Text className='font-sans-semibold text-[14px] text-foreground'>
                {formatPaymentAmount(supplier.defaultAmount, supplier.currency)}
              </Text>
            ) : (
              <Text className='font-sans-semibold text-[14px] text-muted-foreground'>
                {supplier.currency}
              </Text>
            )}
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
