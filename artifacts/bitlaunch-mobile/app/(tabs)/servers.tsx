import React, { useState, useMemo } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useListBitlaunchServers } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { EmptyState, ErrorState, LoadingList, SectionHeader, ServerRow } from '@/components/ui';

export default function ServersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const { data: servers, isLoading, isError, refetch, isFetching } = useListBitlaunchServers();

  const filtered = useMemo(() => {
    if (!servers) return [];
    const q = query.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter((s) =>
      [s.name, s.id, s.ip, s.region, s.size, s.status]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q)),
    );
  }, [servers, query]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Servers</Text>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); refetch(); }}
          activeOpacity={0.7}
          style={[styles.refreshBtn, { borderColor: colors.border }]}
          testID="btn-refresh"
        >
          <Feather
            name="refresh-cw"
            size={15}
            color={isFetching ? colors.primary : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>

      {/* Search */}
      {!isError && (
        <View style={[styles.searchWrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View
            style={[styles.searchInput, { backgroundColor: colors.muted, borderColor: colors.border }]}
          >
            <Feather name="search" size={14} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, IP, region…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchText, { color: colors.foreground }]}
              testID="input-search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={{ marginTop: 16 }}>
          <LoadingList />
        </View>
      ) : isError ? (
        <View style={[styles.centered, { paddingBottom: bottomPad }]}>
          <ErrorState onRetry={refetch} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => item.id ?? String(idx)}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomPad + 24 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            <SectionHeader
              title="Instances"
              count={filtered.length}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="server"
              title={query ? 'No matches' : 'No servers'}
              subtitle={
                query
                  ? `No servers match "${query}"`
                  : 'Servers you provision through BitLaunch will appear here.'
              }
            />
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <ServerRow
                name={item.name}
                status={item.status}
                ip={item.ip}
                region={item.region}
                costPerHour={item.costPerHour}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/server/${item.id}`);
                }}
              />
            </View>
          )}
          scrollEnabled={!!filtered.length}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchText: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  listContent: {
    paddingTop: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
