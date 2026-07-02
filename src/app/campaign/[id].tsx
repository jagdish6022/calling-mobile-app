import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CallingAppModule, { Campaign, Contact } from '@/modules/calling-app-module/src/CallingAppModule';
import GlassCard from '@/components/GlassCard';
import StatusBadge from '@/components/StatusBadge';

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const campaignId = parseInt(id as string);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const loadData = async () => {
    try {
      const camp = await CallingAppModule.getCampaign(campaignId);
      setCampaign(camp);
      if (camp) {
        const contactList = await CallingAppModule.getContacts(campaignId);
        setContacts(contactList);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load campaign details');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [campaignId])
  );

  // Poll progress when running
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (campaign && campaign.status === 'RUNNING') {
      timer = setInterval(async () => {
        try {
          const camp = await CallingAppModule.getCampaign(campaignId);
          setCampaign(camp);
          if (camp) {
            const contactList = await CallingAppModule.getContacts(campaignId);
            setContacts(contactList);
          }
        } catch (e) {
          console.error(e);
        }
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [campaign]);

  const handleStart = async () => {
    if (!campaign) return;

    if (contacts.length === 0) {
      Alert.alert('Contacts Missing', 'Please add or import contacts to this campaign first.');
      return;
    }

    if (!campaign.audioFilePath) {
      Alert.alert(
        'Voice Message Missing',
        'You have not recorded your voice message yet. Do you want to proceed playing only the Text-To-Speech greeting (e.g. "Hello John") without your recorded voice message?',
        [
          { text: 'Go Record', onPress: () => router.push(`/campaign/${campaignId}/record`), style: 'cancel' },
          { text: 'Start with Voice Only', onPress: () => triggerStart() }
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
      Alert.alert('Error', 'Failed to start calling');
    }
  };

  const handlePause = async () => {
    try {
      await CallingAppModule.pauseCampaign(campaignId);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to pause calling');
    }
  };

  const handleStop = async () => {
    try {
      await CallingAppModule.stopCampaign(campaignId);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to end campaign');
    }
  };

  const handleReset = async () => {
    Alert.alert(
      'Reset Calling Queue',
      'This will reset all contacts back to "Uncalled" state so you can dial this list from the beginning. (Calling logs of past calls will not be deleted). Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset List',
          onPress: async () => {
            try {
              setLoading(true);
              await CallingAppModule.resetCampaignContacts(campaignId);
              loadData();
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Failed to reset contacts');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const playAudio = async () => {
    if (!campaign?.audioFilePath) return;
    try {
      setIsPlaying(true);
      await CallingAppModule.playAudio(campaign.audioFilePath);
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

  const deleteAudio = async () => {
    if (!campaign?.audioFilePath) return;
    Alert.alert('Delete Recording', 'Are you sure you want to delete this audio recording?', [
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
      </View>
    );
  }

  // Calculate statistics using non-technical terms
  const total = contacts.length;
  const completed = contacts.filter((c) => c.status === 'COMPLETED').length;
  const busy = contacts.filter((c) => c.status === 'BUSY' || c.status === 'NO_ANSWER').length;
  const failed = contacts.filter((c) => c.status === 'FAILED' || c.status === 'REJECTED').length;
  const dialing = contacts.filter((c) => c.status === 'DIALING').length;
  const pending = contacts.filter((c) => c.status === 'PENDING').length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Checklist Validation
  const hasVoiceMessage = !!campaign.audioFilePath;
  const hasContacts = total > 0;
  const isReadyToStart = hasContacts; // Technically can start without audio, but contacts is mandatory

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>{campaign.campaignName}</Text>
            <Text style={styles.headerSub}>Broadcasting Control Center</Text>
          </View>
        </View>

        {/* Preparation Checklist (Visual Guide for non-technical users) */}
        {campaign.status !== 'RUNNING' && (
          <GlassCard style={styles.checklistCard}>
            <Text style={styles.checklistTitle}>📋 Campaign Setup Checklist</Text>
            
            <View style={styles.checkItem}>
              <Ionicons
                name={hasVoiceMessage ? "checkmark-circle" : "close-circle"}
                size={22}
                color={hasVoiceMessage ? "#69F0AE" : "#FF5252"}
              />
              <View style={styles.checkTextCol}>
                <Text style={[styles.checkLabel, hasVoiceMessage && styles.checkCompleted]}>
                  Step 1: Record Voice Message
                </Text>
                {!hasVoiceMessage && (
                  <TouchableOpacity onPress={() => router.push(`/campaign/${campaignId}/record`)}>
                    <Text style={styles.checkActionText}>Tap to Record Voice message</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.checkItem}>
              <Ionicons
                name={hasContacts ? "checkmark-circle" : "close-circle"}
                size={22}
                color={hasContacts ? "#69F0AE" : "#FF5252"}
              />
              <View style={styles.checkTextCol}>
                <Text style={[styles.checkLabel, hasContacts && styles.checkCompleted]}>
                  Step 2: Add Contacts ({total} added)
                </Text>
                {!hasContacts && (
                  <TouchableOpacity onPress={() => router.push(`/campaign/${campaignId}/contacts`)}>
                    <Text style={styles.checkActionText}>Tap to Import Contacts (Excel/CSV)</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.checkItem}>
              <Ionicons name="alert-circle" size={22} color="#FFA000" />
              <View style={styles.checkTextCol}>
                <Text style={styles.checkLabelWarning}>
                  Step 3: Keep Volume High & Unmute SIM
                </Text>
                <Text style={styles.checkSub}>
                  Make sure phone volume is loud so the speaker can transmit your recording.
                </Text>
              </View>
            </View>
          </GlassCard>
        )}

        {/* Campaign Execution Controls */}
        <GlassCard style={styles.controlCard}>
          <View style={styles.statusRow}>
            <Text style={styles.label}>CAMPAIGN STATE</Text>
            <StatusBadge status={campaign.status === 'RUNNING' ? 'DIALING' : campaign.status} />
          </View>

          {campaign.status === 'RUNNING' ? (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.pauseBtn} onPress={handlePause}>
                <Ionicons name="pause" size={20} color="#00E5FF" />
                <Text style={styles.pauseBtnText}>Pause Calling</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
                <Ionicons name="stop" size={20} color="#FF5252" />
                <Text style={styles.stopBtnText}>End Campaign</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.startBtn, !isReadyToStart && styles.startBtnDisabled]}
                onPress={handleStart}
                disabled={!isReadyToStart}
              >
                <Ionicons name="play" size={20} color="#000" />
                <Text style={styles.startBtnText}>Start Automatic Calling</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Progress bar */}
          {total > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Calling Progress</Text>
                <Text style={styles.progressLabelVal}>{progressPercent}% Called</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>
          )}
          
          {/* Reset Queue Option */}
          {campaign.status !== 'RUNNING' && total > 0 && (
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Ionicons name="refresh" size={16} color="#B0B4BA" />
              <Text style={styles.resetBtnText}>Reset and Call Everyone Again</Text>
            </TouchableOpacity>
          )}
        </GlassCard>

        {/* Audio Recording Section */}
        <Text style={styles.sectionTitle}>Campaign Voice Message</Text>
        <GlassCard style={styles.audioCard}>
          {campaign.audioFilePath ? (
            <View style={styles.audioInfoRow}>
              <View style={styles.audioLabelCol}>
                <Ionicons name="musical-notes-outline" size={24} color="#00E5FF" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.audioLabel}>Voice Recording Ready</Text>
                  <Text style={styles.audioSub} numberOfLines={1}>
                    {campaign.audioFilePath.split('/').pop()}
                  </Text>
                </View>
              </View>
              <View style={styles.audioActions}>
                {isPlaying ? (
                  <TouchableOpacity style={styles.audioPlayBtn} onPress={stopAudio}>
                    <Ionicons name="square" size={18} color="#FF5252" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.audioPlayBtn} onPress={playAudio}>
                    <Ionicons name="play" size={18} color="#00E5FF" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.audioDeleteBtn} onPress={deleteAudio}>
                  <Ionicons name="trash-outline" size={18} color="#FF5252" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.reRecordBtn}
                  onPress={() => router.push(`/campaign/${campaignId}/record`)}
                >
                  <Ionicons name="refresh" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.noAudioRow}>
              <Text style={styles.noAudioText}>No recorded message yet. Record one to play it during the call.</Text>
              <TouchableOpacity
                style={styles.recordBtn}
                onPress={() => router.push(`/campaign/${campaignId}/record`)}
              >
                <Ionicons name="mic" size={18} color="#000" />
                <Text style={styles.recordBtnText}>Record message</Text>
              </TouchableOpacity>
            </View>
          )}
        </GlassCard>

        {/* Contact List Summary */}
        <View style={styles.contactsHeader}>
          <Text style={styles.sectionTitle}>Contacts List ({total})</Text>
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => router.push(`/campaign/${campaignId}/contacts`)}
          >
            <Ionicons name="people-outline" size={16} color="#00E5FF" />
            <Text style={styles.manageBtnText}>Manage Contacts</Text>
          </TouchableOpacity>
        </View>

        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>{pending}</Text>
              <Text style={styles.summaryLbl}>Uncalled</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: '#40C4FF' }]}>{dialing}</Text>
              <Text style={styles.summaryLbl}>Dialing</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: '#69F0AE' }]}>{completed}</Text>
              <Text style={styles.summaryLbl}>Delivered</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: '#FFAB40' }]}>{busy}</Text>
              <Text style={styles.summaryLbl}>Busy</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: '#FF5252' }]}>{failed}</Text>
              <Text style={styles.summaryLbl}>Failed</Text>
            </View>
          </View>

          {total === 0 && (
            <TouchableOpacity
              style={styles.emptyContactsBtn}
              onPress={() => router.push(`/campaign/${campaignId}/contacts`)}
            >
              <Ionicons name="cloud-upload-outline" size={24} color="#00E5FF" />
              <Text style={styles.emptyContactsText}>Upload Contact Sheet (Excel/CSV)</Text>
            </TouchableOpacity>
          )}
        </GlassCard>

        {/* Dynamic Warning Helper */}
        <GlassCard style={styles.warningCard}>
          <Text style={styles.warningTitle}>💡 How does calling work?</Text>
          <Text style={styles.warningText}>
            • The app will automatically open your phone dialer app and initiate calls.
          </Text>
          <Text style={styles.warningText}>
            • **Answer Delay**: Since standard Android cannot detect when the other party answers a call, the app will wait **6 seconds** after dialing starts before it begins speaking the TTS name and playing your message.
          </Text>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0A0A0C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
  checklistCard: {
    backgroundColor: '#1C1917',
    borderColor: '#78716C',
    marginBottom: 20,
    gap: 12,
  },
  checklistTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkTextCol: {
    flex: 1,
  },
  checkLabel: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '700',
  },
  checkLabelWarning: {
    color: '#FFB74D',
    fontSize: 13,
    fontWeight: '700',
  },
  checkCompleted: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  checkActionText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  checkSub: {
    color: '#9CA3AF',
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  controlCard: {
    backgroundColor: '#111827',
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  startBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E5FF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    elevation: 3,
  },
  startBtnDisabled: {
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  startBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
  },
  pauseBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  pauseBtnText: {
    color: '#00E5FF',
    fontWeight: '700',
    fontSize: 14,
  },
  stopBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FF5252',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  stopBtnText: {
    color: '#FF5252',
    fontWeight: '700',
    fontSize: 14,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    gap: 6,
    marginTop: 10,
  },
  resetBtnText: {
    color: '#B0B4BA',
    fontSize: 12,
    fontWeight: '700',
  },
  progressContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  progressLabelVal: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#1F2937',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00E5FF',
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 8,
  },
  audioCard: {
    backgroundColor: '#111827',
    marginBottom: 24,
    justifyContent: 'center',
  },
  audioInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  audioLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  audioLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  audioSub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
    maxWidth: 160,
  },
  audioActions: {
    flexDirection: 'row',
    gap: 8,
  },
  audioPlayBtn: {
    padding: 10,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.1)',
  },
  audioDeleteBtn: {
    padding: 10,
    backgroundColor: '#3F161B',
    borderRadius: 10,
  },
  reRecordBtn: {
    padding: 10,
    backgroundColor: '#374151',
    borderRadius: 10,
  },
  noAudioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  noAudioText: {
    color: '#9CA3AF',
    fontSize: 13,
    flex: 1,
    marginRight: 12,
    lineHeight: 18,
  },
  recordBtn: {
    flexDirection: 'row',
    backgroundColor: '#00E5FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    gap: 4,
  },
  recordBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 12,
  },
  contactsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  manageBtnText: {
    color: '#00E5FF',
    fontSize: 13,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#111827',
    marginBottom: 24,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryVal: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  summaryLbl: {
    color: '#9CA3AF',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  emptyContactsBtn: {
    marginTop: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
  },
  emptyContactsText: {
    color: '#00E5FF',
    fontSize: 13,
    fontWeight: '600',
  },
  settingsCard: {
    backgroundColor: '#111827',
    padding: 0,
    marginBottom: 24,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  settingsTextCol: {
    flex: 1,
  },
  settingsLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  settingsValText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    marginBottom: 6,
  },
});
