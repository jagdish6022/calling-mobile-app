import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CallingAppModule, { Settings } from '@/modules/calling-app-module/src/CallingAppModule';
import GlassCard from '@/components/GlassCard';

export default function SettingsScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const pad = isTablet ? 32 : 16;

  const [delay, setDelay] = useState('10');
  const [retry, setRetry] = useState('2');
  const [autoEndCall, setAutoEndCall] = useState(true);
  const [ttsLanguage, setTtsLanguage] = useState('en-US');
  const [volume, setVolume] = useState('1.0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    try {
      const config = await CallingAppModule.getSettings();
      if (config) {
        setDelay(config.delayBetweenCalls.toString());
        setRetry(config.retryCount.toString());
        setAutoEndCall(config.autoEndCall);
        setTtsLanguage(config.ttsLanguage);
        setVolume(config.audioVolume.toString());
      }
    } catch (e) {
      Alert.alert('Error', 'Could not load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSave = async () => {
    const delayVal = parseInt(delay);
    const retryVal = parseInt(retry);
    const volumeVal = parseFloat(volume);

    if (isNaN(delayVal) || delayVal < 0) {
      Alert.alert('Check Wait Time', 'Please enter a valid number of seconds (e.g. 5 or 10).');
      return;
    }
    if (isNaN(retryVal) || retryVal < 0) {
      Alert.alert('Check Redial Setting', 'Please enter a valid number of redial attempts (e.g. 2).');
      return;
    }
    if (isNaN(volumeVal) || volumeVal < 0 || volumeVal > 1.0) {
      Alert.alert('Check Volume', 'Volume must be between 0.0 (silent) and 1.0 (full volume).');
      return;
    }

    try {
      setSaving(true);
      await CallingAppModule.saveSettings(delayVal, retryVal, autoEndCall, ttsLanguage, volumeVal);
      Alert.alert('✅ Saved!', 'Your default settings have been saved successfully.');
    } catch (e) {
      Alert.alert('Error', 'Could not save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const languages = [
    { label: '🇺🇸  English (United States)', value: 'en-US' },
    { label: '🇮🇳  English (India Accent)', value: 'en-IN' },
    { label: '🇮🇳  Hindi (हिंदी)', value: 'hi-IN' },
    { label: '🇪🇸  Spanish (Español)', value: 'es-ES' },
    { label: '🇫🇷  French (Français)', value: 'fr-FR' },
    { label: '🇩🇪  German (Deutsch)', value: 'de-DE' }
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.container, { padding: pad, paddingBottom: 120 }]}>
        <View style={isTablet ? styles.tabletInner : undefined}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerSubtitle}>Preferences</Text>
            <Text style={[styles.headerTitle, isTablet && { fontSize: 38 }]}>App Settings</Text>
          </View>

          {/* Two-column layout on tablet */}
          <View style={isTablet ? styles.tabletRow : undefined}>

            <View style={isTablet ? styles.tabletCol : undefined}>
              {/* Dialing Settings */}
              <Text style={styles.sectionTitle}>Calling Defaults</Text>
              <GlassCard style={styles.card}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>⏱  Pause Between Each Call</Text>
                  <Text style={styles.helperText}>
                    How many seconds to wait after one call ends before dialing the next person.
                  </Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, styles.inputSmall]}
                      keyboardType="numeric"
                      value={delay}
                      onChangeText={setDelay}
                      maxLength={4}
                    />
                    <Text style={styles.inputUnit}>seconds</Text>
                  </View>
                </View>

                <View style={[styles.separator, { marginBottom: 16 }]} />

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>🔁  Redial if No Answer</Text>
                  <Text style={styles.helperText}>
                    If someone doesn't pick up or is busy, how many extra times should the app retry calling them?
                    (e.g. setting 2 means up to 3 total call attempts)
                  </Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, styles.inputSmall]}
                      keyboardType="numeric"
                      value={retry}
                      onChangeText={setRetry}
                      maxLength={2}
                    />
                    <Text style={styles.inputUnit}>extra attempts</Text>
                  </View>
                </View>
              </GlassCard>

              {/* Auto Hang Up */}
              <Text style={styles.sectionTitle}>Call Behaviour</Text>
              <GlassCard style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={styles.switchLabelCol}>
                    <Text style={styles.switchLabel}>📵  Auto Hang Up After Message</Text>
                    <Text style={styles.switchSub}>
                      When turned on, the app will automatically end the call once your recorded message finishes playing.
                    </Text>
                    <Text style={styles.alertSub}>
                      ⚠️ Some phones may not support this. If calls don't hang up automatically, you'll need to end them manually on your phone screen.
                    </Text>
                  </View>
                  <Switch
                    value={autoEndCall}
                    onValueChange={setAutoEndCall}
                    trackColor={{ false: '#374151', true: 'rgba(0,229,255,0.3)' }}
                    thumbColor={autoEndCall ? '#00E5FF' : '#9CA3AF'}
                  />
                </View>
              </GlassCard>
            </View>

            <View style={isTablet ? styles.tabletCol : undefined}>
              {/* TTS Language */}
              <Text style={styles.sectionTitle}>Greeting Voice Language</Text>
              <GlassCard style={styles.card}>
                <Text style={styles.label}>🗣  Choose Greeting Accent</Text>
                <Text style={styles.helperText}>
                  The app will greet the person by name (e.g., "Hello John") in this language before playing your recorded message.
                </Text>
                <View style={styles.langList}>
                  {languages.map((lang) => (
                    <TouchableOpacity
                      key={lang.value}
                      style={[styles.langItem, ttsLanguage === lang.value && styles.langItemActive]}
                      onPress={() => setTtsLanguage(lang.value)}
                    >
                      <Text style={[styles.langText, ttsLanguage === lang.value && styles.langTextActive]}>
                        {lang.label}
                      </Text>
                      {ttsLanguage === lang.value && (
                        <Ionicons name="checkmark-circle" size={20} color="#00E5FF" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.separator} />

                <View style={[styles.inputGroup, { marginTop: 16, marginBottom: 0 }]}>
                  <Text style={styles.label}>🔊  Playback Volume</Text>
                  <Text style={styles.helperText}>
                    Controls how loud the message plays during a call. Use 1.0 for full volume (recommended).
                  </Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, styles.inputSmall]}
                      keyboardType="numeric"
                      value={volume}
                      onChangeText={setVolume}
                      placeholder="1.0"
                      maxLength={4}
                    />
                    <Text style={styles.inputUnit}>(0.0 = silent · 1.0 = full)</Text>
                  </View>
                </View>
              </GlassCard>
            </View>
          </View>

          {/* How it works */}
          <GlassCard style={styles.infoCard}>
            <Text style={styles.infoTitle}>📢 How does this app make calls?</Text>
            <Text style={styles.infoText}>
              <Text style={{ fontWeight: '700' }}>1. Your SIM Card: </Text>
              All calls are placed using your phone's normal SIM card — standard call charges from your carrier apply.
            </Text>
            <Text style={styles.infoText}>
              <Text style={{ fontWeight: '700' }}>2. Speakerphone Method: </Text>
              Android doesn't allow apps to inject audio directly into phone calls, so the app plays your message over the phone's speaker at high volume so the other person can hear it clearly through the microphone.
            </Text>
            <Text style={styles.infoText}>
              <Text style={{ fontWeight: '700' }}>3. Keep Volume Loud: </Text>
              Make sure your phone's volume is at maximum and nothing is blocking the speaker or microphone while calls are running.
            </Text>
          </GlassCard>

          {/* Save Button */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="save-outline" size={22} color="#000" />
                <Text style={styles.saveBtnText}>Save Settings</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0A0A0C' },
  container: {},
  tabletInner: { maxWidth: 860, alignSelf: 'center', width: '100%' },
  center: { flex: 1, backgroundColor: '#0A0A0C', justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#9CA3AF', fontSize: 14 },

  header: { marginBottom: 24, marginTop: 10 },
  headerSubtitle: { color: '#00E5FF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { color: '#FFF', fontSize: 32, fontWeight: '800' },

  tabletRow: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  tabletCol: { flex: 1 },

  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: 10, marginTop: 20 },
  card: { backgroundColor: '#111827', marginBottom: 6 },
  inputGroup: { marginBottom: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 6 },
  helperText: { color: '#9CA3AF', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  input: {
    backgroundColor: '#1F2937', color: '#FFF', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  inputSmall: { width: 90 },
  inputUnit: { color: '#6B7280', fontSize: 13, fontWeight: '600' },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  switchLabelCol: { flex: 1, paddingRight: 16 },
  switchLabel: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  switchSub: { color: '#9CA3AF', fontSize: 13, marginTop: 6, lineHeight: 18 },
  alertSub: { color: '#FFA000', fontSize: 12, fontWeight: '600', marginTop: 8, lineHeight: 16 },

  langList: { gap: 8, marginBottom: 8 },
  langItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1F2937', paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)',
    minHeight: 52,
  },
  langItemActive: { borderColor: '#00E5FF', backgroundColor: '#1E293B' },
  langText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  langTextActive: { color: '#00E5FF', fontWeight: '700' },

  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 4 },

  infoCard: { backgroundColor: '#1E1B15', borderColor: '#FFA000', marginTop: 20, marginBottom: 8 },
  infoTitle: { color: '#FFA000', fontSize: 15, fontWeight: '800', marginBottom: 12 },
  infoText: { color: '#FFD54F', fontSize: 13, lineHeight: 20, marginBottom: 10 },

  saveBtn: {
    flexDirection: 'row', backgroundColor: '#00E5FF', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 14, gap: 10, elevation: 3, marginTop: 24,
  },
  saveBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
});
