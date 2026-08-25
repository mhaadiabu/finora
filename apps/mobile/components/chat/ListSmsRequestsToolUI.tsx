import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import type { SmsPaymentRequest } from '@/lib/sms-requests-storage';

import { SmsRequestCard } from '@/components/chat/SmsRequestCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListSmsRequestsArgs = {
  status?: 'new' | 'all';
};

type ListSmsRequestsResult = {
  connected?: boolean;
  requests?: SmsPaymentRequest[];
};

export const ListSmsRequestsToolUI = makeAssistantToolUI<
  ListSmsRequestsArgs,
  ListSmsRequestsResult
>({
  toolName: 'list_sms_requests',
  display: 'standalone',
  render: function ListSmsRequestsToolContent({ result, status }) {
    const { colors } = useTheme();
    const requests = result?.requests;
    const connected = result?.connected;

    if (status.type === 'running' && !requests) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.preparing]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[14px] text-muted-foreground'>
            Scanning SMS inbox…
          </Text>
        </View>
      );
    }

    if (connected === false) {
      return (
        <View
          className='my-2 border p-4 border-border bg-composer'
          style={[styles.empty]}
        >
          <Text className='font-sans-medium text-[15px] leading-[20px] text-muted-foreground'>
            SMS inbox isn’t connected. Open Integrations to connect SMS, then ask again.
          </Text>
        </View>
      );
    }

    if (!requests?.length) {
      return (
        <View
          className='my-2 border p-4 border-border bg-composer'
          style={[styles.empty]}
        >
          <Text className='font-sans-medium text-[15px] leading-[20px] text-muted-foreground'>
            No open payment requests in SMS right now.
          </Text>
        </View>
      );
    }

    return (
      <View className='gap-0.5 my-1'>
        <Text className='font-sans-semibold text-[13px] ml-1 mb-0.5 text-muted-foreground'>
          {requests.length} SMS payment request{requests.length === 1 ? '' : 's'}
        </Text>
        {requests.map((request) => (
          <SmsRequestCard
            key={request.id}
            request={request}
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
