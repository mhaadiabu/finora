import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { PaymentConfirmation } from '@/components/chat/PaymentConfirmationCard';
import type { PaymentConfirmationStatus } from '@/components/chat/PaymentConfirmationCard';
import type { Contact } from '@/components/contacts/types';

import { SendMoneyWizard, type SendMoneySeed } from '@/components/chat/SendMoneyWizard';
import { WizardStepHeader } from '@/components/chat/WizardChrome';
import { AVATAR_COLORS } from '@/components/contacts/types';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp, paymentSentFollowUp } from '@/lib/agent-follow-up';
import { contactToSendSeed, findContactsByName } from '@/lib/contact-lookup';
import { findContactByIdentifier, listContacts, saveContact } from '@/lib/contacts-storage';
import { haptics } from '@/lib/haptics';
import { recordSentPayment } from '@/lib/transactions-storage';

export type ResolveSendCandidate = {
  id: string;
  name: string;
  initials: string;
  currency: string;
  method: string;
  identifier: string;
};

type ResolveSendArgs = {
  queryName?: string;
  amount?: number;
  currency?: string;
  candidates?: ResolveSendCandidate[];
  reference?: string;
  destinationCountry?: string;
  settlementMethod?: SendMoneySeed['settlementMethod'];
  purposeCode?: SendMoneySeed['purposeCode'];
  fundingCurrency?: string;
};

type ResolveSendResult = {
  status?: 'sent' | 'cancelled';
  transactionId?: string;
  contactId?: string;
};

function mockTransactionId() {
  const n = Math.floor(Math.random() * 1e8)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase();
  return `WW-${n}`;
}

function toContact(c: ResolveSendCandidate): Contact {
  return {
    id: c.id,
    name: c.name,
    initials: c.initials,
    currency: c.currency as Contact['currency'],
    method: c.method,
    identifier: c.identifier,
    favourite: false,
    lastTxDate: null,
  };
}

function toCandidate(c: Contact): ResolveSendCandidate {
  return {
    id: c.id,
    name: c.name,
    initials: c.initials,
    currency: c.currency,
    method: c.method,
    identifier: c.identifier,
  };
}

function ResolveSendFlow({
  seed,
  onFinished,
  onCancelled,
}: {
  seed: ResolveSendArgs;
  onFinished: (payload: { transactionId: string; contactId: string }) => void;
  onCancelled: () => void;
}) {
  const { colors } = useTheme();
  const aui = useAui();
  const router = useRouter();
  const { requestApproval, modal } = usePasscodeApproval();

  const [candidates, setCandidates] = useState<ResolveSendCandidate[]>(seed.candidates ?? []);
  const [loadingContacts, setLoadingContacts] = useState(
    !(seed.candidates && seed.candidates.length > 0),
  );
  const [contact, setContact] = useState<ResolveSendCandidate | null>(
    seed.candidates?.length === 1 ? seed.candidates[0]! : null,
  );
  const [localStatus, setLocalStatus] = useState<PaymentConfirmationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendingStep, setSendingStep] = useState(0);
  const [transactionId, setTransactionId] = useState<string | undefined>();
  const [txRecordId, setTxRecordId] = useState<string | null>(null);
  const [contactSaved, setContactSaved] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [confirmedPayment, setConfirmedPayment] = useState<PaymentConfirmation | null>(null);
  const finishedRef = useRef(false);
  const followedUpRef = useRef(false);

  useEffect(() => {
    if (seed.candidates && seed.candidates.length > 0) {
      setLoadingContacts(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const matches = seed.queryName
        ? await findContactsByName(seed.queryName)
        : await listContacts();
      if (cancelled) return;
      const next = matches.map(toCandidate);
      setCandidates(next);
      if (next.length === 1) setContact(next[0]!);
      setLoadingContacts(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [seed.candidates, seed.queryName]);

  const wizardSeed: SendMoneySeed | null = useMemo(() => {
    if (!contact) return null;
    const fromContact = contactToSendSeed(toContact(contact));
    return {
      ...fromContact,
      amount: seed.amount,
      currency: seed.currency ?? contact.currency,
      fundingCurrency: seed.fundingCurrency ?? seed.currency ?? contact.currency,
      reference: seed.reference ?? `To ${contact.name}`,
      destinationCountry: seed.destinationCountry ?? fromContact.destinationCountry,
      settlementMethod: seed.settlementMethod ?? fromContact.settlementMethod,
      purposeCode: seed.purposeCode,
    };
  }, [contact, seed]);

  const status = localStatus ?? 'pending';
  const payment = confirmedPayment;

  useEffect(() => {
    const value = payment?.destination.value ?? contact?.identifier;
    if (!value) return;
    void findContactByIdentifier(value).then((existing) => {
      if (existing) setContactSaved(true);
    });
  }, [contact?.identifier, payment?.destination.value]);

  useEffect(() => {
    if (status !== 'sending' || !payment || !contact) return;
    let cancelled = false;
    const run = async () => {
      for (let step = 0; step < 3; step++) {
        if (cancelled) return;
        setSendingStep(step);
        await new Promise((r) => setTimeout(r, step === 0 ? 650 : 750));
      }
      if (cancelled || finishedRef.current) return;
      const txId = mockTransactionId();
      finishedRef.current = true;
      setTransactionId(txId);
      setLocalStatus('sent');
      haptics.success();
      onFinished({ transactionId: txId, contactId: contact.id });
      const recorded = await recordSentPayment({
        payment,
        transactionId: txId,
        source: 'chat',
      });
      if (!cancelled) setTxRecordId(recorded.id);
      if (!followedUpRef.current) {
        followedUpRef.current = true;
        appendAgentFollowUp(aui, paymentSentFollowUp(payment, txId));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [aui, contact, onFinished, payment, status]);

  if (loadingContacts) {
    return (
      <View
        className='my-2 min-h-[72px] border items-center justify-center border-border bg-composer'
        style={[styles.preparing]}
      >
        <LoadingIcon color={colors.mutedForeground} />
      </View>
    );
  }

  if (!contact) {
    return (
      <View
        className='w-[100%] border p-4 gap-3.5 my-2 bg-composer border-border'
        style={[styles.card]}
      >
        <WizardStepHeader
          step={1}
          total={2}
          title={
            seed.queryName ? `Who did you mean by “${seed.queryName}”?` : 'Who should receive it?'
          }
          subtitle={
            seed.queryName
              ? `${candidates.length} contacts match — pick one to continue.`
              : seed.currency
                ? `Sending from your ${seed.currency} wallet — pick a contact.`
                : `${candidates.length} contacts — pick one to continue.`
          }
        />
        <View className='gap-2'>
          {candidates.map((c, index) => (
            <Pressable
              key={c.id}
              onPress={() => {
                haptics.selection();
                setContact(c);
              }}
              className='flex-row items-center gap-3 p-3 border'
              style={({ pressed }) => [
                {
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                className='w-10 h-10 rounded-[20px] items-center justify-center'
                style={[{ backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}
              >
                <Text className='font-sans-semibold text-white text-[14px]'>{c.initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text className='font-sans-semibold text-[16px] text-foreground'>{c.name}</Text>
                <Text className='text-[13px] text-muted-foreground'>
                  {c.method} · {c.identifier}
                </Text>
              </View>
              <Text className='text-[13px] text-muted-foreground'>{c.currency}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => {
            haptics.selection();
            onCancelled();
          }}
        >
          <Text className='text-center font-semibold text-muted-foreground'>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (!wizardSeed) return null;

  return (
    <>
      {candidates.length > 1 && status === 'pending' ? (
        <Pressable
          onPress={() => {
            haptics.selection();
            setContact(null);
            setConfirmedPayment(null);
            setLocalStatus(null);
          }}
          className='ml-2 mb-0.5'
        >
          <Text className='font-semibold text-muted-foreground'>← Change contact</Text>
        </Pressable>
      ) : null}
      <SendMoneyWizard
        seed={wizardSeed}
        status={status}
        loading={busy}
        sendingStep={sendingStep}
        transactionId={transactionId}
        contactSaved={contactSaved}
        contactSaving={contactSaving}
        onViewDetails={
          status === 'sent' && (txRecordId || transactionId)
            ? () => router.push(`/transaction/${txRecordId ?? transactionId}` as Href)
            : undefined
        }
        onSaveContact={async () => {
          if (!payment || contactSaved || contactSaving) return;
          setContactSaving(true);
          try {
            await saveContact({
              name: payment.recipientName,
              currency: payment.currency as never,
              method: payment.settlementMethodLabel ?? payment.destination.label,
              identifier: payment.destination.value,
            });
            setContactSaved(true);
            haptics.success();
          } finally {
            setContactSaving(false);
          }
        }}
        onConfirm={async (next) => {
          if (status !== 'pending' || busy) return;
          setConfirmedPayment(next);
          setBusy(true);
          const ok = await requestApproval();
          setBusy(false);
          if (!ok) return;
          setSendingStep(0);
          finishedRef.current = false;
          setLocalStatus('sending');
        }}
        onCancel={onCancelled}
      />
      {modal}
    </>
  );
}

export const ResolveSendToolUI = makeAssistantToolUI<ResolveSendArgs, ResolveSendResult>({
  toolName: 'resolve_send',
  display: 'standalone',
  render: function ResolveSendToolContent({ args, status, addResult }) {
    const { colors } = useTheme();
    const hasCandidates = (args?.candidates?.length ?? 0) > 0;

    if (status.type === 'running' && !hasCandidates) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center border-border bg-composer'
          style={[styles.preparing]}
        >
          <LoadingIcon color={colors.mutedForeground} />
        </View>
      );
    }

    return (
      <ResolveSendFlow
        seed={args ?? {}}
        onFinished={({ transactionId, contactId }) => {
          addResult({ status: 'sent', transactionId, contactId });
        }}
        onCancelled={() => {
          addResult({ status: 'cancelled' });
        }}
      />
    );
  },
});

const styles = {
  card: {
    borderRadius: Radius.card,
  },
  preparing: {
    borderRadius: Radius.card,
  },
  contactRow: {
    borderRadius: Radius.composer,
  },
};
