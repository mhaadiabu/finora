import { useHeaderHeight } from '@react-navigation/elements';
import * as Clipboard from 'expo-clipboard';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';

import { SupportedCurrency } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { AddWalletModal } from '@/components/wallets/AddWalletModal';
import { DepositModal } from '@/components/wallets/DepositModal';
import { FxConvertModal } from '@/components/wallets/FxConvertModal';
import { PayoutModal } from '@/components/wallets/PayoutModal';
import { WalletItem, INITIAL_WALLETS_DATA, FX_RATES } from '@/components/wallets/types';
import { WalletFilterTabs, FilterCategory } from '@/components/wallets/WalletFilterTabs';
import { WalletHeader } from '@/components/wallets/WalletHeader';
import { WalletListItem } from '@/components/wallets/WalletListItem';
import { Spacing, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getAccountType, getAccountLabel } from '@/lib/account';
import { haptics } from '@/lib/haptics';
import { listVirtualCards, subscribeVirtualCards } from '@/lib/virtual-cards-storage';

export default function WalletsScreen() {
  const { colors } = useTheme();
  const headerHeight = useHeaderHeight();
  const router = useRouter();
  const accountType = getAccountType();
  const accountLabel = getAccountLabel(accountType);

  const [wallets, setWallets] = useState<WalletItem[]>(INITIAL_WALLETS_DATA);
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [hideBalances, setHideBalances] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Selected wallet for details/deposit view
  const [selectedWallet, setSelectedWallet] = useState<WalletItem | null>(null);
  const [cardCount, setCardCount] = useState<number | null>(null);

  useEffect(() => {
    let disposed = false;
    let newestRequest = 0;

    const refreshCards = () => {
      const request = ++newestRequest;
      void listVirtualCards().then((cards) => {
        if (disposed || request !== newestRequest) return;
        setCardCount(cards.filter((card) => card.status !== 'cancelled').length);
      });
    };
    refreshCards();
    const unsubscribe = subscribeVirtualCards(refreshCards);
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  // Active modal handler
  const [activeModal, setActiveModal] = useState<
    'send' | 'deposit' | 'convert' | 'new_wallet' | null
  >(null);

  // Total USD equivalent balance calculation
  const totalNetWorthUSD = useMemo(() => {
    return wallets.reduce((acc, w) => acc + w.usdEquivalent, 0);
  }, [wallets]);

  // Filtered wallet list
  const filteredWallets = useMemo(() => {
    if (filter === 'all') return wallets;
    return wallets.filter((w) => w.type === filter);
  }, [wallets, filter]);
  const walletSections = useMemo(() => [{ data: filteredWallets }], [filteredWallets]);

  const showToast = (msg: string) => {
    haptics.selection();
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2400);
  };

  const handleCopy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    showToast(`${label} copied`);
  };

  const handleConvertSuccess = (
    fromCurrency: SupportedCurrency,
    toCurrency: SupportedCurrency,
    amountNum: number,
    convertedValue: number,
  ) => {
    const fromRateInUSD = FX_RATES[fromCurrency] || 1;
    const toRateInUSD = FX_RATES[toCurrency] || 1;

    setWallets((prev) =>
      prev.map((w) => {
        if (w.currency === fromCurrency) {
          return {
            ...w,
            balance: w.balance - amountNum,
            usdEquivalent: (w.balance - amountNum) * fromRateInUSD,
          };
        }
        if (w.currency === toCurrency) {
          return {
            ...w,
            balance: w.balance + convertedValue,
            usdEquivalent: (w.balance + convertedValue) * toRateInUSD,
          };
        }
        return w;
      }),
    );
  };

  const handleSendSuccess = (sendWalletId: string, amountNum: number) => {
    const sourceWallet = wallets.find((w) => w.id === sendWalletId);
    if (!sourceWallet) return;
    const rateInUSD = FX_RATES[sourceWallet.currency] || 1;

    setWallets((prev) =>
      prev.map((w) =>
        w.id === sendWalletId
          ? {
              ...w,
              balance: w.balance - amountNum,
              usdEquivalent: (w.balance - amountNum) * rateInUSD,
            }
          : w,
      ),
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sleek Floating Toast */}
      {toastMessage && (
        <View
          style={[styles.toast, { backgroundColor: colors.foreground, top: headerHeight + 12 }]}
        >
          <Icon
            name='check'
            size={13}
            color={colors.background}
          />
          <Text style={[styles.toastText, { color: colors.background }]}>{toastMessage}</Text>
        </View>
      )}

      <Animated.SectionList
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior='never'
        contentInset={Platform.OS === 'ios' ? { top: headerHeight } : undefined}
        contentOffset={Platform.OS === 'ios' ? { x: 0, y: -headerHeight } : undefined}
        scrollIndicatorInsets={Platform.OS === 'ios' ? { top: headerHeight } : undefined}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS !== 'ios' ? { paddingTop: headerHeight + 16 } : null,
        ]}
        sections={walletSections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <WalletHeader
              accountLabel={accountLabel}
              totalNetWorthUSD={totalNetWorthUSD}
              hideBalances={hideBalances}
              onToggleHideBalances={() => setHideBalances((prev) => !prev)}
              onOpenSend={() => setActiveModal('send')}
              onOpenDeposit={() => {
                setSelectedWallet(wallets[0]);
                setActiveModal('deposit');
              }}
              onOpenConvert={() => setActiveModal('convert')}
            />

            {cardCount === 0 ? (
              <Pressable
                onPress={() => {
                  haptics.selection();
                  router.push('/virtual-card' as Href);
                }}
                style={({ pressed }) => [
                  styles.cardEntry,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    opacity: pressed ? 0.78 : 1,
                  },
                ]}
              >
                <View style={[styles.cardEntryIcon, { backgroundColor: colors.foreground }]}>
                  <Icon
                    name='wallet'
                    size={17}
                    color={colors.background}
                  />
                </View>
                <View style={styles.cardEntryCopy}>
                  <Text style={[styles.cardEntryTitle, { color: colors.foreground }]}>
                    Virtual card
                  </Text>
                  <Text style={[styles.cardEntrySubtitle, { color: colors.mutedForeground }]}>
                    Create a card for online spending
                  </Text>
                </View>
                <Icon
                  name='chevron-right'
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            ) : null}
          </View>
        }
        renderSectionHeader={() => (
          <View style={[styles.stickyTabs, { backgroundColor: colors.background }]}>
            <WalletFilterTabs
              filter={filter}
              onSelectFilter={setFilter}
              onOpenAddWallet={() => setActiveModal('new_wallet')}
            />
          </View>
        )}
        renderItem={({ item, index }) => (
          <View style={styles.walletRow}>
            <WalletListItem
              wallet={item}
              hideBalances={hideBalances}
              isLast={index === filteredWallets.length - 1}
              onSelect={(w) => {
                setSelectedWallet(w);
                setActiveModal('deposit');
              }}
            />
          </View>
        )}
      />

      {/* Modals */}
      <DepositModal
        visible={activeModal === 'deposit'}
        selectedWallet={selectedWallet}
        onClose={() => setActiveModal(null)}
        onCopy={handleCopy}
      />

      <PayoutModal
        visible={activeModal === 'send'}
        wallets={wallets}
        onClose={() => setActiveModal(null)}
        onSendSuccess={handleSendSuccess}
      />

      <FxConvertModal
        visible={activeModal === 'convert'}
        wallets={wallets}
        onClose={() => setActiveModal(null)}
        onConvertSuccess={handleConvertSuccess}
      />

      <AddWalletModal
        visible={activeModal === 'new_wallet'}
        onClose={() => setActiveModal(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  toastText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: Spacing.threadMaxWidth,
    alignSelf: 'center',
    width: '100%',
  },
  listHeader: {
    gap: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  stickyTabs: {
    paddingHorizontal: 20,
    paddingVertical: 2,
  },
  walletRow: {
    paddingHorizontal: 20,
  },
  cardEntry: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardEntryIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEntryCopy: {
    flex: 1,
    gap: 2,
  },
  cardEntryTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
  },
  cardEntrySubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
  },
});
