import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  PaymentConfirmationCard,
  type PaymentConfirmation,
  type PaymentConfirmationStatus,
} from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { rememberFinoraTagRecipient } from '@/lib/finora-tags';
import { haptics } from '@/lib/haptics';
import { recordSentPayment } from '@/lib/transactions-storage';

type InternalTransferArgs = {
  fromSubCustomerId: string;
  toSubCustomerId: string;
  amount: {
    value: number;
    currency: string;
  };
  recipientName: string;
  finoraTag: string;
  reference?: string;
};

type InternalTransferResult = {
  status?: PaymentConfirmationStatus;
  preparationId?: string;
  transactionId?: string;
};

function mockTransactionId() {
  return `WW-INTERNAL-${Math.floor(Math.random() * 1e8)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase()}`;
}

function InternalTransferFlow({
  args,
  result,
  onResult,
}: {
  args: InternalTransferArgs;
  result?: InternalTransferResult;
  onResult: (result: InternalTransferResult) => void;
}) {
  const aui = useAui();
  const { requestApproval, modal } = usePasscodeApproval();
  const [status, setStatus] = useState<PaymentConfirmationStatus>(result?.status ?? 'pending');
  const [busy, setBusy] = useState(false);
  const [sendingStep, setSendingStep] = useState(0);
  const [transactionId, setTransactionId] = useState(result?.transactionId);
  const finishedRef = useRef(false);

  const payment = useMemo<PaymentConfirmation>(
    () => ({
      amount: args.amount.value,
      currency: args.amount.currency,
      recipientName: args.recipientName,
      destination: {
        kind: 'internal_wallet',
        label: 'Finora wallet',
        value: `@${args.finoraTag} · ${args.amount.currency}`,
      },
      settlementMethod: 'INTERNAL',
      settlementMethodLabel: 'Internal transfer',
      reference: args.reference,
      deliveryHint: `Credits ${args.recipientName}'s ${args.amount.currency} Finora wallet`,
    }),
    [args],
  );

  useEffect(() => {
    if (status !== 'sending' || finishedRef.current) return;
    let cancelled = false;
    const complete = async () => {
      for (let step = 0; step < 3; step += 1) {
        if (cancelled) return;
        setSendingStep(step);
        await new Promise((resolve) => setTimeout(resolve, step === 0 ? 500 : 650));
      }
      if (cancelled || finishedRef.current) return;
      finishedRef.current = true;
      const nextTransactionId = result?.transactionId ?? mockTransactionId();
      setTransactionId(nextTransactionId);
      setStatus('sent');
      haptics.success();
      onResult({
        status: 'sent',
        preparationId: result?.preparationId ?? `prep_internal_${Date.now()}`,
        transactionId: nextTransactionId,
      });
      await recordSentPayment({
        payment,
        transactionId: nextTransactionId,
        source: 'chat',
      });
      await rememberFinoraTagRecipient({
        tag: args.finoraTag,
        displayName: args.recipientName,
        subCustomerId: args.toSubCustomerId,
        walletCurrencies: [args.amount.currency],
      });
      if (!cancelled) {
        appendAgentFollowUp(
          aui,
          `Sent ${payment.currency} ${payment.amount.toLocaleString()} to ${payment.recipientName} (@${args.finoraTag}) through their Finora wallet.`,
        );
      }
    };
    void complete();
    return () => {
      cancelled = true;
    };
  }, [
    args.amount.currency,
    args.finoraTag,
    args.recipientName,
    args.toSubCustomerId,
    aui,
    onResult,
    payment,
    result,
    status,
  ]);

  return (
    <>
      <PaymentConfirmationCard
        payment={payment}
        status={status}
        loading={busy}
        sendingStep={sendingStep}
        transactionId={transactionId}
        onConfirm={async () => {
          if (status !== 'pending' || busy) return;
          setBusy(true);
          const approved = await requestApproval();
          setBusy(false);
          if (!approved) return;
          setStatus('sending');
        }}
        onCancel={() => {
          if (status !== 'pending' || busy) return;
          setStatus('cancelled');
          onResult({ status: 'cancelled' });
        }}
      />
      {modal}
    </>
  );
}

export const PrepareInternalTransferToolUI = makeAssistantToolUI<
  InternalTransferArgs,
  InternalTransferResult
>({
  toolName: 'prepare_internal_transfer',
  display: 'standalone',
  render: ({ args, result, addResult }) => {
    if (!args?.amount || !args.recipientName || !args.finoraTag) return null;
    return (
      <InternalTransferFlow
        args={args}
        result={result}
        onResult={addResult}
      />
    );
  },
});
