import React from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useGetBitlaunchSummary } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ErrorState, StatCard } from '@/components/ui';

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: summary, isLoading, isError, refetch, isFetching } = useGetBitlaunchSummary();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.card, colors.background]}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>BITLAUNCH</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Command Deck</Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: isLoading || isFetching ? colors.primary : '#22c55e' }]} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {isError ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <>
            {/* Account card */}
            <View
              style={[
                styles.accountCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <LinearGradient
                colors={[colors.primary + '18', 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.accountCardInner}>
                <View style={[styles.accountIcon, { backgroundColor: colors.primary + '22' }]}>
                  <Feather name="user" size={22} color={colors.primary} />
                </View>
                <View style={{ gap: 4 }}>
                  <Text style={[styles.accountEmail, { color: colors.mutedForeground }]}>
                    {isLoading ? '...' : (summary?.account?.email ?? 'account')}
                  </Text>
                  <View style={styles.balanceRow}>
                    <Text style={[styles.balanceAmount, { color: colors.foreground }]}>
                      {isLoading
                        ? '—'
                        : summary?.account?.balance != null
                        ? `${summary.account.balance.toFixed(2)}`
                        : '—'}
                    </Text>
                    <Text style={[styles.balanceCurrency, { color: colors.primary }]}>
                      {summary?.account?.currency ?? 'USD'}
                    </Text>
                  </View>
                  <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                    Account balance
                  </Text>
                </View>
              </View>
            </View>

            {/* Stat cards */}
            <View style={styles.statsGrid}>
              <StatCard
                label="Servers"
                value={isLoading ? '—' : summary?.serverCount ?? 0}
                icon="server"
                accent
              />
              <StatCard
                label="Images"
                value={isLoading ? '—' : summary?.imageCount ?? 0}
                icon="camera"
              />
            </View>
            <View style={styles.statsGrid}>
              <StatCard
                label="Volumes"
                value={isLoading ? '—' : summary?.volumeCount ?? 0}
                icon="hard-drive"
              />
              <View style={{ flex: 1 }} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 12,
    paddingTop: 8,
  },
  accountCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accountCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  accountIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountEmail: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700' as const,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  balanceCurrency: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  balanceLabel: {
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
});
