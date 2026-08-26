import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { Supplier } from '@/lib/suppliers-storage';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { haptics } from '@/lib/haptics';
import { recordSentPayment } from '@/lib/transactions-storage';

type PrepareSupplierPaymentArgs = {
  supplierId?: string;
  supplierName?: string;
  amount?: { amount: number; currency: string } | number;
  currency?: string;
  reference?: string;
};

type PrepareSupplierPaymentResult = {
  supplier?: Supplier;
  amount?: number;
  currency?: string;
  reference?: string;
  preparationId?: string;
};

function mockTransactionId() {
  return `WW-SUP-${Math.floor(Math.random() * 1e8)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase()}`;
}

function SupplierPaymentCard({
  supplier,
  amount,
  currency,
  reference,
}: {
  supplier: Supplier;
  amount: number;
  currency: string;
  reference?: string;
}) {
  const { colors } = useTheme();
  const aui = useAui();
  const { requestApproval, modal } = usePasscodeApproval();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent'>('idle');
  const finishedRef = useRef(false);

  useEffect(() => {
    if (phase !== 'sending' || finishedRef.current) return;
    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 900));
      if (cancelled || finishedRef.current) return;
      finishedRef.current = true;
      const txId = mockTransactionId();
      await recordSentPayment({
        payment: {
          amount,
          currency,
          recipientName: supplier.name,
          destination: {
            kind: supplier.destination.kind,
            label: supplier.destination.label,
            value: supplier.destination.value,
          },
          reference: reference ?? `Supplier · ${supplier.name}`,
          purposeCode: 'INVOICE',
          purposeLabel: 'Invoice / supplier',
        },
        transactionId: txId,
        source: 'chat',
      });
      setPhase('sent');
      haptics.success();
      appendAgentFollowUp(
        aui,
        `Paid ${supplier.name} ${formatPaymentAmount(amount, currency)}. Ref ${txId}.`,
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [amount, aui, currency, phase, reference, supplier]);

  return (
    <>
      <View
        className='w-[100%] border p-4 gap-3.5 my-1.5 bg-composer border-border'
        style={[styles.card]}
      >
        <View className='flex-row items-center gap-3'>
          <View className='w-9 h-9 rounded-[18px] items-center justify-center bg-muted'>
            {phase === 'sending' ? (
              <LoadingIcon
                size='small'
                color={colors.foreground}
              />
            ) : (
              <Icon
                name={phase === 'sent' ? 'check' : 'bank'}
                size={16}
                color={colors.foreground}
              />
            )}
          </View>
          <View className='flex-1 gap-0.5 min-w-0'>
            <Text className='font-sans-semibold text-[12px] text-muted-foreground'>
              {phase === 'sent'
                ? 'Supplier paid'
                : phase === 'sending'
                  ? 'Paying supplier…'
                  : 'Supplier payment ready'}
            </Text>
            <Text className='font-sans-semibold text-[16px] text-foreground'>{supplier.name}</Text>
          </View>
          <Text className='font-sans-semibold text-[16px] text-foreground'>
            {formatPaymentAmount(amount, currency)}
          </Text>
        </View>

        <View className='gap-1'>
          <Text className='font-sans-medium text-[13px] text-muted-foreground'>
            {supplier.destination.label} · {supplier.destination.value}
          </Text>
          {reference ? (
            <Text className='font-sans-medium text-[13px] text-muted-foreground'>
              Ref {reference}
            </Text>
          ) : null}
        </View>

        {phase === 'idle' ? (
          <Pressable
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              const ok = await requestApproval();
              setBusy(false);
              if (!ok) return;
              setPhase('sending');
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
              Approve payment
            </Text>
          </Pressable>
        ) : null}
      </View>
      {modal}
    </>
  );
}

export const PrepareSupplierPaymentToolUI = makeAssistantToolUI<
  PrepareSupplierPaymentArgs,
  PrepareSupplierPaymentResult
>({
  toolName: 'prepare_supplier_payment',
  display: 'standalone',
  render: function PrepareSupplierPaymentToolContent({ result, status }) {
    const { colors } = useTheme();
    const supplier = result?.supplier;
    const amount = result?.amount;
    const currency = result?.currency;

    if (status.type === 'running' && !supplier) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.preparing]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[14px] text-muted-foreground'>
            Preparing supplier payment…
          </Text>
        </View>
      );
    }

    if (!supplier || amount == null || !currency) {
      return (
        <View
          className='my-2 border p-4 border-border bg-composer'
          style={[styles.empty]}
        >
          <Text className='font-sans-medium text-[15px] leading-[20px] text-muted-foreground'>
            Couldn’t prepare that supplier payment. Try “Pay TechFlow 780 GBP”.
          </Text>
        </View>
      );
    }

    return (
      <SupplierPaymentCard
        supplier={supplier}
        amount={amount}
        currency={currency}
        reference={result?.reference}
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
