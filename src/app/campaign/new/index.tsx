import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Modal,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import CallingAppModule, { Settings, Campaign, Contact } from '@/modules/calling-app-module/src/CallingAppModule';
import GlassCard from '@/components/GlassCard';

export default function NewCampaignScreen() {
  const router = useRouter();
  
  // Wizard State
  const [step, setStep] = useState(1);
  const [campaignId, setCampaignId] = useState<number | null>(null);

  // Step 1: Info State
  const [name, setName] = useState('');
  const [delay, setDelay] = useState('10');
  const [retry, setRetry] = useState('2');
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isDelayFocused, setIsDelayFocused] = useState(false);
  const [isRetryFocused, setIsRetryFocused] = useState(false);

  // Step 2: Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [tempFilePath, setTempFilePath] = useState<string | null>(null);
  const [savingAudio, setSavingAudio] = useState(false);
  
  // Animation & Timer refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationTimer = useRef<any>(null);

  // Listen for audio playback finished event
  useEffect(() => {
    const sub = CallingAppModule.addListener('onAudioPlaybackFinished', () => {
      setIsPlaying(false);
    });
    return () => {
      sub.remove();
    };
  }, []);

  // Step 3: Contacts State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submittingContact, setSubmittingContact] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);

  // Load default settings
  useEffect(() => {
    CallingAppModule.getSettings()
      .then((settings: Settings) => {
        if (settings) {
          setDelay(settings.delayBetweenCalls.toString());
          setRetry(settings.retryCount.toString());
        }
      })
      .catch((err: any) => console.log('Error loading default settings', err));
  }, []);

  // Step 2: Pulse Animation
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
      if (animation) animation.stop();
    };
  }, [isRecording]);

  // Step 2: Duration Timer
  useEffect(() => {
    if (isRecording) {
      durationTimer.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimer.current) clearInterval(durationTimer.current);
    }
    return () => {
      if (durationTimer.current) clearInterval(durationTimer.current);
    };
  }, [isRecording]);

  // --- Step 1 Navigation (Validate & Create Campaign) ---
  const handleProceedFromStep1 = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a campaign name');
      return;
    }

    const delayVal = parseInt(delay);
    const retryVal = parseInt(retry);

    if (isNaN(delayVal) || delayVal < 0) {
      Alert.alert('Validation Error', 'Delay must be a positive number of seconds');
      return;
    }

    if (isNaN(retryVal) || retryVal < 0) {
      Alert.alert('Validation Error', 'Retry count must be a positive number');
      return;
    }

    try {
      // If we already created it (e.g. user went back and forward), skip duplicate creation
      if (campaignId) {
        setStep(2);
        return;
      }
      
      const campaign = await CallingAppModule.createCampaign(name.trim(), delayVal, retryVal);
      setCampaignId(campaign.campaignId);
      setStep(2);
    } catch (e) {
      Alert.alert('Error', 'Failed to create campaign');
    }
  };

  // --- Step 2 Recording Logic ---
  const startRecording = async () => {
    if (!campaignId) return;
    try {
      if (isPlaying) {
        await stopAudio();
      }

      // Check and request microphone permissions
      const perms = await CallingAppModule.checkPermissions();
      if (!perms.RECORD_AUDIO) {
        const requested = await CallingAppModule.requestPermissions();
        if (!requested) {
          Alert.alert('Permission Denied', 'Microphone permission is required to record voice messages.');
          return;
        }
        const checkAgain = await CallingAppModule.checkPermissions();
        if (!checkAgain.RECORD_AUDIO) {
          Alert.alert('Permission Denied', 'Microphone permission is required to record voice messages.');
          return;
        }
      }

      setRecordDuration(0);
      setTempFilePath(null);
      
      await CallingAppModule.startRecording(campaignId);
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      Alert.alert('Recording Error', 'Make sure microphone permissions are granted.');
    }
  };

  const stopRecording = async () => {
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

  const playAudio = async () => {
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

  const stopAudio = async () => {
    try {
      await CallingAppModule.stopAudio();
    } catch (e) {
      console.error(e);
    } finally {
      setIsPlaying(false);
    }
  };

  const discardRecording = async () => {
    if (!tempFilePath) return;
    Alert.alert('Discard Audio', 'Are you sure you want to discard this recording?', [
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

  const handleProceedFromStep2 = async () => {
    if (!campaignId) return;
    try {
      setSavingAudio(true);
      if (tempFilePath) {
        await CallingAppModule.updateCampaignAudio(campaignId, tempFilePath);
      }
      // Load contacts in case user already has some
      const list = await CallingAppModule.getContacts(campaignId);
      setContacts(list);
      setStep(3);
    } catch (e) {
      Alert.alert('Error', 'Failed to save recording config');
    } finally {
      setSavingAudio(false);
    }
  };

  // --- Step 3 Contact Logic ---
  const loadContacts = async () => {
    if (!campaignId) return;
    const list = await CallingAppModule.getContacts(campaignId);
    setContacts(list);
  };

  const handleImportCsv = async () => {
    if (!campaignId) return;
    try {
      const doc = await DocumentPicker.getDocumentAsync({
        type: ['text/comma-separated-values', 'text/csv', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true
      });

      if (doc.canceled || !doc.assets || doc.assets.length === 0) {
        return;
      }

      setImportingCsv(true);
      const uri = doc.assets[0].uri;
      const count = await CallingAppModule.importContactsCsv(uri, campaignId);
      Alert.alert('Import Complete', `Successfully imported ${count} unique contacts!`);
      await loadContacts();
    } catch (e) {
      Alert.alert('Error', 'Failed to parse CSV file');
    } finally {
      setImportingCsv(false);
    }
  };

  const handleAddManualContact = async () => {
    if (!campaignId) return;
    if (!contactName.trim() || !contactPhone.trim()) {
      Alert.alert('Error', 'Please fill in both name and phone number');
      return;
    }

    const cleanPhone = contactPhone.filter(c => c === '+' || (c >= '0' && c <= '9'));
    if (cleanPhone.length < 7 || cleanPhone.length > 15) {
      Alert.alert('Validation Error', 'Please enter a valid phone number (7 to 15 digits)');
      return;
    }

    const isDup = contacts.some(c => c.phoneNumber.filter(char => char === '+' || (char >= '0' && char <= '9')) === cleanPhone);
    if (isDup) {
      Alert.alert('Duplicate Contact', 'This phone number already exists in the campaign.');
      return;
    }

    try {
      setSubmittingContact(true);
      await CallingAppModule.addContact(campaignId, contactName.trim(), cleanPhone);
      setContactName('');
      setContactPhone('');
      setModalVisible(false);
      await loadContacts();
    } catch (e) {
      Alert.alert('Error', 'Failed to add contact');
    } finally {
      setSubmittingContact(false);
    }
  };

  const deleteContact = async (contactId: number) => {
    try {
      await CallingAppModule.deleteContact(contactId);
      await loadContacts();
    } catch (e) {
      Alert.alert('Error', 'Failed to delete contact');
    }
  };

  const handleCompleteSetup = () => {
    if (!campaignId) return;
    Alert.alert(
      'Setup Complete',
      'Your calling campaign is fully set up and ready to run!',
      [
        {
          text: 'Go to Campaign Dashboard',
          onPress: () => {
            router.replace({
              pathname: '/campaign/[id]',
              params: { id: campaignId.toString() }
            });
          }
        }
      ]
    );
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Step Renders ---
  const renderStep1 = () => (
    <GlassCard style={styles.formCard} borderColor="rgba(255, 255, 255, 0.08)" glow>
      <Text style={styles.stepTitleText}>Step 1: Campaign Configuration</Text>
      
      <Text style={styles.label}>Campaign Name</Text>
      <TextInput
        style={[styles.input, isNameFocused && styles.inputFocused]}
        placeholder="e.g. Diwali Promo, Customer Alert"
        placeholderTextColor="#6B7280"
        value={name}
        onChangeText={setName}
        maxLength={50}
        onFocus={() => setIsNameFocused(true)}
        onBlur={() => setIsNameFocused(false)}
      />

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Wait between calls (s)</Text>
          <TextInput
            style={[styles.input, isDelayFocused && styles.inputFocused]}
            keyboardType="numeric"
            value={delay}
            onChangeText={setDelay}
            maxLength={4}
            onFocus={() => setIsDelayFocused(true)}
            onBlur={() => setIsDelayFocused(false)}
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Retry Attempts</Text>
          <TextInput
            style={[styles.input, isRetryFocused && styles.inputFocused]}
            keyboardType="numeric"
            value={retry}
            onChangeText={setRetry}
            maxLength={2}
            onFocus={() => setIsRetryFocused(true)}
            onBlur={() => setIsRetryFocused(false)}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={handleProceedFromStep1} activeOpacity={0.8}>
        <Text style={styles.primaryBtnText}>Next: Voice Message</Text>
        <Ionicons name="arrow-forward" size={18} color="#000" />
      </TouchableOpacity>
    </GlassCard>
  );

  const renderStep2 = () => (
    <GlassCard style={styles.formCard} borderColor="rgba(255, 255, 255, 0.08)" glow>
      <Text style={styles.stepTitleText}>Step 2: Record Voice Message</Text>
      <Text style={styles.prompt}>
        Speak clearly into the microphone. This message will play automatically when the call is answered.
      </Text>

      {/* Timer */}
      <Text style={[styles.timer, isRecording && { color: '#FF5252' }]}>
        {formatDuration(recordDuration)}
      </Text>

      {/* Pulse Ring Indicator */}
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
            isRecording && styles.micBtnActive,
            tempFilePath !== null && styles.micBtnDone
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isRecording ? "stop" : tempFilePath ? "checkmark" : "mic"}
            size={40}
            color={isRecording ? "#FFF" : tempFilePath ? "#69F0AE" : "#00E5FF"}
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.micStatusText}>
        {isRecording ? "Recording... Tap to stop" : tempFilePath ? "Voice message ready!" : "Tap to start recording"}
      </Text>

      {/* Audio Playback Controls */}
      {tempFilePath && (
        <View style={styles.audioControlsRow}>
          <TouchableOpacity style={styles.audioPlayBtn} onPress={isPlaying ? stopAudio : playAudio}>
            <Ionicons name={isPlaying ? "square" : "play"} size={20} color="#000" />
            <Text style={styles.audioPlayBtnText}>{isPlaying ? "Stop" : "Listen"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.audioDiscardBtn} onPress={discardRecording}>
            <Ionicons name="trash-outline" size={20} color="#FF5252" />
            <Text style={styles.audioDiscardBtnText}>Discard</Text>
          </TouchableOpacity>
        </View>
      )}

      {savingAudio ? (
        <ActivityIndicator size="small" color="#00E5FF" style={{ marginVertical: 20 }} />
      ) : (
        <View style={styles.navigationRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleProceedFromStep2} activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>
              {tempFilePath ? "Next: Add Contacts" : "Skip Voice (TTS Only)"}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#00E5FF" />
          </TouchableOpacity>
        </View>
      )}
    </GlassCard>
  );

  const renderStep3 = () => (
    <GlassCard style={styles.formCard} borderColor="rgba(255, 255, 255, 0.08)" glow>
      <Text style={styles.stepTitleText}>Step 3: Add Contacts</Text>
      <Text style={styles.prompt}>
        Import your customer database via a CSV sheet, or add numbers manually.
      </Text>

      {/* Buttons */}
      <View style={styles.contactActionsRow}>
        <TouchableOpacity style={styles.csvImportBtn} onPress={handleImportCsv} disabled={importingCsv}>
          {importingCsv ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color="#000" />
              <Text style={styles.csvImportBtnText}>Import CSV List</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.manualAddBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={18} color="#00E5FF" />
          <Text style={styles.manualAddBtnText}>Add Manually</Text>
        </TouchableOpacity>
      </View>

      {/* Contacts List */}
      <Text style={styles.listHeaderTitle}>Added Contacts ({contacts.length})</Text>
      
      {contacts.length === 0 ? (
        <View style={styles.emptyContactsContainer}>
          <Ionicons name="people-outline" size={40} color="#4B5563" />
          <Text style={styles.emptyContactsText}>No contacts added to this campaign yet.</Text>
        </View>
      ) : (
        <View style={styles.contactsList}>
          {contacts.map((c) => (
            <View key={c.contactId} style={styles.contactItem}>
              <View>
                <Text style={styles.contactName}>{c.customerName}</Text>
                <Text style={styles.contactPhone}>{c.phoneNumber}</Text>
              </View>
              <TouchableOpacity style={styles.deleteContactBtn} onPress={() => deleteContact(c.contactId)}>
                <Ionicons name="close" size={18} color="#FF5252" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Complete Button */}
      <TouchableOpacity
        style={[styles.primaryBtn, contacts.length === 0 && styles.primaryBtnDisabled]}
        onPress={handleCompleteSetup}
        disabled={contacts.length === 0}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryBtnText}>Finish & Complete Setup</Text>
        <Ionicons name="checkmark-circle-outline" size={18} color="#000" />
      </TouchableOpacity>

      {/* Manual Contact Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBg}>
          <GlassCard style={styles.modalContent} borderColor="rgba(255, 255, 255, 0.1)">
            <Text style={styles.modalTitle}>Add Contact Manually</Text>
            
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. John Doe"
              placeholderTextColor="#6B7280"
              value={contactName}
              onChangeText={setContactName}
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. +919876543210"
              placeholderTextColor="#6B7280"
              keyboardType="phone-pad"
              value={contactPhone}
              onChangeText={setContactPhone}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddManualContact} disabled={submittingContact}>
                {submittingContact ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </GlassCard>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 1 ? 'New Campaign' : step === 2 ? 'Voice Setup' : 'Contacts Setup'}
        </Text>
      </View>

      {/* Progress / Step Indicator */}
      <View style={styles.stepIndicatorContainer}>
        <View style={styles.stepRow}>
          <View style={[styles.stepCircle, step >= 1 && styles.stepCircleActive]}>
            {step > 1 ? (
              <Ionicons name="checkmark" size={14} color="#000" />
            ) : (
              <Text style={[styles.stepCircleText, step >= 1 && styles.stepCircleTextActive]}>1</Text>
            )}
          </View>
          <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepCircle, step >= 2 && styles.stepCircleActive]}>
            {step > 2 ? (
              <Ionicons name="checkmark" size={14} color="#000" />
            ) : (
              <Text style={[styles.stepCircleText, step >= 2 && styles.stepCircleTextActive]}>2</Text>
            )}
          </View>
          <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />
          <View style={[styles.stepCircle, step >= 3 && styles.stepCircleActive]}>
            <Text style={[styles.stepCircleText, step >= 3 && styles.stepCircleTextActive]}>3</Text>
          </View>
        </View>
        <View style={styles.stepLabelRow}>
          <Text style={[styles.stepLabel, step >= 1 && styles.stepLabelActive]}>Configure</Text>
          <Text style={[styles.stepLabel, step >= 2 && styles.stepLabelActive]}>Voice Message</Text>
          <Text style={[styles.stepLabel, step >= 3 && styles.stepLabelActive]}>Contacts</Text>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </ScrollView>
    </SafeAreaView>
  );
}

// Add string extension method to filter digits
declare global {
  interface String {
    filter(callback: (char: string) => boolean): string;
  }
}
if (!String.prototype.filter) {
  String.prototype.filter = function (callback: (char: string) => boolean): string {
    let result = '';
    for (let i = 0; i < this.length; i++) {
      const char = this.charAt(i);
      if (callback(char)) {
        result += char;
      }
    }
    return result;
  };
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  container: {
    padding: 16,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
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
  // Step indicator
  stepIndicatorContainer: {
    paddingHorizontal: 32,
    marginBottom: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  stepCircleActive: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  stepCircleText: {
    color: '#6B7280',
    fontWeight: '700',
    fontSize: 12,
  },
  stepCircleTextActive: {
    color: '#000',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#1F2937',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#00E5FF',
  },
  stepLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  stepLabel: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    width: 80,
  },
  stepLabelActive: {
    color: '#FFF',
  },
  // Form card
  formCard: {
    backgroundColor: '#111827',
    padding: 20,
    borderRadius: 24,
  },
  stepTitleText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1F2937',
    color: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  inputFocused: {
    borderColor: '#00E5FF',
    backgroundColor: '#112233',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  col: {
    flex: 1,
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 10,
    elevation: 3,
    shadowColor: '#00E5FF',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryBtnDisabled: {
    backgroundColor: '#1F2937',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
  },
  // Step 2 specific styles
  prompt: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 24,
  },
  timer: {
    color: '#B0B4BA',
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    marginBottom: 24,
  },
  micContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    marginBottom: 16,
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00E5FF',
    elevation: 4,
    shadowColor: '#00E5FF',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 10,
  },
  micBtnActive: {
    backgroundColor: '#FF5252',
    borderColor: '#FF5252',
    shadowColor: '#FF5252',
  },
  micBtnDone: {
    borderColor: '#69F0AE',
  },
  pulseRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FF5252',
    zIndex: 1,
  },
  micStatusText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  audioControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  audioPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  audioPlayBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  audioDiscardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FF5252',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  audioDiscardBtnText: {
    color: '#FF5252',
    fontWeight: '700',
    fontSize: 14,
  },
  navigationRow: {
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 6,
  },
  secondaryBtnText: {
    color: '#00E5FF',
    fontWeight: '700',
    fontSize: 14,
  },
  // Step 3 specific styles
  contactActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  csvImportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E5FF',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  csvImportBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  manualAddBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  manualAddBtnText: {
    color: '#00E5FF',
    fontWeight: '700',
    fontSize: 14,
  },
  listHeaderTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyContactsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.02)',
  },
  emptyContactsText: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  contactsList: {
    marginBottom: 24,
    maxHeight: 280,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.02)',
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  contactName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  contactPhone: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  deleteContactBtn: {
    padding: 6,
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    borderRadius: 8,
  },
  // Modal layout
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#111827',
    padding: 20,
    borderRadius: 20,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#1F2937',
    color: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalCancelBtnText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: '#00E5FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalSaveBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
});
