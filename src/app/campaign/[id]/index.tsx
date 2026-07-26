import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CallingAppModule, { Campaign, Contact } from '@/modules/calling-app-module/src/CallingAppModule';
import GlassCard from '@/components/GlassCard';
import StatusBadge from '@/components/StatusBadge';

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const campaignId = id ? parseInt(id as string) : NaN;

  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const pad = isTablet ? 32 : 16;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const sub = CallingAppModule.addListener('onAudioPlaybackFinished', () => {
      setIsPlaying(false);
    });
    return () => { sub.remove(); };
  }, []);

  const loadData = async () => {
    if (isNaN(campaignId)) return;
    try {
      const camp = await CallingAppModule.getCampaign(campaignId);
      setCampaign(camp);
      if (camp) {
        const contactList = await CallingAppModule.getContacts(campaignId);
        setContacts(contactList);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not load campaign details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => { if (!isNaN(campaignId)) { loadData(); } }, [campaignId])
  );

  useEffect(() => {
    let timer: any;
    if (campaign && campaign.status === 'RUNNING') {
      timer = setInterval(async () => {
        try {
          const camp = await CallingAppModule.getCampaign(campaignId);
          setCampaign(camp);
          if (camp) {
            const contactList = await CallingAppModule.getContacts(campaignId);
            setContacts(contactList);
          }
        } catch (e) { console.error(e); }
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [campaign]);

  const handleStart = async () => {
    if (!campaign) return;

    // Check permissions first
    try {
      const perms = await CallingAppModule.checkPermissions();
      if (!perms.CALL_PHONE || !perms.READ_PHONE_STATE) {
        const granted = await CallingAppModule.requestPermissions();
        if (!granted) {
          Alert.alert(
            'Permissions Required',
            'This app needs permission to make phone calls. Please grant the permissions and try again.',
            [{ text: 'OK' }]
          );
          return;
        }
        const permsAfter = await CallingAppModule.checkPermissions();
        if (!permsAfter.CALL_PHONE || !permsAfter.READ_PHONE_STATE) {
          Alert.alert(
            'Permissions Required',
            'Phone permissions are still not granted. Please allow them in your phone Settings app.',
            [{ text: 'OK' }]
          );
          return;
        }
      }
    } catch (permErr) { console.error('Permission check error:', permErr); }

    if (contacts.length === 0) {
      Alert.alert('No Contacts', 'Please add contacts to this campaign before starting.');
      return;
    }

    if (!campaign.audioFilePath) {
      Alert.alert(
        'No Voice Message',
        'You haven\'t recorded a voice message yet. Do you want to start calling with only the automated name greeting (e.g. "Hello John")?',
        [
          { text: 'Record First', onPress: () => router.push({ pathname: '/campaign/[id]/record', params: { id: campaignId.toString() } }), style: 'cancel' },
          { text: 'Start Anyway', onPress: () => triggerStart() }
        ]
      );
      return;
    }

    triggerStart();
  };

  const triggerStart = async () => {
    try {
      await CallingAppModule.updateCampaignStatus(campaignId, 'RUNNING');
      await CallingAppModule.startCampaign(campaignId);
      loadData();
    } catch (e) {
      try { await CallingAppModule.updateCampaignStatus(campaignId, 'DRAFT'); } catch (_) {}
      Alert.alert('Could Not Start', 'Something went wrong starting the campaign. Please check permissions and try again.');
    }
  };

  const handlePause = async () => {
    try {
      await CallingAppModule.pauseCampaign(campaignId);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Could not pause calling.');
    }
  };

  const handleStop = async () => {
    Alert.alert(
      'Stop Campaign',
      'Are you sure you want to end this campaign? You can restart it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Stop', style: 'destructive', onPress: async () => {
          try { await CallingAppModule.stopCampaign(campaignId); loadData(); }
          catch (e) { Alert.alert('Error', 'Could not stop campaign.'); }
        }}
      ]
    );
  };

  const handleReset = async () => {
    Alert.alert(
      'Reset Contacts',
      'This will mark all contacts as "Uncalled" so the campaign can be run again from the beginning. Your call history will be kept. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              setLoading(true);
              await CallingAppModule.resetCampaignContacts(campaignId);
              loadData();
            } catch (err) {
              Alert.alert('Error', 'Could not reset contacts.');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const playAudio = async () => {
    if (!campaign?.audioFilePath) return;
    try { setIsPlaying(true); await CallingAppModule.playAudio(campaign.audioFilePath); }
    catch (e) { setIsPlaying(false); }
  };

  const stopAudio = async () => {
    try { await CallingAppModule.stopAudio(); }
    catch (e) { console.error(e); }
    finally { setIsPlaying(false); }
  };

  const deleteAudio = async () => {
    if (!campaign?.audioFilePath) return;
    Alert.alert('Delete Voice Message', 'Are you sure you want to delete this recording?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await CallingAppModule.deleteAudio(campaign.audioFilePath);
          await CallingAppModule.updateCampaignAudio(campaignId, null);
          loadData();
        }
      }
    ]);
  };

  if (loading || !campaign) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text style={styles.loadingText}>Loading campaign...</Text>
      </View>
    );
  }

  const total = contacts.length;
  const completed = contacts.filter((c) => c.status === 'COMPLETED').length;
  const busy = contacts.filter((c) => c.status === 'BUSY' || c.status === 'NO_ANSWER').length;
  const failed = contacts.filter((c) => c.status === 'FAILED' || c.status === 'REJECTED').length;
  const dialing = contacts.filter((c) => c.status === 'DIALING').length;
  const pending = contacts.filter((c) => c.status === 'PENDING').length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const hasVoiceMessage = !!campaign.audioFilePath;
  const hasContacts = total > 0;
  const isRunning = campaign.status === 'RUNNING';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.container, { padding: pad, paddingBottom: 100 }]}>
        <View style={isTablet ? styles.tabletInner : undefined}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, isTablet && { fontSize: 28 }]} numberOfLines={2}>
                {campaign.campaignName}
              </Text>
              <Text style={styles.headerSub}>Campaign Details</Text>
            </View>
          </View>

          {/* Setup Checklist (only when not running) */}
          {!isRunning && (
            <GlassCard style={styles.checklistCard}>
              <Text style={styles.checklistTitle}>📋 Before You Start</Text>

              <View style={styles.checkItem}>
                <Ionicons name={hasVoiceMessage ? 'checkmark-circle' : 'close-circle'} size={24} color={hasVoiceMessage ? '#69F0AE' : '#FF5252'} />
                <View style={styles.checkTextCol}>
                  <Text style={[styles.checkLabel, hasVoiceMessage && styles.checkCompleted]}>
                    {hasVoiceMessage ? 'Voice message recorded ✓' : 'Record your voice message'}
                  </Text>
                  {!hasVoiceMessage && (
                    <TouchableOpacity onPress={() => router.push({ pathname: '/campaign/[id]/record', params: { id: campaignId.toString() } })}>
                      <Text style={styles.checkActionText}>→ Tap to record a voice message</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.checkItem}>
                <Ionicons name={hasContacts ? 'checkmark-circle' : 'close-circle'} size={24} color={hasContacts ? '#69F0AE' : '#FF5252'} />
                <View style={styles.checkTextCol}>
                  <Text style={[styles.checkLabel, hasContacts && styles.checkCompleted]}>
                    {hasContacts ? `${total} contacts added ✓` : 'Add contacts to call'}
                  </Text>
                  {!hasContacts && (
                    <TouchableOpacity onPress={() => router.push({ pathname: '/campaign/[id]/contacts', params: { id: campaignId.toString() } })}>
                      <Text style={styles.checkActionText}>→ Tap to import your contact list</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.checkItem}>
                <Ionicons name="alert-circle" size={24} color="#FFA000" />
                <View style={styles.checkTextCol}>
                  <Text style={styles.checkLabelWarning}>Keep phone volume at maximum</Text>
                  <Text style={styles.checkSub}>
                    The message plays over speakerphone, so high volume ensures the other person hears it clearly.
                  </Text>
                </View>
              </View>
            </GlassCard>
          )}

          {/* Campaign Control Card */}
          <GlassCard style={styles.controlCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>STATUS</Text>
              <StatusBadge status={isRunning ? 'DIALING' : campaign.status} />
            </View>

            {isRunning ? (
              <View style={[styles.actionRow, isTablet && { gap: 16 }]}>
                <TouchableOpacity style={styles.pauseBtn} onPress={handlePause}>
                  <Ionicons name="pause" size={22} color="#00E5FF" />
                  <Text style={styles.pauseBtnText}>Pause</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
                  <Ionicons name="stop" size={22} color="#FF5252" />
                  <Text style={styles.stopBtnText}>Stop Campaign</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.startBtn, !hasContacts && styles.startBtnDisabled]}
                onPress={handleStart}
                disabled={!hasContacts}
              >
                <Ionicons name="play" size={24} color="#000" />
                <Text style={styles.startBtnText}>
                  {campaign.status === 'PAUSED' ? '▶  Resume Calling' : '▶  Start Automatic Calling'}
                </Text>
              </TouchableOpacity>
            )}

            {total > 0 && (
              <View style={styles.progressContainer}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabelText}>Calling Progress</Text>
                  <Text style={styles.progressPercent}>{progressPercent}% done</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                </View>
              </View>
            )}

            {!isRunning && total > 0 && (
              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <Ionicons name="refresh" size={16} color="#9CA3AF" />
                <Text style={styles.resetBtnText}>Reset — Call Everyone Again from Start</Text>
              </TouchableOpacity>
            )}
          </GlassCard>

          {/* Voice Message Section */}
          <Text style={styles.sectionTitle}>Voice Message</Text>
          <GlassCard style={styles.audioCard}>
            {campaign.audioFilePath ? (
              <View style={styles.audioInfoRow}>
                <View style={styles.audioLabelCol}>
                  <Ionicons name="musical-notes-outline" size={24} color="#00E5FF" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.audioLabel}>Recording Ready ✓</Text>
                    <Text style={styles.audioSub} numberOfLines={1}>
                      {campaign.audioFilePath.split('/').pop()}
                    </Text>
                  </View>
                </View>
                <View style={styles.audioActions}>
                  {isPlaying ? (
                    <TouchableOpacity style={styles.audioBtn} onPress={stopAudio}>
                      <Ionicons name="square" size={18} color="#FF5252" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.audioBtn} onPress={playAudio}>
                      <Ionicons name="play" size={18} color="#00E5FF" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.audioBtnDelete} onPress={deleteAudio}>
                    <Ionicons name="trash-outline" size={18} color="#FF5252" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.audioBtnRerecord}
                    onPress={() => router.push({ pathname: '/campaign/[id]/record', params: { id: campaignId.toString() } })}
                  >
                    <Ionicons name="refresh" size={18} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.noAudioRow}>
                <Text style={styles.noAudioText}>No voice message recorded yet.</Text>
                <TouchableOpacity
                  style={styles.recordBtn}
                  onPress={() => router.push({ pathname: '/campaign/[id]/record', params: { id: campaignId.toString() } })}
                >
                  <Ionicons name="mic" size={18} color="#000" />
                  <Text style={styles.recordBtnText}>Record Now</Text>
                </TouchableOpacity>
              </View>
            )}
          </GlassCard>

          {/* Contacts Summary */}
          <View style={styles.contactsHeader}>
            <Text style={styles.sectionTitle}>Contacts ({total})</Text>
            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() => router.push({ pathname: '/campaign/[id]/contacts', params: { id: campaignId.toString() } })}
            >
              <Ionicons name="people-outline" size={16} color="#00E5FF" />
              <Text style={styles.manageBtnText}>Manage Contacts</Text>
            </TouchableOpacity>
          </View>

          <GlassCard style={styles.summaryCard}>
            <View style={[styles.summaryGrid, isTablet && { gap: 12 }]}>
              {[
                { val: pending, label: 'Waiting', color: '#FFF' },
                { val: dialing, label: 'Dialing', color: '#40C4FF' },
                { val: completed, label: 'Delivered', color: '#69F0AE' },
                { val: busy, label: 'Busy', color: '#FFAB40' },
                { val: failed, label: 'Failed', color: '#FF5252' },
              ].map((item, idx) => (
                <View key={idx} style={styles.summaryItem}>
                  <Text style={[styles.summaryVal, { color: item.color }]}>{item.val}</Text>
                  <Text style={styles.summaryLbl}>{item.label}</Text>
                </View>
              ))}
            </View>

            {total === 0 && (
              <TouchableOpacity
                style={styles.emptyContactsBtn}
                onPress={() => router.push({ pathname: '/campaign/[id]/contacts', params: { id: campaignId.toString() } })}
              >
                <Ionicons name="cloud-upload-outline" size={26} color="#00E5FF" />
                <Text style={styles.emptyContactsText}>Upload Contact List (CSV / Excel)</Text>
              </TouchableOpacity>
            )}
          </GlassCard>

          {/* How it works info */}
          <GlassCard style={styles.warningCard}>
            <Text style={styles.warningTitle}>💡 How does the calling work?</Text>
            <Text style={styles.warningText}>
              The app will open your phone dialer and automatically call each person one by one.
            </Text>
            <Text style={styles.warningText}>
              After about 6 seconds (to allow the call to connect), it will say the person's name and then play your recorded message over the speakerphone.
            </Text>
          </GlassCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0A0A0C' },
  centerContainer: { flex: 1, backgroundColor: '#0A0A0C', justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#9CA3AF', fontSize: 14 },
  container: {},
  tabletInner: { maxWidth: 860, alignSelf: 'center', width: '100%' },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 10, gap: 12 },
  backBtn: { padding: 10, backgroundColor: '#1F2937', borderRadius: 12 },
  headerTitle: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  headerSub: { color: '#00E5FF', fontSize: 12, fontWeight: '600', marginTop: 2 },

  checklistCard: {
    backgroundColor: '#161922', borderColor: 'rgba(255,171,64,0.3)',
    borderLeftWidth: 3, borderLeftColor: '#FFAB40', marginBottom: 20, gap: 14,
  },
  checklistTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  checkItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkTextCol: { flex: 1 },
  checkLabel: { color: '#E5E7EB', fontSize: 14, fontWeight: '700' },
  checkCompleted: { color: '#6B7280', textDecorationLine: 'line-through' },
  checkLabelWarning: { color: '#FFB74D', fontSize: 14, fontWeight: '700' },
  checkActionText: { color: '#00E5FF', fontSize: 13, fontWeight: '700', marginTop: 4 },
  checkSub: { color: '#9CA3AF', fontSize: 12, lineHeight: 16, marginTop: 4 },

  controlCard: { backgroundColor: '#111827', marginBottom: 24 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  startBtn: {
    flexDirection: 'row', backgroundColor: '#00E5FF', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 14, gap: 10, elevation: 3,
    shadowColor: '#00E5FF', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    marginBottom: 16,
  },
  startBtnDisabled: { backgroundColor: '#374151', shadowOpacity: 0, elevation: 0 },
  startBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  pauseBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#00E5FF', paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  pauseBtnText: { color: '#00E5FF', fontWeight: '700', fontSize: 15 },
  stopBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#FF5252', paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  stopBtnText: { color: '#FF5252', fontWeight: '700', fontSize: 15 },

  progressContainer: { marginTop: 8, marginBottom: 12 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabelText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  progressPercent: { color: '#00E5FF', fontSize: 13, fontWeight: '800' },
  progressBarBg: { height: 10, backgroundColor: '#1F2937', borderRadius: 5, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#00E5FF', borderRadius: 5 },

  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6 },
  resetBtnText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },

  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 12, marginTop: 8 },

  audioCard: { backgroundColor: '#111827', marginBottom: 24, borderLeftWidth: 3, borderLeftColor: '#00E5FF' },
  audioInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  audioLabelCol: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  audioLabel: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  audioSub: { color: '#9CA3AF', fontSize: 12, marginTop: 2, maxWidth: 160 },
  audioActions: { flexDirection: 'row', gap: 8 },
  audioBtn: { padding: 10, backgroundColor: '#1F2937', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,229,255,0.1)' },
  audioBtnDelete: { padding: 10, backgroundColor: '#3F161B', borderRadius: 10 },
  audioBtnRerecord: { padding: 10, backgroundColor: '#374151', borderRadius: 10 },
  noAudioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  noAudioText: { color: '#9CA3AF', fontSize: 13, flex: 1, marginRight: 12, lineHeight: 18 },
  recordBtn: {
    flexDirection: 'row', backgroundColor: '#00E5FF', paddingHorizontal: 16,
    paddingVertical: 12, borderRadius: 12, alignItems: 'center', gap: 6,
  },
  recordBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },

  contactsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  manageBtnText: { color: '#00E5FF', fontSize: 13, fontWeight: '700' },

  summaryCard: { backgroundColor: '#111827', marginBottom: 24 },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  summaryItem: {
    alignItems: 'center', flex: 1, backgroundColor: '#1F2937', paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.02)',
  },
  summaryVal: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  summaryLbl: { color: '#9CA3AF', fontSize: 9, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },
  emptyContactsBtn: {
    marginTop: 16, paddingVertical: 22, borderWidth: 1.5, borderColor: 'rgba(0,229,255,0.25)',
    borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', gap: 10,
  },
  emptyContactsText: { color: '#00E5FF', fontSize: 14, fontWeight: '700' },

  warningCard: { backgroundColor: '#1E1B15', borderColor: '#FFA000', marginBottom: 24 },
  warningTitle: { color: '#FFA000', fontSize: 15, fontWeight: '800', marginBottom: 12 },
  warningText: { color: '#FFD54F', fontSize: 13, lineHeight: 20, marginBottom: 8 },
});
