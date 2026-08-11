import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect, useNavigation, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import type { ActivityFilter, Transaction } from '@/components/activity/types';

import { ActivityFilterTabs } from '@/components/activity/ActivityFilterTabs';
import { ActivityListItem } from '@/components/activity/ActivityListItem';
import { CollapsibleHeaderTitle } from '@/components/shell/account-badge';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { listTransactions } from '@/lib/transactions-storage';

export default function ActivityScreen() {
  const { colors } = useTheme();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await listTransactions();
    setTxs(next);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <CollapsibleHeaderTitle
          title='Activity'
          scrollY={scrollY}
          topInset={headerHeight}
        />
      ),
    });
  }, [headerHeight, navigation, scrollY]);

  const filtered = useMemo(() => {
    if (filter === 'all') return txs;
    return txs.filter((t) => t.direction === filter);
  }, [filter, txs]);
  const sections = useMemo(() => [{ data: filtered }], [filtered]);

  const handleTransactionPress = useCallback(
    (tx: Transaction) => {
      router.push(`/transaction/${tx.id}` as Href);
    },
    [router],
  );
  const renderTransaction = useCallback(
    ({ item, index }: { item: Transaction; index: number }) => (
      <View style={styles.row}>
        <ActivityListItem
          tx={item}
          isLast={index === filtered.length - 1}
          onPress={handleTransactionPress}
        />
      </View>
    ),
    [filtered.length, handleTransactionPress],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.SectionList
        showsVerticalScrollIndicator={false}
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          Platform.OS !== 'ios' ? { paddingTop: headerHeight } : null,
        ]}
        contentInsetAdjustmentBehavior='never'
        contentInset={Platform.OS === 'ios' ? { top: headerHeight } : undefined}
        contentOffset={Platform.OS === 'ios' ? { x: 0, y: -headerHeight } : undefined}
        scrollIndicatorInsets={Platform.OS === 'ios' ? { top: headerHeight } : undefined}
        stickySectionHeadersEnabled
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={9}
        onRefresh={refresh}
        refreshing={loading}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={[styles.title, { color: colors.foreground }]}>Activity</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Every send, receive, and conversion — tap a row for status, WeWire id, and rail.
            </Text>
          </View>
        }
        renderSectionHeader={() => (
          <View style={[styles.stickyTabs, { backgroundColor: colors.background }]}>
            <ActivityFilterTabs
              filter={filter}
              onSelectFilter={setFilter}
            />
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            No transactions yet.
          </Text>
        }
        renderItem={renderTransaction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  intro: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 25,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 6,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    paddingBottom: 14,
  },
  stickyTabs: {
    paddingHorizontal: 20,
    paddingTop: 2,
  },
  list: {
    paddingBottom: 32,
  },
  row: {
    paddingHorizontal: 20,
  },
  empty: {
    marginTop: 32,
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
});
