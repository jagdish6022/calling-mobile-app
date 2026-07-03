import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert
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

  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [tempFilePath, setTempFilePath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Animation values for pulsing microphone
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationTimer = useRef<any>(null);

  // Pulse animation loop
  useEffect(() => {
    let animation: Animated.CompositeAnimation;
    if (isRecording) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 800,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true
          })
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [isRecording]);

  // Duration timer
  useEffect(() => {
    if (isRecording) {
      durationTimer.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }
    }
    return () => {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }
    };
  }, [isRecording]);

  const handleStartRecord = async () => {
    try {
      // If we have a previous player active, stop it
      if (isPlaying) {
        await handleStopAudio();
      }

      setRecordDuration(0);
      setTempFilePath(null);
      
      const path = await CallingAppModule.startRecording(campaignId);
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      Alert.alert('Permission/Hardware Error', 'Failed to start voice recorder. Ensure microphone permission is granted.');
    }
  };

  const handleStopRecord = async () => {
    try {
      const path = await CallingAppModule.stopRecording();
      setIsRecording(false);
      setTempFilePath(path);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to stop recording');
      setIsRecording(false);
    }
  };

  const handlePlayAudio = async () => {
    if (!tempFilePath) return;
    try {
      setIsPlaying(true);
      const success = await CallingAppModule.playAudio(tempFilePath);
      if (!success) {
        setIsPlaying(false);
        Alert.alert('Error', 'Failed to play recorded audio');
      }
    } catch (e) {
      setIsPlaying(false);
    }
  };

  const handleStopAudio = async () => {
    try {
      await CallingAppModule.stopAudio();
    } catch (e) {
      console.error(e);
    } finally {
      setIsPlaying(false);
    }
  };

  const handleSave = async () => {
    if (!tempFilePath) return;
    try {
      setSaving(true);
      await CallingAppModule.updateCampaignAudio(campaignId, tempFilePath);
      Alert.alert('Success', 'Campaign voice recording saved successfully!', [
        { text: 'OK', onPress: () => router.replace({ pathname: '/campaign/[id]', params: { id: campaignId.toString() } }) }
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to save recording to campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemp = async () => {
    if (!tempFilePath) return;
    Alert.alert('Delete Recording', 'Discard this recording?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace({ pathname: '/campaign/[id]', params: { id: campaignId.toString() } })}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Audio Recording</Text>
            <Text style={styles.headerSub}>Voice Broadcast Setup</Text>
          </View>
        </View>

        <GlassCard style={styles.mainCard}>
          <Text style={styles.prompt}>
            Speak clearly into the microphone. Keep it concise so your customers stay engaged.
          </Text>

          {/* Timer Display */}
          <Text style={[styles.timer, isRecording && { color: '#FF5252' }]}>
            {formatDuration(recordDuration)}
          </Text>

          {/* Record Ring Indicator */}
          <View style={styles.micContainer}>
            {isRecording && (
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: pulseAnim }],
                    opacity: pulseAnim.interpolate({
                      inputRange: [1, 1.25],
                      outputRange: [0.6, 0]
                    })
                  }
                ]}
              />
            )}
            <TouchableOpacity
              style={[
                styles.micBtn,
                isRecording ? styles.recordingActive : styles.recordingIdle
              ]}
              onPress={isRecording ? handleStopRecord : handleStartRecord}
            >
              <Ionicons name={isRecording ? 'stop' : 'mic'} size={48} color={isRecording ? '#FFF' : '#00E5FF'} />
            </TouchableOpacity>
          </View>

          <Text style={styles.statusLabel}>
            {isRecording ? 'RECORDING VOICE...' : tempFilePath ? 'RECORDING CAPTURED' : 'TAP TO RECORD'}
          </Text>

          {/* Post Recording Controls */}
          {tempFilePath && (
            <View style={styles.postRecordActions}>
              <View style={styles.playRow}>
                {isPlaying ? (
                  <TouchableOpacity style={styles.playControlBtn} onPress={handleStopAudio}>
                    <Ionicons name="square" size={24} color="#FF5252" />
                    <Text style={[styles.playControlText, { color: '#FF5252' }]}>Stop Playback</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.playControlBtn} onPress={handlePlayAudio}>
                    <Ionicons name="play" size={24} color="#00E5FF" />
                    <Text style={[styles.playControlText, { color: '#00E5FF' }]}>Listen Snippet</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.discardBtn} onPress={handleDeleteTemp}>
                  <Ionicons name="trash-outline" size={20} color="#FF5252" />
                  <Text style={styles.discardText}>Discard</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
                      <Text style={styles.saveText}>Save Snippet</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </GlassCard>

        {/* Hints */}
        <GlassCard style={styles.tipCard}>
          <Text style={styles.tipTitle}>💡 Recording Tips</Text>
          <Text style={styles.tipText}>
            1. Keep background noise to a minimum.
          </Text>
          <Text style={styles.tipText}>
            2. The broadcast will greet the user with "Hello [Name]" using TTS, and then play this recording.
          </Text>
          <Text style={styles.tipText}>
            3. Target a duration of 15-30 seconds for maximum delivery rate.
          </Text>
        </GlassCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 10,
    gap: 12,
  },
  backBtn: {
    padding: 8,
    backgroundColor: '#1F2937',
    borderRadius: 12,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
  },
  headerSub: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  mainCard: {
    backgroundColor: '#111827',
    alignItems: 'center',
    padding: 24,
    flex: 1.3,
  },
  prompt: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  timer: {
    color: '#00E5FF',
    fontFamily: 'monospace',
    fontSize: 48,
    fontWeight: '800',
    marginVertical: 10,
  },
  micContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 30,
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#FF5252',
  },
  micBtn: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#00E5FF',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  recordingIdle: {
    backgroundColor: '#1F2937',
    borderWidth: 2,
    borderColor: '#00E5FF',
  },
  recordingActive: {
    backgroundColor: '#FF5252',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#FF5252',
  },
  statusLabel: {
    color: '#B0B4BA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  postRecordActions: {
    alignSelf: 'stretch',
    gap: 16,
    marginTop: 10,
  },
  playRow: {
    alignItems: 'center',
  },
  playControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
    backgroundColor: '#1F2937',
  },
  playControlText: {
    fontWeight: '700',
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  discardBtn: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#FF5252',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  discardText: {
    color: '#FF5252',
    fontWeight: '700',
    fontSize: 14,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  saveText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
  },
  tipCard: {
    backgroundColor: '#111827',
    padding: 16,
    flex: 0.7,
  },
  tipTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  tipText: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
});
