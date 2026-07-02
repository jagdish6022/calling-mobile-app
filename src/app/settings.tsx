import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CallingAppModule, { Settings } from '@/modules/calling-app-module/src/CallingAppModule';
import GlassCard from '@/components/GlassCard';

export default function SettingsScreen() {
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
      console.error(e);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    const delayVal = parseInt(delay);
    const retryVal = parseInt(retry);
    const volumeVal = parseFloat(volume);

    if (isNaN(delayVal) || delayVal < 0) {
      Alert.alert('Error', 'Waiting time must be a positive number of seconds');
      return;
    }

    if (isNaN(retryVal) || retryVal < 0) {
      Alert.alert('Error', 'Redial attempts must be a positive number');
      return;
    }

    if (isNaN(volumeVal) || volumeVal < 0 || volumeVal > 1.0) {
      Alert.alert('Error', 'Volume must be between 0.0 (mute) and 1.0 (loudest)');
      return;
    }

    try {
      setSaving(true);
      await CallingAppModule.saveSettings(delayVal, retryVal, autoEndCall, ttsLanguage, volumeVal);
      Alert.alert('Success', 'Default settings saved successfully!');
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const languages = [
    { label: 'English (United States)', value: 'en-US' },
    { label: 'English (India Accent)', value: 'en-IN' },
    { label: 'Hindi (हिंदी - India)', value: 'hi-IN' },
    { label: 'Spanish (Español - Spain)', value: 'es-ES' },
    { label: 'French (Français - France)', value: 'fr-FR' },
    { label: 'German (Deutsch - Germany)', value: 'de-DE' }
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00E5FF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>App Customization</Text>
            <Text style={styles.headerTitle}>Calling Settings</Text>
          </View>
        </View>

        {/* Dialing Settings */}
        <Text style={styles.sectionTitle}>Campaign Defaults</Text>
        <GlassCard style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Wait Time Between Calls (Seconds)</Text>
            <Text style={styles.helperText}>
              How many seconds to wait after finishing a call before dialing the next person.
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={delay}
              onChangeText={setDelay}
              maxLength={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Redial Attempts (If Busy or No Answer)</Text>
            <Text style={styles.helperText}>
              If a customer doesn't pick up or is busy, how many times should the app try redialing them later. (e.g. 2 means 3 total calls).
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={retry}
              onChangeText={setRetry}
              maxLength={2}
            />
          </View>
        </GlassCard>

        {/* Telephony Settings */}
        <Text style={styles.sectionTitle}>SIM Call Management</Text>
        <GlassCard style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelCol}>
              <Text style={styles.switchLabel}>Automatic Hang Up</Text>
              <Text style={styles.switchSub}>
                Hang up the call automatically once your recorded voice message finishes playing.
              </Text>
              <Text style={styles.alertSub}>
                ⚠️ Note: If your phone model blocks this, you must press the hang-up button on your phone screen manually.
              </Text>
            </View>
            <Switch
              value={autoEndCall}
              onValueChange={setAutoEndCall}
              trackColor={{ false: '#374151', true: 'rgba(0, 229, 255, 0.3)' }}
              thumbColor={autoEndCall ? '#00E5FF' : '#9CA3AF'}
            />
          </View>
        </GlassCard>

        {/* Personalization Settings */}
        <Text style={styles.sectionTitle}>Voice Greeting Settings</Text>
        <GlassCard style={styles.card}>
          <Text style={styles.label}>Choose Voice Language (Accent)</Text>
          <Text style={styles.helperText}>
            The system will greet the customer by name (e.g., "Hello John") in this voice before playing your recording.
          </Text>
          <View style={styles.langList}>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.value}
                style={[
                  styles.langItem,
                  ttsLanguage === lang.value && styles.langItemActive
                ]}
                onPress={() => setTtsLanguage(lang.value)}
              >
                <Text
                  style={[
                    styles.langText,
                    ttsLanguage === lang.value && styles.langTextActive
                  ]}
                >
                  {lang.label}
                </Text>
                {ttsLanguage === lang.value && (
                  <Ionicons name="checkmark-circle" size={18} color="#00E5FF" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.separator} />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Voice Playback Volume (0.0 to 1.0)</Text>
            <Text style={styles.helperText}>
              Set the volume of the played audio. 1.0 is full volume (highly recommended).
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={volume}
              onChangeText={setVolume}
              placeholder="e.g. 1.0"
              maxLength={4}
            />
          </View>
        </GlassCard>

        {/* How it works Card */}
        <GlassCard style={styles.warningCard}>
          <Text style={styles.warningTitle}>📢 How does this app make calls?</Text>
          <Text style={styles.warningText}>
            1. **SIM Calling**: This app dials using your phone's normal SIM card (charges apply per your cellular plan).
          </Text>
          <Text style={styles.warningText}>
            2. **Speakerphone Workaround**: Since Android does not let apps inject audio files directly into phone lines, the app plays your message over the phone's **speakerphone** at high volume so the person on the other end hears it through the microphone.
          </Text>
          <Text style={styles.warningText}>
            3. **Volume Warning**: Keep your phone volume set to high and do not block the speaker or microphone while broadcasting.
          </Text>
        </GlassCard>

        {/* Save button */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#000" />
              <Text style={styles.saveBtnText}>Save Default Settings</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  container: {
    padding: 16,
    paddingBottom: 120,
  },
  center: {
    flex: 1,
    backgroundColor: '#0A0A0C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
    marginTop: 10,
  },
  headerSubtitle: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 14,
  },
  card: {
    backgroundColor: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  helperText: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1F2937',
    color: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabelCol: {
    flex: 1,
    paddingRight: 16,
  },
  switchLabel: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  switchSub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  alertSub: {
    color: '#FFA000',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 15,
  },
  langList: {
    gap: 8,
    marginBottom: 16,
  },
  langItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  langItemActive: {
    borderColor: '#00E5FF',
    backgroundColor: '#1E293B',
  },
  langText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  langTextActive: {
    color: '#00E5FF',
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 16,
  },
  warningCard: {
    backgroundColor: '#1E1B15',
    borderColor: '#FFA000',
    marginBottom: 24,
  },
  warningTitle: {
    color: '#FFA000',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  warningText: {
    color: '#FFD54F',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    elevation: 3,
  },
  saveBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
  },
});
