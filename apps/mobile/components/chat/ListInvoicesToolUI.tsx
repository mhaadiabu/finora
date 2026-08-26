import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { RemoteInvoiceSchema } from '@finora/shared';
import { View } from 'react-native';

import type { Invoice } from '@/components/invoices/types';

import { InvoiceCard } from '@/components/chat/InvoiceCard';
import { invoiceFromRemote } from '@/components/invoices/types';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListInvoicesArgs = {
  source?: 'gmail' | 'all';
  status?: 'due' | 'all';
};

type ListInvoicesResult = {
  invoices?: unknown[];
};

function normalizeInvoice(value: unknown): Invoice | null {
  const remote = RemoteInvoiceSchema.safeParse(value);
  if (remote.success) return invoiceFromRemote(remote.data);
  if (typeof value !== 'object' || value === null) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== 'string' ||
    typeof item.vendor !== 'string' ||
    typeof item.invoiceNumber !== 'string' ||
    typeof item.amount !== 'number' ||
    typeof item.currency !== 'string' ||
    !['due', 'scheduled', 'paid', 'dismissed'].includes(String(item.status)) ||
    !['gmail', 'manual', 'agent'].includes(String(item.source))
  ) {
    return null;
  }
  const destination = item.destination;
  const parsedDestination =
    typeof destination === 'object' && destination !== null
      ? (destination as Record<string, unknown>)
      : null;
  return {
    id: item.id,
    vendor: item.vendor,
    invoiceNumber: item.invoiceNumber,
    amount: item.amount,
    currency: item.currency,
    dueDate: typeof item.dueDate === 'string' ? item.dueDate : null,
    status: item.status as Invoice['status'],
    source: item.source as Invoice['source'],
    description: typeof item.description === 'string' ? item.description : undefined,
    destination:
      parsedDestination &&
      typeof parsedDestination.kind === 'string' &&
      typeof parsedDestination.label === 'string' &&
      typeof parsedDestination.value === 'string'
        ? {
            kind: parsedDestination.kind as NonNullable<Invoice['destination']>['kind'],
            label: parsedDestination.label,
            value: parsedDestination.value,
          }
        : undefined,
  };
}

export const ListInvoicesToolUI = makeAssistantToolUI<ListInvoicesArgs, ListInvoicesResult>({
  toolName: 'list_invoices',
  display: 'standalone',
  render: function ListInvoicesToolContent({ args, result, status }) {
    const { colors } = useTheme();
    const invoices = result?.invoices?.flatMap((value) => {
      const invoice = normalizeInvoice(value);
      return invoice ? [invoice] : [];
    });

    if (status.type === 'running' && !invoices) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.preparing]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[14px] text-muted-foreground'>
            Scanning {args?.source === 'gmail' ? 'Gmail' : 'invoices'}…
          </Text>
        </View>
      );
    }

    if (!invoices?.length) {
      return (
        <View
          className='my-2 border p-4 border-border bg-composer'
          style={[styles.empty]}
        >
          <Text className='font-sans-medium text-[15px] leading-[20px] text-muted-foreground'>
            No unpaid supplier invoices found. Connect Gmail in Integrations or add one manually.
          </Text>
        </View>
      );
    }

    return (
      <View className='gap-1 my-1'>
        <Text className='font-sans-semibold text-[13px] ml-1 mb-0.5 text-muted-foreground'>
          {invoices.length} supplier invoice{invoices.length === 1 ? '' : 's'}
        </Text>
        {invoices.map((invoice) => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
          />
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
};
