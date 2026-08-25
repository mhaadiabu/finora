import { useAui, useAuiState, AuiIf, ComposerPrimitive } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { ThinkingOrb } from '@mhaadi/thinking-orbs-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  View,
  AppState,
  Platform,
  ActionSheetIOS,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  TextInput,
  type TextInputProps,
} from 'react-native';

import { AVATAR_COLORS } from '@/components/contacts/types';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius, Rounded, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  FINORA_TAG_GLOBAL_MIN_CHARS,
  searchFinoraTagsRemote,
  type FinoraTagSuggestion,
} from '@/lib/finora-tags';
import { haptics } from '@/lib/haptics';
import { payrollAttachmentContext, uploadPayrollAttachment } from '@/lib/payroll-attachments-api';
import { ensureMediaLibraryPermission } from '@/lib/permissions';
import { deleteRecording, transcribeRecording } from '@/lib/transcription-api';

import {
  ComposerImageAttachment,
  ComposerDocumentAttachment,
  ComposerAttachmentChip,
} from './attachment';

const COMPOSER_ATTACHMENT_COMPONENTS = {
  Image: ComposerImageAttachment,
  Document: ComposerDocumentAttachment,
  File: ComposerDocumentAttachment,
  Attachment: ComposerAttachmentChip,
};

const TAG_ACCENT = {
  light: '#0F766E',
  dark: '#2DD4BF',
} as const;

function AttachButton() {
  const { colors } = useTheme();
  const aui = useAui();
  const { getToken } = useAuth();

  const addUploadedAttachment = async (source: Parameters<typeof uploadPayrollAttachment>[0]) => {
    try {
      const uploaded = await uploadPayrollAttachment(source, getToken);
      await aui.composer.addAttachment({
        id: uploaded.attachmentId,
        name: uploaded.name,
        type: uploaded.contentType.startsWith('image/') ? 'image' : 'document',
        contentType: uploaded.contentType,
        content: [{ type: 'text', text: payrollAttachmentContext(uploaded) }],
      });
      haptics.success();
    } catch (error) {
      Alert.alert(
        'Could not attach file',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const openWebFilePicker = (acceptTypes: string) => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = acceptTypes;
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      for (const file of files) {
        await addUploadedAttachment({
          file,
          name: file.name,
          contentType: file.type || 'application/octet-stream',
        });
      }
    };
    input.click();
  };

  const handleNativePickImage = async () => {
    const hasPermission = await ensureMediaLibraryPermission(
      'Allow photo access in Settings to attach images.',
    );
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (result.canceled || !result.assets?.length) return;

    for (const asset of result.assets) {
      await addUploadedAttachment({
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        contentType: asset.mimeType || 'image/jpeg',
        size: asset.fileSize,
      });
    }
  };

  const handleNativePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: true,
    });

    if (result.canceled || !result.assets?.length) return;

    for (const asset of result.assets) {
      await addUploadedAttachment({
        uri: asset.uri,
        name: asset.name,
        contentType: asset.mimeType || 'application/octet-stream',
        size: asset.size,
      });
    }
  };

  const handlePress = () => {
    haptics.selection();
    // Settle keyboard layout before the system picker takes over.
    Keyboard.dismiss();

    if (Platform.OS === 'web' || typeof document !== 'undefined') {
      openWebFilePicker('image/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx,.csv,.json');
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Photo Library', 'Choose Document'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) void handleNativePickImage();
          else if (buttonIndex === 2) void handleNativePickDocument();
        },
      );
      return;
    }

    Alert.alert('Add Attachment', 'Choose attachment type', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Photo', onPress: () => void handleNativePickImage() },
      { text: 'Document', onPress: () => void handleNativePickDocument() },
    ]);
  };

  return (
    <Pressable
      accessibilityLabel='Attach file or photo'
      hitSlop={8}
      onPress={handlePress}
      className='h-[38px] w-[38px] items-center justify-center'
      style={({ pressed }) => [
        {
          backgroundColor: pressed ? colors.muted : 'transparent',
        },
      ]}
    >
      <Icon
        name='attach'
        size={20}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

function ScanButton() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <Pressable
      accessibilityLabel='Scan QR to pay'
      hitSlop={8}
      onPress={() => {
        haptics.selection();
        router.push('/scan');
      }}
      className='h-[38px] w-[38px] items-center justify-center'
      style={({ pressed }) => [{ backgroundColor: pressed ? colors.muted : 'transparent' }]}
    >
      <Icon
        name='qr'
        size={20}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

type VoiceState = 'idle' | 'requesting_permission' | 'recording' | 'transcribing';

const MAX_RECORDING_SECONDS = 45;
const INITIAL_SILENCE_TIMEOUT_MS = 7_000;
const TRAILING_SILENCE_TIMEOUT_MS = 2_500;
const VOICE_ACTIVITY_THRESHOLD_DB = -42;
const VOICE_ACTIVITY_SAMPLES_REQUIRED = 2;
const VOICE_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

function useVoiceComposer() {
  const { getToken } = useAuth();
  const aui = useAui();
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [speechActive, setSpeechActive] = useState(false);
  const voiceStateRef = useRef<VoiceState>('idle');
  const speechActiveRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const draftBeforeRecordingRef = useRef('');
  const voiceSessionRef = useRef(0);
  const speechDetectedRef = useRef(false);
  const voiceActivitySamplesRef = useRef(0);
  const lastVoiceActivityAtRef = useRef(0);
  const stopRecordingRef = useRef<(discard?: boolean) => Promise<void>>(() => Promise.resolve());

  voiceStateRef.current = voiceState;

  const clearStopTimer = () => {
    if (!stopTimerRef.current) return;
    clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
  };

  const updateVoiceState = (next: VoiceState) => {
    voiceStateRef.current = next;
    if (mountedRef.current) setVoiceState(next);
  };

  const updateSpeechActive = (next: boolean) => {
    if (speechActiveRef.current === next) return;
    speechActiveRef.current = next;
    if (mountedRef.current) setSpeechActive(next);
  };

  const stopRecording = async (discard = false) => {
    if (voiceStateRef.current !== 'recording') return;
    const sessionId = voiceSessionRef.current;
    updateSpeechActive(false);
    updateVoiceState(discard ? 'idle' : 'transcribing');
    clearStopTimer();

    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);

      if (!uri || discard) {
        deleteRecording(uri);
        return;
      }

      const contentType = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
      const result = await transcribeRecording(uri, contentType, getToken);
      if (!mountedRef.current || voiceSessionRef.current !== sessionId) return;

      const transcript = result.transcript.trim();
      if (!transcript) return;
      const existing = draftBeforeRecordingRef.current.trimEnd();
      aui.thread.composer().setText(existing ? `${existing} ${transcript}` : transcript);
      haptics.success();
    } catch (error) {
      if (!discard && mountedRef.current && voiceSessionRef.current === sessionId) {
        haptics.error();
        Alert.alert(
          'Could not transcribe',
          error instanceof Error ? error.message : 'Please try recording again.',
        );
      }
    } finally {
      if (voiceSessionRef.current === sessionId) updateVoiceState('idle');
    }
  };
  stopRecordingRef.current = stopRecording;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && voiceStateRef.current === 'recording') {
        void stopRecordingRef.current(true);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (voiceState !== 'recording' || typeof recorderState.metering !== 'number') return;

    const now = Date.now();
    if (recorderState.metering >= VOICE_ACTIVITY_THRESHOLD_DB) {
      voiceActivitySamplesRef.current += 1;
      lastVoiceActivityAtRef.current = now;
      if (voiceActivitySamplesRef.current >= VOICE_ACTIVITY_SAMPLES_REQUIRED) {
        speechDetectedRef.current = true;
        updateSpeechActive(true);
      }
      return;
    }

    voiceActivitySamplesRef.current = 0;
    updateSpeechActive(false);
    if (!speechDetectedRef.current) {
      if (recorderState.durationMillis >= INITIAL_SILENCE_TIMEOUT_MS) {
        void stopRecordingRef.current(true);
      }
      return;
    }

    if (now - lastVoiceActivityAtRef.current >= TRAILING_SILENCE_TIMEOUT_MS) {
      void stopRecordingRef.current(false);
    }
  }, [recorderState.durationMillis, recorderState.metering, voiceState]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearStopTimer();
      if (voiceStateRef.current === 'recording') {
        void recorder.stop().then(() => deleteRecording(recorder.uri));
      }
    };
  }, [recorder]);

  const startRecording = async () => {
    if (voiceStateRef.current !== 'idle') return;
    const sessionId = voiceSessionRef.current + 1;
    voiceSessionRef.current = sessionId;
    draftBeforeRecordingRef.current = aui.thread.composer().getState().text;
    speechDetectedRef.current = false;
    updateSpeechActive(false);
    voiceActivitySamplesRef.current = 0;
    lastVoiceActivityAtRef.current = 0;
    updateVoiceState('requesting_permission');
    haptics.selection();

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Microphone access needed',
          'Allow microphone access in Settings to dictate messages to Finora.',
        );
        return;
      }
      if (voiceSessionRef.current !== sessionId) return;

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (voiceSessionRef.current !== sessionId) {
        if (voiceStateRef.current === 'idle') {
          await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
        }
        return;
      }
      recorder.record();
      updateVoiceState('recording');
      haptics.light();
      stopTimerRef.current = setTimeout(
        () => void stopRecording(false),
        MAX_RECORDING_SECONDS * 1000,
      );
    } catch (error) {
      if (voiceSessionRef.current === sessionId || voiceStateRef.current === 'idle') {
        await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      }
      if (voiceSessionRef.current === sessionId) {
        Alert.alert(
          'Could not start recording',
          error instanceof Error ? error.message : 'Please try again.',
        );
      }
    } finally {
      if (
        voiceSessionRef.current === sessionId &&
        (voiceStateRef.current as VoiceState) === 'requesting_permission'
      ) {
        updateVoiceState('idle');
      }
    }
  };

  const handleOrbPress = () => {
    if (voiceStateRef.current === 'recording') {
      haptics.light();
      void stopRecording(false);
      return;
    }
    if (voiceStateRef.current === 'requesting_permission') {
      haptics.selection();
      voiceSessionRef.current += 1;
      updateVoiceState('idle');
      return;
    }
    if (voiceStateRef.current === 'transcribing') {
      haptics.selection();
      voiceSessionRef.current += 1;
      updateVoiceState('idle');
    }
  };

  return { voiceState, speechActive, startRecording, handleOrbPress };
}

function MicButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityLabel='Dictate message'
      hitSlop={8}
      onPress={onPress}
      className='h-[38px] w-[38px] items-center justify-center'
      style={({ pressed }) => [{ backgroundColor: pressed ? colors.muted : 'transparent' }]}
    >
      <Icon
        name='mic'
        size={20}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

function PrimaryComposerAction({ onStartVoice }: { onStartVoice: () => void }) {
  const canSend = useAuiState((s) => s.thread.composer.canSend);
  return canSend ? <SendButton /> : <MicButton onPress={onStartVoice} />;
}

function VoiceComposer({
  state,
  speechActive,
  onPress,
}: {
  state: VoiceState;
  speechActive: boolean;
  onPress: () => void;
}) {
  const { isDark } = useTheme();
  const label =
    state === 'recording'
      ? 'Listening. Tap to stop and transcribe.'
      : state === 'transcribing'
        ? 'Transcribing. Tap to cancel.'
        : 'Starting voice input. Tap to cancel.';

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole='button'
      onPress={onPress}
      className='h-20 w-[38%] min-w-[104px] max-w-36 items-center justify-center self-center rounded-[22px] border border-border bg-composer p-2'
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <View pointerEvents='none'>
        <ThinkingOrb
          state={
            state === 'recording'
              ? 'listening'
              : state === 'transcribing'
                ? 'solving'
                : 'connecting'
          }
          size={64}
          speed={state === 'requesting_permission' ? 1.2 : 1.5}
          paused={state === 'recording' && !speechActive}
          theme={isDark ? 'dark' : 'light'}
          accessibilityLabel={label}
        />
      </View>
    </Pressable>
  );
}

function SendButton() {
  const { colors } = useTheme();
  const runtimeCanSend = useAuiState((s) => s.thread.composer.canSend);
  const canSend = runtimeCanSend;

  return (
    <ComposerPrimitive.Send
      accessibilityLabel='Send message'
      disabled={!canSend}
      onPressIn={() => {
        if (!canSend) return;
        haptics.success();
        Keyboard.dismiss();
      }}
      style={[styles.actionButton, { backgroundColor: canSend ? colors.primary : colors.muted }]}
    >
      <Icon
        name='send'
        size={18}
        color={canSend ? colors.primaryForeground : colors.mutedForeground}
      />
    </ComposerPrimitive.Send>
  );
}

function CancelButton() {
  const { colors } = useTheme();
  return (
    <ComposerPrimitive.Cancel
      accessibilityLabel='Stop generating'
      onPressIn={haptics.light}
      style={[styles.actionButton, { backgroundColor: colors.foreground }]}
    >
      <Icon
        name='stop'
        size={15}
        color={colors.background}
      />
    </ComposerPrimitive.Cancel>
  );
}

/**
 * Keep the native text field authoritative while typing. The assistant store
 * still receives every edit, but never controls the native value prop, which
 * avoids selection reconciliation and caret jumps during deletes.
 */
type ComposerInputHandle = {
  blur: () => void;
};

const ComposerInput = forwardRef<ComposerInputHandle, TextInputProps>(
  function ComposerInput(props, ref) {
    const { colors, isDark } = useTheme();
    const aui = useAui();
    const { getToken } = useAuth();
    const getTokenRef = useRef(getToken);
    const storeText = useAuiState((s) => s.thread.composer.text);
    const [localText, setLocalText] = useState(storeText);
    const nativeTextRef = useRef(storeText);
    const initialTextRef = useRef(storeText);
    const [tagProfiles, setTagProfiles] = useState<FinoraTagSuggestion[]>([]);
    const [directoryLoaded, setDirectoryLoaded] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const tagColor = isDark ? TAG_ACCENT.dark : TAG_ACCENT.light;

    getTokenRef.current = getToken;

    useImperativeHandle(ref, () => ({ blur: () => inputRef.current?.blur() }), []);

    useEffect(() => {
      if (nativeTextRef.current === storeText) return;
      nativeTextRef.current = storeText;
      setLocalText(storeText);
      if (storeText) inputRef.current?.setNativeProps({ text: storeText });
      else inputRef.current?.clear();
    }, [storeText]);

    const mentionMatch = localText.match(/(?:^|\s)@([a-z0-9_]*)$/i);
    const mentionQuery = mentionMatch?.[1]?.toLowerCase() ?? null;
    const slashQuery = localText.match(/^\/([a-z]*)$/i)?.[1]?.toLowerCase() ?? null;
    const slashCommands = [
      {
        command: '/web',
        title: 'Web search',
        description: 'Fast current information with sources',
        icon: 'tool' as const,
      },
      {
        command: '/shop',
        title: 'Product search',
        description: 'Find current listings within a budget',
        icon: 'dollar' as const,
      },
      {
        command: '/deep',
        title: 'Deep research',
        description: 'Thorough multi-source investigation',
        icon: 'brain' as const,
      },
    ].filter((item) => !slashQuery || item.command.slice(1).startsWith(slashQuery));

    useEffect(() => {
      if (mentionQuery === null) {
        setDirectoryLoaded(false);
        setTagProfiles((current) => (current.length ? [] : current));
        return;
      }
      let active = true;
      const controller = new AbortController();
      const timer = setTimeout(() => {
        void searchFinoraTagsRemote(mentionQuery, getTokenRef.current, controller.signal)
          .then((next) => {
            if (!active) return;
            setTagProfiles(next);
            setDirectoryLoaded(true);
          })
          .catch((error: unknown) => {
            if (!active || (error instanceof Error && error.name === 'AbortError')) return;
            setTagProfiles([]);
            setDirectoryLoaded(true);
          });
      }, 120);
      return () => {
        active = false;
        clearTimeout(timer);
        controller.abort();
      };
    }, [mentionQuery]);

    const selectTag = (profile: FinoraTagSuggestion) => {
      if (!mentionMatch || mentionQuery === null) return;
      const mentionStart = (mentionMatch.index ?? 0) + mentionMatch[0].lastIndexOf('@');
      const next = `${localText.slice(0, mentionStart)}@${profile.tag} `;
      nativeTextRef.current = next;
      setLocalText(next);
      inputRef.current?.setNativeProps({ text: next });
      aui.thread.composer().setText(next);
      haptics.selection();
      requestAnimationFrame(() => inputRef.current?.focus());
    };

    const selectSlashCommand = (command: string) => {
      const next = `${command} `;
      nativeTextRef.current = next;
      setLocalText(next);
      inputRef.current?.setNativeProps({ text: next });
      aui.thread.composer().setText(next);
      haptics.selection();
      requestAnimationFrame(() => inputRef.current?.focus());
    };

    const emptyHint =
      mentionQuery !== null && mentionQuery.length < FINORA_TAG_GLOBAL_MIN_CHARS
        ? 'Recent Finora recipients only. Type the full tag or 3+ characters.'
        : 'No recent match. Type the exact Finora Tag to send.';

    return (
      <View className='w-full'>
        {slashQuery !== null ? (
          <View
            className='border mb-2 p-1.5 bg-background border-border'
            style={[styles.mentionMenu]}
          >
            <Text className='font-sans-semibold text-[11px] tracking-[0.7px] px-2 py-[5px] uppercase text-muted-foreground'>
              Search modes
            </Text>
            {slashCommands.map((item) => (
              <Pressable
                key={item.command}
                accessibilityLabel={`Select ${item.title}`}
                onPress={() => selectSlashCommand(item.command)}
                className='min-h-[54px] flex-row items-center gap-3 px-2 py-1.5'
                style={({ pressed }) => [pressed && { backgroundColor: colors.muted }]}
              >
                <View className='h-9 w-9 items-center justify-center rounded-full bg-muted'>
                  <Icon
                    name={item.icon}
                    size={17}
                    color={colors.foreground}
                  />
                </View>
                <View className='flex-1'>
                  <Text className='font-sans-semibold text-[14px] text-foreground'>
                    {item.title}
                  </Text>
                  <Text className='font-sans text-[12px] text-muted-foreground'>
                    {item.description}
                  </Text>
                </View>
                <Text className='font-sans-medium text-[12px] text-muted-foreground'>
                  {item.command}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {mentionQuery !== null && directoryLoaded && (
          <View
            className='border mb-2 p-1.5 bg-background border-border'
            style={[styles.mentionMenu]}
          >
            <Text className='font-sans-semibold text-[11px] tracking-[0.7px] px-2 py-[5px] uppercase text-muted-foreground'>
              Recent Finora Tags
            </Text>
            {tagProfiles.length ? (
              tagProfiles.map((profile, index) => (
                <Pressable
                  key={profile.accountId}
                  accessibilityLabel={`Send to ${profile.displayName}, @${profile.tag}`}
                  onPress={() => selectTag(profile)}
                  className='min-h-[50px] flex-row items-center gap-2.5 px-2 py-1.5'
                  style={({ pressed }) => [pressed && { backgroundColor: colors.muted }]}
                >
                  <View
                    className='w-[34px] h-[34px] rounded-[17px] items-center justify-center'
                    style={[{ backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}
                  >
                    <Text className='font-sans-semibold text-white text-[13px]'>
                      {profile.initials}
                    </Text>
                  </View>
                  <View className='flex-1 gap-px'>
                    <Text
                      numberOfLines={1}
                      className='font-sans-semibold text-[14px] text-foreground'
                    >
                      {profile.displayName}
                    </Text>
                    <Text
                      numberOfLines={1}
                      className='font-sans text-[12px] text-muted-foreground'
                    >
                      @{profile.tag} ·{' '}
                      {profile.source === 'exact' ? 'Exact match' : 'Finora wallet'}
                    </Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text className='font-sans text-[13px] px-2 py-3 text-muted-foreground'>
                {emptyHint}
              </Text>
            )}
          </View>
        )}
        <TextInput
          {...props}
          ref={inputRef}
          defaultValue={initialTextRef.current}
          selectionColor={tagColor}
          onChangeText={(text) => {
            nativeTextRef.current = text;
            setLocalText(text);
            aui.thread.composer().setText(text);
          }}
        />
      </View>
    );
  },
);

export function Composer() {
  const { colors } = useTheme();
  const inputRef = useRef<ComposerInputHandle>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const { voiceState, speechActive, startRecording, handleOrbPress } = useVoiceComposer();
  const hasAttachments = useAuiState((s) => s.thread.composer.attachments.length > 0);
  const composerText = useAuiState((s) => s.thread.composer.text);
  const slashMode = /^(\/(?:web|search|shop|product|products|deep|research))?(?:\s|$)/i
    .exec(composerText)?.[1]
    ?.toLowerCase();
  const inputStyle = useMemo(
    () => [styles.input, { color: colors.foreground }],
    [colors.foreground],
  );

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidHide', () => {
      inputRef.current?.blur();
      setInputFocused(false);
    });
    return () => subscription.remove();
  }, []);

  return (
    <View
      className='w-full self-center px-3 pt-2'
      style={[styles.container]}
    >
      {voiceState !== 'idle' ? (
        <VoiceComposer
          state={voiceState}
          speechActive={speechActive}
          onPress={handleOrbPress}
        />
      ) : (
        <View
          className='flex-col gap-2.5 rounded-[32px] border border-border bg-composer px-3 pb-2.5 pt-3'
          style={[styles.shell]}
        >
          {slashMode ? (
            <View className='flex-row items-center gap-2 px-2'>
              <View className='h-6 w-6 items-center justify-center rounded-full bg-muted'>
                <Icon
                  name={
                    slashMode.includes('deep') || slashMode.includes('research')
                      ? 'brain'
                      : slashMode.includes('shop') || slashMode.includes('product')
                        ? 'dollar'
                        : 'tool'
                  }
                  size={13}
                  color={colors.foreground}
                />
              </View>
              <Text className='font-sans-medium text-[12px] text-muted-foreground'>
                {slashMode.includes('deep') || slashMode.includes('research')
                  ? 'Deep research mode'
                  : slashMode.includes('shop') || slashMode.includes('product')
                    ? 'Product search mode'
                    : 'Web search mode'}
              </Text>
            </View>
          ) : null}
          {hasAttachments ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className='max-h-[84px] grow-0'
              contentContainerStyle={styles.attachmentsRow}
              keyboardShouldPersistTaps='handled'
            >
              <ComposerPrimitive.Attachments components={COMPOSER_ATTACHMENT_COMPONENTS} />
            </ScrollView>
          ) : null}

          <ComposerInput
            ref={inputRef}
            style={inputStyle}
            placeholder='Ask Finora… use @ to tag'
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={4000}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />

          <View className='flex-row items-center gap-1 pt-0.5'>
            <AttachButton />
            <ScanButton />
            <View className='flex-1' />
            {inputFocused ? (
              <Pressable
                accessibilityLabel='Hide keyboard'
                hitSlop={8}
                onPress={() => {
                  inputRef.current?.blur();
                  Keyboard.dismiss();
                }}
                className='h-[38px] min-w-12 items-center justify-center rounded-full px-2'
                style={({ pressed }) => [
                  { backgroundColor: pressed ? colors.muted : 'transparent' },
                ]}
              >
                <Text className='font-sans-semibold text-[14px] text-foreground'>Done</Text>
              </Pressable>
            ) : null}
            <AuiIf condition={(s) => !s.thread.isRunning}>
              <PrimaryComposerAction
                onStartVoice={() => {
                  inputRef.current?.blur();
                  Keyboard.dismiss();
                  void startRecording();
                }}
              />
            </AuiIf>
            <AuiIf condition={(s) => s.thread.isRunning}>
              <CancelButton />
            </AuiIf>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = {
  container: {
    maxWidth: Spacing.threadMaxWidth + 24,
  },
  shell: {
    ...Rounded,
    borderRadius: Radius.composer,
  },
  input: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    lineHeight: 22,
    minHeight: 28,
    maxHeight: 132,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
    ...Platform.select({
      web: { outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  mentionMenu: {
    borderRadius: Radius.lg,
  },
  mentionRow: {
    borderRadius: Radius.md,
  },
  attachmentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  actionButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  doneButton: {
    borderRadius: Radius.pill,
  },
  voiceShell: {
    ...Rounded,
    borderRadius: Radius.lg,
  },
} as const;
