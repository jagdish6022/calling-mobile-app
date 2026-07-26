import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CallingAppModule from '@/modules/calling-app-module/src/CallingAppModule';
import GlassCard from '@/components/GlassCard';

export default function RecordAudioScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const campaignId = id ? parseInt(id as string) : NaN;

  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const pad = isTablet ? 32 : 16;
  const micSize = isTablet ? 140 : 110;
  const micIconSize = isTablet ? 56 : 48;
  const pulseSize = isTablet ? 180 : 140;

  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [tempFilePath, setTempFilePath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationTimer = useRef<any>(null);

  useEffect(() => {
    const sub = CallingAppModule.addListener('onAudioPlaybackFinished', () => {
      setIsPlaying(false);
    });
    return () => { sub.remove(); };
  }, []);

  useEffect(() => {
    let animation: Animated.CompositeAnimation;
    if (isRecording) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true })
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => { if (animation) animation.stop(); };
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      durationTimer.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimer.current) clearInterval(durationTimer.current);
    }
    return () => { if (durationTimer.current) clearInterval(durationTimer.current); };
  }, [isRecording]);

  const handleStartRecord = async () => {
    if (isNaN(campaignId)) return;
    try {
      if (isPlaying) await handleStopAudio();

      const perms = await CallingAppModule.checkPermissions();
      if (!perms.RECORD_AUDIO) {
        const requested = await CallingAppModule.requestPermissions();
        if (!requested) {
          Alert.alert('Microphone Access Needed', 'Please allow microphone access to record your voice message.');
          return;
        }
        const checkAgain = await CallingAppModule.checkPermissions();
        if (!checkAgain.RECORD_AUDIO) {
          Alert.alert('Microphone Access Needed', 'Please allow microphone access in your phone settings.');
          return;
        }
      }

      setRecordDuration(0);
      setTempFilePath(null);
      await CallingAppModule.startRecording(campaignId);
      setIsRecording(true);
    } catch (e) {
      Alert.alert('Could Not Start Recording', 'Make sure microphone permission is allowed and try again.');
    }
  };

  const handleStopRecord = async () => {
    try {
      const path = await CallingAppModule.stopRecording();
      setIsRecording(false);
      setTempFilePath(path);
    } catch (e) {
      Alert.alert('Error', 'Could not stop recording.');
      setIsRecording(false);
    }
  };

  const handlePlayAudio = async () => {
    if (!tempFilePath) return;
    try {
      setIsPlaying(true);
      const success = await CallingAppModule.playAudio(tempFilePath);
      if (!success) { setIsPlaying(false); Alert.alert('Error', 'Could not play the recording.'); }
    } catch (e) {
      setIsPlaying(false);
    }
  };

  const handleStopAudio = async () => {
    try { await CallingAppModule.stopAudio(); } catch (e) { console.error(e); } finally { setIsPlaying(false); }
  };

  const handleSave = async () => {
    if (!tempFilePath) return;
    try {
      setSaving(true);
      await CallingAppModule.updateCampaignAudio(campaignId, tempFilePath);
      Alert.alert('✅ Saved!', 'Your voice message has been saved to this campaign.', [
        { text: 'Done', onPress: () => router.replace({ pathname: '/campaign/[id]', params: { id: campaignId.toString() } }) }
      ]);
    } catch (e) {
      Alert.alert('Error', 'Could not save the recording. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!tempFilePath) return;
    Alert.alert('Discard Recording', 'Are you sure you want to delete this recording and start over?', [
      { text: 'Keep It', style: 'cancel' },
      {
        text: 'Yes, Discard',
        style: 'destructive',
        onPress: async () => {
          await CallingAppModule.deleteAudio(tempFilePath);
          setTempFilePath(null);
          setRecordDuration(0);
        }
      }
    ]);
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const statusText = isRecording
    ? 'Recording... tap to stop'
    : tempFilePath
      ? '✅ Recording saved — ready to use!'
      : 'Tap the microphone to start recording';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.outerContainer, { padding: pad }]}>
        <View style={isTablet ? styles.tabletInner : { flex: 1 }}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.replace({ pathname: '/campaign/[id]', params: { id: campaignId.toString() } })}
            >
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View>
              <Text style={[styles.headerTitle, isTablet && { fontSize: 28 }]}>Voice Message</Text>
              <Text style={styles.headerSub}>Record your broadcast</Text>
            </View>
          </View>

          {/* Main Recording Card */}
          <GlassCard style={[styles.mainCard, isTablet && { paddingVertical: 40 }]}>
            <Text style={styles.prompt}>
              Speak naturally and clearly. Your message will play automatically when someone answers the call.
            </Text>

            {/* Timer */}
            <Text style={[styles.timer, isRecording && { color: '#FF5252' }, isTablet && { fontSize: 60 }]}>
              {formatDuration(recordDuration)}
            </Text>

            {/* Mic Button with pulse */}
            <View style={[styles.micContainer, { height: pulseSize + 60 }]}>
              {isRecording && (
                <Animated.View
                  style={[
                    styles.pulseRing,
                    {
                      width: pulseSize,
                      height: pulseSize,
                      borderRadius: pulseSize / 2,
                      transform: [{ scale: pulseAnim }],
                      opacity: pulseAnim.interpolate({ inputRange: [1, 1.3], outputRange: [0.5, 0] })
                    }
                  ]}
                />
              )}
              <TouchableOpacity
                style={[
                  styles.micBtn,
                  { width: micSize, height: micSize, borderRadius: micSize / 2 },
                  isRecording ? styles.recordingActive : styles.recordingIdle
                ]}
                onPress={isRecording ? handleStopRecord : handleStartRecord}
              >
                <Ionicons
                  name={isRecording ? 'stop' : 'mic'}
                  size={micIconSize}
                  color={isRecording ? '#FFF' : '#00E5FF'}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.statusLabel}>{statusText}</Text>

            {/* Playback & Action Controls */}
            {tempFilePath && (
              <View style={styles.postRecordActions}>
                <View style={styles.playRow}>
                  {isPlaying ? (
                    <TouchableOpacity style={styles.playControlBtn} onPress={handleStopAudio}>
                      <Ionicons name="square" size={22} color="#FF5252" />
                      <Text style={[styles.playControlText, { color: '#FF5252' }]}>Stop Playback</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.playControlBtn} onPress={handlePlayAudio}>
                      <Ionicons name="play" size={22} color="#00E5FF" />
                      <Text style={[styles.playControlText, { color: '#00E5FF' }]}>Listen to Recording</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.discardBtn} onPress={handleDiscard}>
                    <Ionicons name="trash-outline" size={20} color="#FF5252" />
                    <Text style={styles.discardText}>Discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
                        <Text style={styles.saveText}>Save Message</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </GlassCard>

          {/* Tips Card */}
          <GlassCard style={styles.tipCard}>
            <Text style={styles.tipTitle}>💡 Recording Tips</Text>
            <Text style={styles.tipText}>• Find a quiet room with no background noise before recording.</Text>
            <Text style={styles.tipText}>• The app will first say "Hello [Name]" automatically, then play your recording.</Text>
            <Text style={styles.tipText}>• Aim for 15–30 seconds — shorter messages get listened to more often.</Text>
            <Text style={styles.tipText}>• Speak slowly and clearly so the other person understands easily.</Text>
          </GlassCard>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0A0A0C' },
  outerContainer: { flex: 1 },
  tabletInner: { maxWidth: 640, alignSelf: 'center', width: '100%', flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 10, gap: 12 },
  backBtn: { padding: 10, backgroundColor: '#1F2937', borderRadius: 12 },
  headerTitle: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  headerSub: { color: '#00E5FF', fontSize: 12, fontWeight: '600', marginTop: 2 },

  mainCard: { backgroundColor: '#111827', alignItems: 'center', padding: 24, marginBottom: 16, flex: 1 },
  prompt: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },

  timer: {
    color: '#00E5FF', fontFamily: 'monospace', fontSize: 52, fontWeight: '800', marginVertical: 10,
    letterSpacing: 2,
  },

  micContainer: { justifyContent: 'center', alignItems: 'center', marginVertical: 20 },
  pulseRing: { position: 'absolute', borderWidth: 2, borderColor: '#FF5252' },
  micBtn: {
    justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: '#00E5FF', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
  },
  recordingIdle: { backgroundColor: '#1F2937', borderWidth: 2, borderColor: '#00E5FF' },
  recordingActive: { backgroundColor: '#FF5252', borderWidth: 2, borderColor: '#FFF', shadowColor: '#FF5252' },

  statusLabel: { color: '#9CA3AF', fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 24 },

  postRecordActions: { alignSelf: 'stretch', gap: 14, marginTop: 8 },
  playRow: { alignItems: 'center' },
  playControlBtn: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 28, gap: 10, backgroundColor: '#1F2937', minWidth: 200, justifyContent: 'center',
  },
  playControlText: { fontWeight: '700', fontSize: 15 },
  actionRow: { flexDirection: 'row', gap: 12 },
  discardBtn: {
    flex: 1, flexDirection: 'row', borderWidth: 1.5, borderColor: '#FF5252',
    alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  discardText: { color: '#FF5252', fontWeight: '700', fontSize: 15 },
  saveBtn: {
    flex: 1, flexDirection: 'row', backgroundColor: '#00E5FF',
    alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  saveText: { color: '#000', fontWeight: '800', fontSize: 15 },

  tipCard: { backgroundColor: '#111827', padding: 18, gap: 8 },
  tipTitle: { color: '#FFF', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  tipText: { color: '#9CA3AF', fontSize: 13, lineHeight: 20 },
});
