import React, { useState, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useGetBitlaunchImage, getGetBitlaunchImageQueryKey } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { InlineSpinner, StatusBadge } from '@/components/ui';

export default function SnapshotsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [imageId, setImageId] = useState('');
  const [committedId, setCommittedId] = useState('');
  const [polling, setPolling] = useState(false);

  const { data: image, isLoading, isError, refetch } = useGetBitlaunchImage(committedId, {
    query: {
      queryKey: getGetBitlaunchImageQueryKey(committedId),
      enabled: !!committedId && polling,
      refetchInterval: polling ? 5000 : false,
    },
  });

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  function startPolling() {
    if (!imageId.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCommittedId(imageId.trim());
    setPolling(true);
    inputRef.current?.blur();
  }

  function stopPolling() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPolling(false);
  }

  function reset() {
    setPolling(false);
    setCommittedId('');
    setImageId('');
  }

  const isDone =
    image?.status != null &&
    !['pending', 'provisioning', 'building', 'converting'].includes(
      image.status.toLowerCase(),
    );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: topPad + 16,
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + '20' }]}>
            <Feather name="camera" size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>MONITOR</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Snapshot Status</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Input card */}
          <View
            style={[
              styles.inputCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
              IMAGE / SNAPSHOT ID
            </Text>
            <View
              style={[
                styles.inputRow,
                { backgroundColor: colors.muted, borderColor: colors.border },
                polling && { borderColor: colors.primary + '60' },
              ]}
            >
              <Feather name="hash" size={15} color={colors.mutedForeground} />
              <TextInput
                ref={inputRef}
                value={imageId}
                onChangeText={setImageId}
                placeholder="e.g. 12345"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.textInput, { color: colors.foreground }]}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="default"
                editable={!polling}
                testID="input-image-id"
                onSubmitEditing={startPolling}
                returnKeyType="go"
              />
              {(imageId.length > 0 || committedId.length > 0) && !polling && (
                <TouchableOpacity onPress={reset} activeOpacity={0.7}>
                  <Feather name="x" size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>

            {!polling ? (
              <TouchableOpacity
                onPress={startPolling}
                activeOpacity={0.8}
                disabled={!imageId.trim()}
                style={[
                  styles.pollBtn,
                  {
                    backgroundColor: imageId.trim() ? colors.primary : colors.muted,
                  },
                ]}
                testID="btn-start-poll"
              >
                <Feather
                  name="radio"
                  size={15}
                  color={imageId.trim() ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.pollBtnText,
                    {
                      color: imageId.trim()
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  Start Polling
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={stopPolling}
                activeOpacity={0.8}
                style={[
                  styles.pollBtn,
                  { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 },
                ]}
                testID="btn-stop-poll"
              >
                <Feather name="square" size={15} color={colors.foreground} />
                <Text style={[styles.pollBtnText, { color: colors.foreground }]}>
                  Stop Polling
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Status card */}
          {polling && (
            <View
              style={[
                styles.statusCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {/* Live indicator */}
              <View style={styles.liveRow}>
                {isLoading || isFetchingData(isLoading, polling) ? (
                  <InlineSpinner />
                ) : (
                  <View
                    style={[
                      styles.liveDot,
                      {
                        backgroundColor: isDone ? '#22c55e' : colors.primary,
                      },
                    ]}
                  />
                )}
                <Text style={[styles.liveLabel, { color: colors.mutedForeground }]}>
                  {isLoading
                    ? 'Fetching…'
                    : isError
                    ? 'Error fetching image'
                    : isDone
                    ? 'Complete'
                    : 'Polling every 5s'}
                </Text>
                {!isLoading && !isError && (
                  <TouchableOpacity onPress={() => refetch()} activeOpacity={0.7}>
                    <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>

              {isError ? (
                <View style={styles.errorInline}>
                  <Feather name="alert-circle" size={14} color={colors.destructive} />
                  <Text style={[styles.errorText, { color: colors.destructive }]}>
                    Image not found or API unreachable
                  </Text>
                </View>
              ) : image ? (
                <View style={styles.imageDetails}>
                  <View style={styles.imageNameRow}>
                    <Text style={[styles.imageName, { color: colors.foreground }]}>
                      {image.name ?? 'Unnamed'}
                    </Text>
                    <StatusBadge status={image.status} />
                  </View>

                  <View style={styles.imageGrid}>
                    <ImageMetaItem
                      icon="layers"
                      label="Type"
                      value={image.type ?? '—'}
                    />
                    <ImageMetaItem
                      icon="package"
                      label="Distribution"
                      value={image.distribution ?? '—'}
                    />
                    <ImageMetaItem
                      icon="hard-drive"
                      label="Size"
                      value={image.sizeGb != null ? `${image.sizeGb} GB` : '—'}
                    />
                    <ImageMetaItem
                      icon="hash"
                      label="ID"
                      value={image.id ?? '—'}
                      mono
                    />
                  </View>
                </View>
              ) : null}
            </View>
          )}

          {/* Help text when idle */}
          {!polling && !committedId && (
            <View style={[styles.hint, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="info" size={14} color={colors.accent} />
              <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                Enter an image or snapshot ID to track its build status. After creating a snapshot from a server,
                paste the returned ID here to monitor progress.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// Small helper to avoid hook rules issues
function isFetchingData(isLoading: boolean, polling: boolean) {
  return isLoading && polling;
}

function ImageMetaItem({
  icon,
  label,
  value,
  mono,
}: {
  icon: string;
  label: string;
  value: string;
  mono?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={imgStyles.item}>
      <View style={[imgStyles.iconWrap, { backgroundColor: colors.muted }]}>
        <Feather name={icon as never} size={12} color={colors.mutedForeground} />
      </View>
      <View>
        <Text style={[imgStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <Text
          style={[
            imgStyles.value,
            { color: colors.foreground },
            mono && { fontVariant: ['tabular-nums'] as never },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const imgStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: '45%',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  scroll: {
    padding: 16,
    gap: 14,
  },
  inputCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    padding: 0,
  },
  pollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  pollBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  statusCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  errorInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 14,
  },
  imageDetails: {
    gap: 14,
  },
  imageNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  imageName: {
    fontSize: 18,
    fontWeight: '700' as const,
    flex: 1,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  hint: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
