import React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

// ─── Status Badge ─────────────────────────────────────────────────────────────

function statusColor(
  status: string | null | undefined,
  colors: ReturnType<typeof useColors>,
): { bg: string; fg: string; dot: string } {
  const s = (status ?? '').toLowerCase();
  if (s === 'active' || s === 'running' || s === 'available')
    return { bg: '#0f291a', fg: '#22c55e', dot: '#22c55e' };
  if (s === 'off' || s === 'stopped' || s === 'inactive')
    return { bg: colors.muted, fg: colors.mutedForeground, dot: colors.mutedForeground };
  if (s === 'pending' || s === 'provisioning' || s === 'building' || s === 'converting')
    return { bg: '#271c08', fg: colors.primary, dot: colors.primary };
  if (s === 'rebooting')
    return { bg: '#0a1c27', fg: colors.accent, dot: colors.accent };
  if (s === 'error' || s === 'failed')
    return { bg: '#27080a', fg: colors.destructive, dot: colors.destructive };
  return { bg: colors.muted, fg: colors.mutedForeground, dot: colors.mutedForeground };
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const colors = useColors();
  const sc = statusColor(status, colors);
  const label = status ?? 'unknown';
  return (
    <View style={[styles.badge, { backgroundColor: sc.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: sc.dot }]} />
      <Text style={[styles.badgeText, { color: sc.fg }]}>{label}</Text>
    </View>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number | null | undefined;
  icon: string;
  accent?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.statIcon,
          { backgroundColor: accent ? colors.primary + '22' : colors.muted },
        ]}
      >
        <Feather
          name={icon as never}
          size={18}
          color={accent ? colors.primary : colors.mutedForeground}
        />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value ?? '—'}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ─── Server Row ───────────────────────────────────────────────────────────────

export function ServerRow({
  name,
  status,
  ip,
  region,
  costPerHour,
  onPress,
}: {
  name: string | null | undefined;
  status: string | null | undefined;
  ip: string | null | undefined;
  region: string | null | undefined;
  costPerHour: number | null | undefined;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.serverRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      testID="server-row"
    >
      <View style={[styles.serverIconWrap, { backgroundColor: colors.muted }]}>
        <MaterialCommunityIcons name="server" size={18} color={colors.primary} />
      </View>
      <View style={styles.serverRowBody}>
        <View style={styles.serverRowTop}>
          <Text
            style={[styles.serverName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {name ?? 'Unnamed'}
          </Text>
          <StatusBadge status={status} />
        </View>
        <View style={styles.serverRowMeta}>
          {region ? (
            <View style={styles.metaItem}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{region}</Text>
            </View>
          ) : null}
          {ip ? (
            <View style={styles.metaItem}>
              <Feather name="wifi" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground, fontVariant: ['tabular-nums'] }]}>
                {ip}
              </Text>
            </View>
          ) : null}
          {typeof costPerHour === 'number' ? (
            <View style={styles.metaItem}>
              <Feather name="dollar-sign" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground, fontVariant: ['tabular-nums'] }]}>
                {costPerHour.toFixed(4)}/hr
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Feather name="chevron-right" size={16} color={colors.border} />
    </TouchableOpacity>
  );
}

// ─── Detail Field ─────────────────────────────────────────────────────────────

export function DetailField({
  icon,
  label,
  value,
  mono,
}: {
  icon: string;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[styles.detailField, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.detailFieldIcon, { backgroundColor: colors.muted }]}>
        <Feather name={icon as never} size={14} color={colors.mutedForeground} />
      </View>
      <View style={styles.detailFieldBody}>
        <Text style={[styles.detailFieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text
          style={[
            styles.detailFieldValue,
            { color: colors.foreground },
            mono && { fontVariant: ['tabular-nums'] as never },
          ]}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {value ?? '—'}
        </Text>
      </View>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  const colors = useColors();
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
        <Feather name={icon as never} size={28} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

export function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: '#27080a' }]}>
        <Feather name="alert-triangle" size={28} color={colors.destructive} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Failed to load</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        {message ?? 'Could not reach the API. Deploy the app for live data.'}
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        activeOpacity={0.7}
        style={[styles.retryBtn, { borderColor: colors.border }]}
      >
        <Feather name="refresh-cw" size={14} color={colors.foreground} />
        <Text style={[styles.retryText, { color: colors.foreground }]}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

export function SkeletonRow() {
  const colors = useColors();
  return (
    <View
      style={[styles.skeletonRow, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.skeletonIcon, { backgroundColor: colors.muted }]} />
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonLine, { backgroundColor: colors.muted, width: '55%' }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.muted, width: '35%', marginTop: 6 }]} />
      </View>
    </View>
  );
}

export function LoadingList() {
  return (
    <View style={{ gap: 8, paddingHorizontal: 16 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

export function SectionHeader({ title, count }: { title: string; count?: number }) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      {typeof count === 'number' && (
        <View style={[styles.countPill, { backgroundColor: colors.muted }]}>
          <Text style={[styles.countText, { color: colors.mutedForeground }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Inline Spinner ───────────────────────────────────────────────────────────

export function InlineSpinner() {
  const colors = useColors();
  return <ActivityIndicator size="small" color={colors.primary} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
  // Stat card
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700' as const,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  // Server row
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  serverIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverRowBody: {
    flex: 1,
    gap: 5,
  },
  serverRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  serverName: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
  },
  serverRowMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  // Detail field
  detailField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  detailFieldIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailFieldBody: {
    flex: 1,
    gap: 2,
  },
  detailFieldLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detailFieldValue: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  // Empty / error
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  // Skeleton
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  skeletonIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  skeletonBody: {
    flex: 1,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  countPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
});
