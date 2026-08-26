import { useAui } from '@assistant-ui/react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import {
  dismissCalendarEvent,
  markCalendarEventPaid,
  type CalendarMoneyEvent,
} from '@/lib/calendar-events-storage';
import { haptics } from '@/lib/haptics';
import { recordSentPayment } from '@/lib/transactions-storage';

function mockTransactionId() {
  return `WW-CAL-${Math.floor(Math.random() * 1e8)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase()}`;
}

function formatDue(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function kindLabel(kind: CalendarMoneyEvent['kind']) {
  if (kind === 'rent') return 'Rent';
  if (kind === 'payroll') return 'Payroll';
  if (kind === 'bill') return 'Bill';
  if (kind === 'subscription') return 'Subscription';
  return 'Calendar event';
}

export function CalendarEventCard({ event: initial }: { event: CalendarMoneyEvent }) {
  const { colors } = useTheme();
  const aui = useAui();
  const { requestApproval, modal } = usePasscodeApproval();
  const [event, setEvent] = useState(initial);
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
        const updated = await markCalendarEventPaid(event.id, txId);
        if (updated) setEvent(updated);
        setPhase('paid');
        haptics.success();
        if (event.amount && event.currency && event.counterparty) {
          await recordSentPayment({
            payment: {
              amount: event.amount,
              currency: event.currency,
              recipientName: event.counterparty,
              destination: {
                kind: 'bank_account',
                label: 'Calendar payment',
                value: event.title,
              },
              reference: event.title,
            },
            transactionId: txId,
            source: 'chat',
          });
        }
        appendAgentFollowUp(
          aui,
          `Paid ${event.title}${
            event.amount && event.currency
              ? ` (${formatPaymentAmount(event.amount, event.currency)})`
              : ''
          }. Ref ${txId}.`,
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
  }, [aui, event, phase]);

  const idle = phase === 'idle';
  const canPay = idle && event.amount != null && event.currency && event.counterparty;

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
                name={phase === 'paid' ? 'check' : 'activity'}
                size={16}
                color={colors.foreground}
              />
            )}
          </View>
          <View className='flex-1 gap-0.5 min-w-0'>
            <Text className='font-sans-semibold text-[12px] text-muted-foreground'>
              {phase === 'paid'
                ? 'Paid from calendar'
                : phase === 'sending'
                  ? 'Paying…'
                  : phase === 'dismissed'
                    ? 'Dismissed'
                    : kindLabel(event.kind)}
            </Text>
            <Text className='font-sans-semibold text-[16px] text-foreground'>{event.title}</Text>
          </View>
          {event.amount != null && event.currency ? (
            <Text className='font-sans-semibold text-[16px] text-foreground'>
              {formatPaymentAmount(event.amount, event.currency)}
            </Text>
          ) : null}
        </View>

        <View className='gap-1'>
          <Text className='font-sans-medium text-[13px] text-muted-foreground'>
            Starts {formatDue(event.dueAt)}
          </Text>
          {event.counterparty ? (
            <Text className='font-sans-medium text-[13px] text-muted-foreground'>
              {event.counterparty}
            </Text>
          ) : null}
          {event.notes ? (
            <Text className='font-sans text-[13px] leading-[18px] text-muted-foreground'>
              {event.notes}
            </Text>
          ) : null}
        </View>

        {idle ? (
          <View className='flex-row gap-2.5'>
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
                className='flex-1 min-h-11 items-center justify-center'
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
                setBusy(true);
                const updated = await dismissCalendarEvent(event.id);
                if (updated) setEvent(updated);
                setPhase('dismissed');
                setBusy(false);
              }}
              className='flex-1 min-h-11 items-center justify-center border'
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
    borderRadius: Radius.composer,
  },
};
