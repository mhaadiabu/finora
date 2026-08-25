import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import type { CalendarMoneyEvent } from '@/lib/calendar-events-storage';

import { CalendarEventCard } from '@/components/chat/CalendarEventCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListCalendarDuesArgs = {
  range?: 'week' | 'month' | 'six_months';
  query?: string;
};

type ListCalendarDuesResult = {
  connected?: boolean;
  events?: CalendarMoneyEvent[];
};

export const ListCalendarDuesToolUI = makeAssistantToolUI<
  ListCalendarDuesArgs,
  ListCalendarDuesResult
>({
  toolName: 'list_calendar_dues',
  display: 'standalone',
  render: function ListCalendarDuesToolContent({ result, status }) {
    const { colors } = useTheme();
    const events = result?.events;
    const connected = result?.connected;

    if (status.type === 'running' && !events) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.preparing]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[14px] text-muted-foreground'>
            Checking Google Calendar…
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
            Google Calendar isn’t connected. Open Integrations to connect it, then ask again.
          </Text>
        </View>
      );
    }

    if (!events?.length) {
      return (
        <View
          className='my-2 border p-4 border-border bg-composer'
          style={[styles.empty]}
        >
          <Text className='font-sans-medium text-[15px] leading-[20px] text-muted-foreground'>
            No matching upcoming events were found on your calendars.
          </Text>
        </View>
      );
    }

    return (
      <View className='gap-0.5 my-1'>
        <Text className='font-sans-semibold text-[13px] ml-1 mb-0.5 text-muted-foreground'>
          {events.length} calendar event{events.length === 1 ? '' : 's'}
        </Text>
        {events.map((event) => (
          <CalendarEventCard
            key={event.id}
            event={event}
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
