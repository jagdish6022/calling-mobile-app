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
  Platform,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import CallingAppModule, { Settings, Campaign, Contact } from '@/modules/calling-app-module/src/CallingAppModule';
import GlassCard from '@/components/GlassCard';

export default function NewCampaignScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const pad = isTablet ? 32 : 16;

  // Wizard State
  const [step, setStep] = useState(1);
  const [campaignId, setCampaignId] = useState<number | null>(null);

  // Step 1
  const [name, setName] = useState('');
  const [delay, setDelay] = useState('10');
  const [retry, setRetry] = useState('2');
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isDelayFocused, setIsDelayFocused] = useState(false);
  const [isRetryFocused, setIsRetryFocused] = useState(false);

  // Step 2
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [tempFilePath, setTempFilePath] = useState<string | null>(null);
  const [savingAudio, setSavingAudio] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationTimer = useRef<any>(null);

  // Step 3
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submittingContact, setSubmittingContact] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);

  useEffect(() => {
    const sub = CallingAppModule.addListener('onAudioPlaybackFinished', () => { setIsPlaying(false); });
    return () => { sub.remove(); };
  }, []);

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
      durationTimer.current = setInterval(() => { setRecordDuration((prev) => prev + 1); }, 1000);
    } else {
      if (durationTimer.current) clearInterval(durationTimer.current);
    }
    return () => { if (durationTimer.current) clearInterval(durationTimer.current); };
  }, [isRecording]);

  // --- Step 1 ---
  const handleProceedFromStep1 = async () => {
    if (!name.trim()) { Alert.alert('Campaign Name Required', 'Please enter a name for this campaign.'); return; }
    const delayVal = parseInt(delay);
    const retryVal = parseInt(retry);
    if (isNaN(delayVal) || delayVal < 0) { Alert.alert('Invalid Wait Time', 'Please enter a valid number of seconds (e.g. 10).'); return; }
    if (isNaN(retryVal) || retryVal < 0) { Alert.alert('Invalid Redial Count', 'Please enter a valid number (e.g. 2).'); return; }

    try {
      if (campaignId) { setStep(2); return; }
      const campaign = await CallingAppModule.createCampaign(name.trim(), delayVal, retryVal);
      setCampaignId(campaign.campaignId);
      setStep(2);
    } catch (e) {
      Alert.alert('Error', 'Could not create campaign. Please try again.');
    }
  };

  // --- Step 2 Recording ---
  const startRecording = async () => {
    if (!campaignId) return;
    try {
      if (isPlaying) await stopAudio();
      const perms = await CallingAppModule.checkPermissions();
      if (!perms.RECORD_AUDIO) {
        const requested = await CallingAppModule.requestPermissions();
        if (!requested) { Alert.alert('Microphone Access Needed', 'Please allow microphone access to record.'); return; }
        const checkAgain = await CallingAppModule.checkPermissions();
        if (!checkAgain.RECORD_AUDIO) { Alert.alert('Microphone Access Needed', 'Please enable it in Settings and try again.'); return; }
      }
      setRecordDuration(0);
      setTempFilePath(null);
      await CallingAppModule.startRecording(campaignId);
      setIsRecording(true);
    } catch (e) {
      Alert.alert('Could Not Start Recording', 'Make sure microphone permission is allowed.');
    }
  };

  const stopRecording = async () => {
    try {
      const path = await CallingAppModule.stopRecording();
      setIsRecording(false);
      setTempFilePath(path);
    } catch (e) {
      Alert.alert('Error', 'Could not stop recording.'); setIsRecording(false);
    }
  };

  const playAudio = async () => {
    if (!tempFilePath) return;
    try {
      setIsPlaying(true);
      const success = await CallingAppModule.playAudio(tempFilePath);
      if (!success) { setIsPlaying(false); Alert.alert('Error', 'Could not play the recording.'); }
    } catch (e) { setIsPlaying(false); }
  };

  const stopAudio = async () => {
    try { await CallingAppModule.stopAudio(); } catch (e) { console.error(e); } finally { setIsPlaying(false); }
  };

  const discardRecording = async () => {
    if (!tempFilePath) return;
    Alert.alert('Discard Recording', 'Delete this recording and start over?', [
      { text: 'Keep It', style: 'cancel' },
      { text: 'Yes, Discard', style: 'destructive', onPress: async () => { await CallingAppModule.deleteAudio(tempFilePath); setTempFilePath(null); setRecordDuration(0); } }
    ]);
  };

  const handleProceedFromStep2 = async () => {
    if (!campaignId) return;
    try {
      setSavingAudio(true);
      if (tempFilePath) { await CallingAppModule.updateCampaignAudio(campaignId, tempFilePath); }
      const list = await CallingAppModule.getContacts(campaignId);
      setContacts(list);
      setStep(3);
    } catch (e) {
      Alert.alert('Error', 'Could not save voice message.');
    } finally {
      setSavingAudio(false);
    }
  };

  // --- Step 3 Contacts ---
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
      if (doc.canceled || !doc.assets || doc.assets.length === 0) return;
      setImportingCsv(true);
      const uri = doc.assets[0].uri;
      const count = await CallingAppModule.importContactsCsv(uri, campaignId);
      Alert.alert('Import Complete ✅', `${count} contacts added successfully!`);
      await loadContacts();
    } catch (e) {
      Alert.alert('Import Failed', 'Could not read the file. Make sure it is a valid CSV.');
    } finally {
      setImportingCsv(false);
    }
  };

  const handleAddManualContact = async () => {
    if (!campaignId) return;
    if (!contactName.trim() || !contactPhone.trim()) { Alert.alert('Missing Info', 'Please enter both a name and a phone number.'); return; }
    const cleanPhone = contactPhone.replace(/\D/g, '');
    if (cleanPhone.length < 7 || cleanPhone.length > 15) { Alert.alert('Invalid Phone', 'Please enter a valid phone number (7–15 digits).'); return; }
    const isDup = contacts.some(c => c.phoneNumber.replace(/\D/g, '') === cleanPhone);
    if (isDup) { Alert.alert('Already Added', 'This phone number is already in the list.'); return; }

    try {
      setSubmittingContact(true);
      await CallingAppModule.addContact(campaignId, contactName.trim(), cleanPhone);
      setContactName(''); setContactPhone(''); setModalVisible(false);
      await loadContacts();
    } catch (e) {
      Alert.alert('Error', 'Could not add contact.');
    } finally {
      setSubmittingContact(false);
    }
  };

  const deleteContact = async (contactId: number) => {
    try { await CallingAppModule.deleteContact(contactId); await loadContacts(); }
    catch (e) { Alert.alert('Error', 'Could not remove contact.'); }
  };

  const handleCompleteSetup = () => {
    if (!campaignId) return;
    Alert.alert(
      '🎉 Campaign Ready!',
      'Your campaign is set up and ready to run. Go to the campaign dashboard to start calling.',
      [{ text: 'Go to Campaign', onPress: () => router.replace({ pathname: '/campaign/[id]', params: { id: campaignId.toString() } }) }]
    );
  };

  const handleBack = () => { if (step > 1) setStep(step - 1); else router.back(); };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const micSize = isTablet ? 110 : 90;
  const pulseSize = isTablet ? 150 : 120;

  // ---- Step Renderers ----

  const renderStep1 = () => (
    <GlassCard style={styles.formCard}>
      <Text style={styles.stepTitleText}>Step 1 of 3 — Campaign Setup</Text>
      <Text style={styles.stepDescription}>Give your campaign a name and set your calling preferences.</Text>

      <Text style={styles.label}>Campaign Name *</Text>
      <TextInput
        style={[styles.input, isNameFocused && styles.inputFocused]}
        placeholder="e.g. Diwali Offer, Customer Follow-Up"
        placeholderTextColor="#6B7280"
        value={name}
        onChangeText={setName}
        maxLength={50}
        onFocus={() => setIsNameFocused(true)}
        onBlur={() => setIsNameFocused(false)}
      />

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>⏱  Pause Between Calls</Text>
          <Text style={styles.inputHelper}>Seconds to wait between each call</Text>
          <View style={styles.inputRowCompact}>
            <TextInput
              style={[styles.input, styles.inputNumeric, isDelayFocused && styles.inputFocused]}
              keyboardType="numeric"
              value={delay}
              onChangeText={setDelay}
              maxLength={4}
              onFocus={() => setIsDelayFocused(true)}
              onBlur={() => setIsDelayFocused(false)}
            />
            <Text style={styles.unitText}>sec</Text>
          </View>
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>🔁  Redial if No Answer</Text>
          <Text style={styles.inputHelper}>Extra attempts if no pickup</Text>
          <View style={styles.inputRowCompact}>
            <TextInput
              style={[styles.input, styles.inputNumeric, isRetryFocused && styles.inputFocused]}
              keyboardType="numeric"
              value={retry}
              onChangeText={setRetry}
              maxLength={2}
              onFocus={() => setIsRetryFocused(true)}
              onBlur={() => setIsRetryFocused(false)}
            />
            <Text style={styles.unitText}>times</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={handleProceedFromStep1} activeOpacity={0.8}>
        <Text style={styles.primaryBtnText}>Continue to Voice Recording</Text>
        <Ionicons name="arrow-forward" size={20} color="#000" />
      </TouchableOpacity>
    </GlassCard>
  );

  const renderStep2 = () => (
    <GlassCard style={styles.formCard}>
      <Text style={styles.stepTitleText}>Step 2 of 3 — Voice Message</Text>
      <Text style={styles.stepDescription}>
        Record the message that will play when someone answers your call. You can also skip this and use only the automatic name greeting.
      </Text>

      {/* Timer */}
      <Text style={[styles.timer, isRecording && { color: '#FF5252' }]}>
        {formatDuration(recordDuration)}
      </Text>

      {/* Mic Button */}
      <View style={[styles.micContainer, { height: pulseSize + 60 }]}>
        {isRecording && (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                width: pulseSize, height: pulseSize, borderRadius: pulseSize / 2,
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
            isRecording && styles.micBtnActive,
            tempFilePath !== null && styles.micBtnDone
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isRecording ? 'stop' : tempFilePath ? 'checkmark' : 'mic'}
            size={isTablet ? 48 : 40}
            color={isRecording ? '#FFF' : tempFilePath ? '#69F0AE' : '#00E5FF'}
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.micStatusText}>
        {isRecording ? '🔴 Recording... tap to stop' : tempFilePath ? '✅ Voice message recorded!' : 'Tap the microphone to start'}
      </Text>

      {tempFilePath && (
        <View style={styles.audioControlsRow}>
          <TouchableOpacity style={styles.audioPlayBtn} onPress={isPlaying ? stopAudio : playAudio}>
            <Ionicons name={isPlaying ? 'square' : 'play'} size={20} color="#000" />
            <Text style={styles.audioPlayBtnText}>{isPlaying ? 'Stop' : 'Listen Back'}</Text>
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
        <TouchableOpacity style={styles.primaryBtn} onPress={handleProceedFromStep2} activeOpacity={0.8}>
          <Text style={styles.primaryBtnText}>
            {tempFilePath ? 'Save & Add Contacts' : 'Skip — Use Name Greeting Only'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#000" />
        </TouchableOpacity>
      )}
    </GlassCard>
  );

  const renderStep3 = () => (
    <GlassCard style={styles.formCard}>
      <Text style={styles.stepTitleText}>Step 3 of 3 — Add Contacts</Text>
      <Text style={styles.stepDescription}>
        Upload a CSV file with your contact list, or add people one by one.
      </Text>

      {/* Import / Add buttons */}
      <View style={styles.contactActionsRow}>
        <TouchableOpacity style={styles.csvImportBtn} onPress={handleImportCsv} disabled={importingCsv}>
          {importingCsv ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color="#000" />
              <Text style={styles.csvImportBtnText}>Upload CSV File</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.manualAddBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="person-add-outline" size={20} color="#00E5FF" />
          <Text style={styles.manualAddBtnText}>Add One Person</Text>
        </TouchableOpacity>
      </View>

      {/* Contact Count */}
      <Text style={styles.listHeaderTitle}>
        {contacts.length === 0 ? 'No contacts added yet' : `${contacts.length} contact${contacts.length > 1 ? 's' : ''} added`}
      </Text>

      {contacts.length === 0 ? (
        <View style={styles.emptyContactsContainer}>
          <Ionicons name="people-outline" size={44} color="#374151" />
          <Text style={styles.emptyContactsText}>
            Add at least one contact to start calling.
          </Text>
        </View>
      ) : (
        <View style={styles.contactsList}>
          {contacts.map((c) => (
            <View key={c.contactId} style={styles.contactItem}>
              <View style={{ flex: 1 }}>
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

      <TouchableOpacity
        style={[styles.primaryBtn, contacts.length === 0 && styles.primaryBtnDisabled]}
        onPress={handleCompleteSetup}
        disabled={contacts.length === 0}
        activeOpacity={0.8}
      >
        <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
        <Text style={styles.primaryBtnText}>Finish Setup & Go to Campaign</Text>
      </TouchableOpacity>

      {/* Add Contact Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBg}>
          <GlassCard style={[styles.modalContent, isTablet && { maxWidth: 480, alignSelf: 'center', width: '100%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add a Contact</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Raj Patel"
              placeholderTextColor="#6B7280"
              value={contactName}
              onChangeText={setContactName}
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 9876543210"
              placeholderTextColor="#6B7280"
              keyboardType="phone-pad"
              value={contactPhone}
              onChangeText={setContactPhone}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setContactName(''); setContactPhone(''); setModalVisible(false); }}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddManualContact} disabled={submittingContact}>
                {submittingContact ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Add Contact</Text>
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
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isTablet && { fontSize: 26 }]}>
          {step === 1 ? 'New Campaign' : step === 2 ? 'Record Voice Message' : 'Add Contacts'}
        </Text>
      </View>

      {/* Step Progress Indicator */}
      <View style={[styles.stepIndicatorContainer, { paddingHorizontal: pad + 8 }]}>
        <View style={styles.stepRow}>
          {[1, 2, 3].map((s, idx) => (
            <React.Fragment key={s}>
              <View style={[styles.stepCircle, step >= s && styles.stepCircleActive]}>
                {step > s ? (
                  <Ionicons name="checkmark" size={14} color="#000" />
                ) : (
                  <Text style={[styles.stepCircleText, step >= s && styles.stepCircleTextActive]}>{s}</Text>
                )}
              </View>
              {idx < 2 && <View style={[styles.stepLine, step > s && styles.stepLineActive]} />}
            </React.Fragment>
          ))}
        </View>
        <View style={styles.stepLabelRow}>
          {['Set Up', 'Voice Message', 'Contacts'].map((label, idx) => (
            <Text key={idx} style={[styles.stepLabel, step >= idx + 1 && styles.stepLabelActive]}>{label}</Text>
          ))}
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        contentContainerStyle={[styles.container, { padding: pad, paddingBottom: 60 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={isTablet ? styles.tabletInner : undefined}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Add string filter extension (used for phone cleanup)
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
      if (callback(char)) result += char;
    }
    return result;
  };
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0A0A0C' },
  container: {},
  tabletInner: { maxWidth: 640, alignSelf: 'center', width: '100%' },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 10, gap: 12 },
  backBtn: { padding: 10, backgroundColor: '#1F2937', borderRadius: 12 },
  headerTitle: { color: '#FFF', fontSize: 24, fontWeight: '800' },

  stepIndicatorContainer: { marginBottom: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#1F2937',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  stepCircleActive: { backgroundColor: '#00E5FF', borderColor: '#00E5FF' },
  stepCircleText: { color: '#6B7280', fontWeight: '700', fontSize: 13 },
  stepCircleTextActive: { color: '#000' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#1F2937', marginHorizontal: 8 },
  stepLineActive: { backgroundColor: '#00E5FF' },
  stepLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  stepLabel: { color: '#4B5563', fontSize: 11, fontWeight: '700', textAlign: 'center', width: 90 },
  stepLabelActive: { color: '#FFF' },

  formCard: { backgroundColor: '#111827', padding: 22, borderRadius: 24 },
  stepTitleText: { color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  stepDescription: { color: '#9CA3AF', fontSize: 13, lineHeight: 20, marginBottom: 20 },

  label: { color: '#9CA3AF', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  inputHelper: { color: '#6B7280', fontSize: 11, marginBottom: 8 },
  input: {
    backgroundColor: '#1F2937', color: '#FFF', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  inputFocused: { borderColor: '#00E5FF', backgroundColor: '#112233' },
  inputNumeric: { width: 80, marginBottom: 0, textAlign: 'center' },
  inputRowCompact: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  unitText: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },

  primaryBtn: {
    flexDirection: 'row', backgroundColor: '#00E5FF', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 14, gap: 10, marginTop: 8, elevation: 3,
    shadowColor: '#00E5FF', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  primaryBtnDisabled: { backgroundColor: '#1F2937', shadowOpacity: 0, elevation: 0 },
  primaryBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },

  // Step 2
  timer: {
    color: '#B0B4BA', fontSize: 50, fontWeight: '800', textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', marginBottom: 20,
  },
  micContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  micBtn: {
    backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#00E5FF', elevation: 4,
    shadowColor: '#00E5FF', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, zIndex: 10,
  },
  micBtnActive: { backgroundColor: '#FF5252', borderColor: '#FF5252', shadowColor: '#FF5252' },
  micBtnDone: { borderColor: '#69F0AE' },
  pulseRing: { position: 'absolute', backgroundColor: '#FF5252', zIndex: 1 },
  micStatusText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
  audioControlsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20 },
  audioPlayBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#00E5FF',
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, gap: 8,
  },
  audioPlayBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  audioDiscardBtn: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#FF5252',
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, gap: 8,
  },
  audioDiscardBtnText: { color: '#FF5252', fontWeight: '700', fontSize: 14 },

  // Step 3
  contactActionsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  csvImportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00E5FF', paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  csvImportBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  manualAddBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#00E5FF', paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  manualAddBtnText: { color: '#00E5FF', fontWeight: '700', fontSize: 14 },
  listHeaderTitle: { color: '#FFF', fontSize: 15, fontWeight: '800', marginBottom: 12 },
  emptyContactsContainer: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 36,
    backgroundColor: '#1F2937', borderRadius: 16, marginBottom: 20, gap: 10,
  },
  emptyContactsText: { color: '#6B7280', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
  contactsList: {
    marginBottom: 20, maxHeight: 280, backgroundColor: '#1F2937',
    borderRadius: 16, padding: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.02)',
  },
  contactItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  contactName: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  contactPhone: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  deleteContactBtn: { padding: 8, backgroundColor: 'rgba(255,82,82,0.1)', borderRadius: 8 },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', backgroundColor: '#111827', padding: 22 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  modalInput: {
    backgroundColor: '#1F2937', color: '#FFF', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalCancelBtn: { paddingHorizontal: 20, paddingVertical: 12 },
  modalCancelBtnText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  modalSaveBtn: { backgroundColor: '#00E5FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  modalSaveBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
});
