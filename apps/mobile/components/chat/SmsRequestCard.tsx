import { useAui } from '@assistant-ui/react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { haptics } from '@/lib/haptics';
import { sendSms } from '@/lib/sms';
import {
  dismissSmsRequest,
  markSmsRequestPaid,
  type SmsPaymentRequest,
} from '@/lib/sms-requests-storage';
import { recordSentPayment } from '@/lib/transactions-storage';

function mockTransactionId() {
  return `WW-SMS-${Math.floor(Math.random() * 1e8)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase()}`;
}

function formatReceived(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function SmsRequestCard({ request: initial }: { request: SmsPaymentRequest }) {
  const { colors } = useTheme();
  const aui = useAui();
  const { requestApproval, modal } = usePasscodeApproval();
  const [request, setRequest] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'paid' | 'dismissed'>(
    initial.status === 'paid' ? 'paid' : initial.status === 'dismissed' ? 'dismissed' : 'idle',
  );
  const finishedRef = useRef(false);

  useEffect(() => {
    if (phase !== 'sending' || finishedRef.current) return;
    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 900));
      if (cancelled || finishedRef.current) return;
      finishedRef.current = true;
      const txId = mockTransactionId();
      try {
        const updated = await markSmsRequestPaid(request.id, txId);
        if (updated) setRequest(updated);
        setPhase('paid');
        haptics.success();
        if (request.amount && request.currency) {
          await recordSentPayment({
            payment: {
              amount: request.amount,
              currency: request.currency,
              recipientName: request.fromName,
              destination: {
                kind: request.network?.toLowerCase().includes('momo')
                  ? 'mobile_money'
                  : 'bank_account',
                label: request.network ?? 'SMS request',
                value: request.fromPhone,
              },
              reference: `SMS from ${request.fromName}`,
            },
            transactionId: txId,
            source: 'chat',
          });
        }
        appendAgentFollowUp(
          aui,
          `Paid ${request.fromName}${
            request.amount && request.currency
              ? ` ${formatPaymentAmount(request.amount, request.currency)}`
              : ''
          } from an SMS request. Ref ${txId}.`,
        );
      } catch {
        finishedRef.current = false;
        setPhase('idle');
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [aui, phase, request]);

  const idle = phase === 'idle';
  const canPay = idle && request.amount != null && request.currency;

  return (
    <>
      <View
        className='w-[100%] border p-4 gap-3 my-1.5 bg-composer border-border'
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
                name={phase === 'paid' ? 'check' : 'phone'}
                size={16}
                color={colors.foreground}
              />
            )}
          </View>
          <View className='flex-1 gap-0.5 min-w-0'>
            <Text className='font-sans-semibold text-[12px] text-muted-foreground'>
              {phase === 'paid'
                ? 'Paid from SMS'
                : phase === 'sending'
                  ? 'Paying…'
                  : phase === 'dismissed'
                    ? 'Dismissed'
                    : 'SMS payment request'}
            </Text>
            <Text className='font-sans-semibold text-[16px] text-foreground'>
              {request.fromName}
            </Text>
          </View>
          {request.amount != null && request.currency ? (
            <Text className='font-sans-semibold text-[16px] text-foreground'>
              {formatPaymentAmount(request.amount, request.currency)}
            </Text>
          ) : null}
        </View>

        <Text className='font-sans-medium text-[14px] leading-[20px] text-foreground'>
          {request.body}
        </Text>

        <View className='gap-0.5'>
          <Text className='font-sans-medium text-[13px] text-muted-foreground'>
            {request.fromPhone}
            {request.network ? ` · ${request.network}` : ''}
          </Text>
          <Text className='font-sans-medium text-[13px] text-muted-foreground'>
            Received {formatReceived(request.receivedAt)}
          </Text>
        </View>

        {idle ? (
          <View className='flex-row flex-wrap gap-2.5'>
            {canPay ? (
              <Pressable
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  const ok = await requestApproval();
                  setBusy(false);
                  if (!ok) return;
                  setPhase('sending');
                }}
                className='grow min-h-11 items-center justify-center'
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
                  Pay now
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              disabled={busy}
              onPress={async () => {
                haptics.selection();
                const reply = request.network?.toLowerCase().includes('momo')
                  ? 'PAY'
                  : `Re: ${request.body.slice(0, 80)}`;
                const result = await sendSms({
                  addresses: request.fromPhone,
                  message: reply,
                });
                if (!result.ok) {
                  haptics.impact();
                  Alert.alert('SMS unavailable', result.error);
                } else if (result.result === 'sent') {
                  haptics.success();
                }
              }}
              className='grow min-h-11 items-center justify-center border'
              style={({ pressed }) => [
                { borderColor: colors.border, opacity: pressed || busy ? 0.7 : 1 },
              ]}
            >
              <Text className='font-sans-semibold text-[15px] text-foreground'>Reply SMS</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={async () => {
                haptics.selection();
                setBusy(true);
                const updated = await dismissSmsRequest(request.id);
                if (updated) setRequest(updated);
                setPhase('dismissed');
                setBusy(false);
              }}
              className='grow min-h-11 items-center justify-center border'
              style={({ pressed }) => [
                { borderColor: colors.border, opacity: pressed || busy ? 0.7 : 1 },
              ]}
            >
              <Text className='font-sans-semibold text-[15px] text-foreground'>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {modal}
    </>
  );
}

const styles = {
  card: {
    borderRadius: Radius.card,
  },
  btn: {
    flexBasis: '30%',
    borderRadius: Radius.composer,
  },
};
