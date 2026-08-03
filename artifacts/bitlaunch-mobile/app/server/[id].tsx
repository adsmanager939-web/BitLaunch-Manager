import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useGetBitlaunchServer,
  getGetBitlaunchServerQueryKey,
} from '@workspace/api-client-react';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { DetailField, ErrorState, LoadingList, StatusBadge } from '@/components/ui';

export default function ServerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: server, isLoading, isError, refetch, isFetching } = useGetBitlaunchServer(
    id ?? '',
    { query: { enabled: !!id, queryKey: getGetBitlaunchServerQueryKey(id ?? '') } },
  );

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  function formatCost(v: number | null | undefined) {
    if (v == null) return '—';
    return `$${v.toFixed(4)}/hr`;
  }

  function formatDate(v: string | null | undefined) {
    if (!v) return '—';
    try {
      return new Date(v).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return v;
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Custom header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          activeOpacity={0.7}
          style={[styles.backBtn, { borderColor: colors.border }]}
          testID="btn-back"
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerEyebrow, { color: colors.mutedForeground }]}>
            {id ?? ''}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {isLoading ? 'Loading…' : (server?.name ?? 'Unnamed Server')}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); refetch(); }}
          activeOpacity={0.7}
          style={[styles.backBtn, { borderColor: colors.border }]}
          testID="btn-refresh"
        >
          <Feather
            name="refresh-cw"
            size={15}
            color={isFetching ? colors.primary : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ marginTop: 20 }}>
          <LoadingList />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <ErrorState
            message={`Server "${id}" could not be retrieved.`}
            onRetry={refetch}
          />
        </View>
      ) : server ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero card */}
          <View
            style={[
              styles.heroCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={[styles.heroIcon, { backgroundColor: colors.primary + '18' }]}>
              <MaterialCommunityIcons name="server" size={28} color={colors.primary} />
            </View>
            <View style={styles.heroInfo}>
              <Text style={[styles.heroName, { color: colors.foreground }]} testID="server-name">
                {server.name ?? 'Unnamed Server'}
              </Text>
              <Text style={[styles.heroId, { color: colors.mutedForeground }]} testID="server-id">
                {server.id ?? '—'}
              </Text>
            </View>
            <StatusBadge status={server.status} />
          </View>

          {/* Detail fields */}
          <View style={styles.fields}>
            <DetailField icon="wifi" label="IP Address" value={server.ip} mono />
            <DetailField icon="map-pin" label="Region" value={server.region} />
            <DetailField icon="cpu" label="Plan / Size" value={server.size} />
            <DetailField icon="layers" label="Image" value={server.image} />
            <DetailField icon="dollar-sign" label="Cost per Hour" value={formatCost(server.costPerHour)} mono />
            <DetailField icon="calendar" label="Created" value={formatDate(server.createdAt)} />
            <DetailField icon="server" label="Status" value={server.status} />
            <DetailField icon="hash" label="Server ID" value={server.id} mono />
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    gap: 1,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '500' as const,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  scroll: {
    padding: 16,
    gap: 12,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: {
    flex: 1,
    gap: 3,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  heroId: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  fields: {
    gap: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
