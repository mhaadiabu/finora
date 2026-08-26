import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type FinancialReport = {
  title: string;
  period: string;
  inflow: number;
  outflow: number;
  net: number;
  currency: string;
  highlights: string[];
};

type Result = { report?: FinancialReport };

export const FinancialReportToolUI = makeAssistantToolUI<{ period?: string }, Result>({
  toolName: 'generate_financial_insights',
  display: 'standalone',
  render: function FinancialReportToolContent({ result, status }) {
    const { colors } = useTheme();
    const report = result?.report;

    if (status.type === 'running' && !report) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
            Generating financial report…
          </Text>
        </View>
      );
    }

    if (!report) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.box]}
        >
          <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
            No report available.
          </Text>
        </View>
      );
    }

    return (
      <View
        className='my-1.5 border p-4 gap-2 border-border bg-composer'
        style={[styles.card]}
      >
        <Text className='font-sans-semibold text-[12px] text-muted-foreground'>{report.title}</Text>
        <Text className='font-sans-medium text-[14px] text-muted-foreground'>{report.period}</Text>
        <View className='flex-row gap-3 my-1.5'>
          <Metric
            label='In'
            value={formatPaymentAmount(report.inflow, report.currency)}
            colors={colors}
          />
          <Metric
            label='Out'
            value={formatPaymentAmount(report.outflow, report.currency)}
            colors={colors}
          />
          <Metric
            label='Net'
            value={formatPaymentAmount(report.net, report.currency)}
            colors={colors}
          />
        </View>
        {report.highlights.map((h) => (
          <Text
            key={h}
            className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'
          >
            · {h}
          </Text>
        ))}
      </View>
    );
  },
});

function Metric({
  label,
  value,
  colors: _colors,
}: {
  label: string;
  value: string;
  colors: { foreground: string; mutedForeground: string };
}) {
  return (
    <View className='flex-1 gap-0.5'>
      <Text className='font-sans-semibold text-[12px] text-muted-foreground'>{label}</Text>
      <Text className='font-sans-semibold text-[15px] text-foreground'>{value}</Text>
    </View>
  );
}

const styles = {
  box: {
    borderRadius: Radius.card,
  },
  card: {
    borderRadius: Radius.card,
  },
};
