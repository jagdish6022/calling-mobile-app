import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CallingAppModule, { Campaign, Contact, CallLog } from '@/modules/calling-app-module/src/CallingAppModule';
import GlassCard from '@/components/GlassCard';
import StatusBadge from '@/components/StatusBadge';

export default function HomeScreen() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allLogs, setAllLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [activeContacts, setActiveContacts] = useState<Contact[]>([]);
  const [runningTime, setRunningTime] = useState(0);

  // Permissions state
  const [permissionsGranted, setPermissionsGranted] = useState({
    CALL_PHONE: true,
    READ_PHONE_STATE: true,
    RECORD_AUDIO: true
  });

  const checkAppPermissions = async () => {
    try {
      const perms = await CallingAppModule.checkPermissions();
      setPermissionsGranted(perms);
      return perms.CALL_PHONE && perms.READ_PHONE_STATE && perms.RECORD_AUDIO;
    } catch (e) {
      console.log('Error checking permissions:', e);
      return true;
    }
  };

  const requestAppPermissions = async () => {
    try {
      await CallingAppModule.requestPermissions();
      // Re-check after 1.5 seconds to let the system dialog close
      setTimeout(() => {
        checkAppPermissions();
      }, 1500);
    } catch (e) {
      console.log('Error requesting permissions:', e);
    }
  };

  // Load campaigns from local Room database
  const loadCampaigns = async () => {
    try {
      await checkAppPermissions();
      const list = await CallingAppModule.getCampaigns();
      setCampaigns(list);

      const logs = await CallingAppModule.getAllLogs();
      setAllLogs(logs);
      
      // Find campaign currently marked as RUNNING
      const active = list.find((c: Campaign) => c.status === 'RUNNING');
      if (active) {
        setActiveCampaign(active);
        const contactsList = await CallingAppModule.getContacts(active.campaignId);
        setActiveContacts(contactsList);
      } else {
        setActiveCampaign(null);
        setActiveContacts([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Run on screen focus
  useFocusEffect(
    useCallback(() => {
      CallingAppModule.recoverUnfinishedCampaigns()
        .then(() => loadCampaigns())
        .catch((err: any) => {
          console.error(err);
          loadCampaigns();
        });
    }, [])
  );

  // Poll progress when a campaign is running
  useEffect(() => {
    let timer: any;
    if (activeCampaign) {
      timer = setInterval(async () => {
        try {
          const updated = await CallingAppModule.getCampaign(activeCampaign.campaignId);
          if (updated) {
            if (updated.status !== 'RUNNING') {
              // Campaign finished or paused
              setActiveCampaign(null);
              loadCampaigns();
            } else {
              setActiveCampaign(updated);
              const contactsList = await CallingAppModule.getContacts(updated.campaignId);
              setActiveContacts(contactsList);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [activeCampaign]);

  // Campaign running timer tick
  useEffect(() => {
    let timer: any;
    if (activeCampaign && activeCampaign.status === 'RUNNING') {
      timer = setInterval(() => {
        setRunningTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRunningTime(0);
    }
    return () => clearInterval(timer);
  }, [activeCampaign]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadCampaigns();
  };

  const startCampaign = async (campaignId: number) => {
    // Verify permissions first
    const hasPerms = await checkAppPermissions();
    if (!hasPerms) {
      Alert.alert(
        'Permissions Needed',
        'Please grant cellular calling, phone status, and voice recording permissions before starting a campaign.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Grant Now', onPress: requestAppPermissions }
        ]
      );
      return;
    }

    try {
      await CallingAppModule.updateCampaignStatus(campaignId, 'RUNNING');
      await CallingAppModule.startCampaign(campaignId);
      loadCampaigns();
    } catch (e) {
      Alert.alert('Error', 'Failed to start campaign');
    }
  };

  const pauseCampaign = async (campaignId: number) => {
    try {
      await CallingAppModule.pauseCampaign(campaignId);
      loadCampaigns();
    } catch (e) {
      Alert.alert('Error', 'Failed to pause campaign');
    }
  };

  const stopCampaign = async (campaignId: number) => {
    try {
      await CallingAppModule.stopCampaign(campaignId);
      loadCampaigns();
    } catch (e) {
      Alert.alert('Error', 'Failed to stop campaign');
    }
  };

  const deleteCampaign = (campaignId: number) => {
    Alert.alert(
      'Delete Campaign',
      'Are you sure you want to delete this campaign and all its contacts and logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await CallingAppModule.deleteCampaign(campaignId);
            loadCampaigns();
          }
        }
      ]
    );
  };

  // Helper stats calculations using non-technical terms
  const total = activeContacts.length;
  const completed = activeContacts.filter(c => c.status === 'COMPLETED').length;
  const busy = activeContacts.filter(c => c.status === 'BUSY' || c.status === 'NO_ANSWER').length;
  const failed = activeContacts.filter(c => c.status === 'FAILED' || c.status === 'REJECTED').length;
  const dialing = activeContacts.filter(c => c.status === 'DIALING').length;
  const pending = activeContacts.filter(c => c.status === 'PENDING').length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const formatRunningTime = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  const hasAllPermissions = permissionsGranted.CALL_PHONE && permissionsGranted.READ_PHONE_STATE && permissionsGranted.RECORD_AUDIO;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00E5FF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00E5FF" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>SIM-Based Broadcaster</Text>
            <Text style={styles.headerTitle}>Dashboard</Text>
          </View>
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => router.push('/campaign/new')}
          >
            <Ionicons name="add" size={24} color="#000" />
            <Text style={styles.newButtonText}>Campaign</Text>
          </TouchableOpacity>
        </View>

        {/* Permission Request Banner */}
        {!hasAllPermissions && (
          <GlassCard style={styles.permissionCard} borderColor="#FFB74D" glow>
            <View style={styles.permissionHeader}>
              <Ionicons name="alert-circle-outline" size={24} color="#FFB74D" />
              <Text style={styles.permissionTitle}>Phone Permissions Needed</Text>
            </View>
            <Text style={styles.permissionText}>
              This app requires Call Phone, Read Phone Status, and Microphone permissions to make SIM calls and play broadcasts.
            </Text>
            <TouchableOpacity style={styles.grantBtn} onPress={requestAppPermissions}>
              <Text style={styles.grantBtnText}>Grant App Permissions</Text>
            </TouchableOpacity>
          </GlassCard>
        )}

        {/* System Overview Dashboard (NEW) */}
        <GlassCard style={styles.overviewCard} borderColor="rgba(255, 255, 255, 0.08)">
          <Text style={styles.overviewHeaderTitle}>System Status</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsGridItem}>
              <View style={[styles.statsIconCircle, { backgroundColor: 'rgba(0, 229, 255, 0.08)' }]}>
                <Ionicons name="megaphone-outline" size={16} color="#00E5FF" />
              </View>
              <Text style={styles.statsVal}>{campaigns.length}</Text>
              <Text style={styles.statsLbl}>Campaigns</Text>
            </View>
            <View style={styles.statsGridItem}>
              <View style={[styles.statsIconCircle, { backgroundColor: 'rgba(105, 240, 174, 0.08)' }]}>
                <Ionicons name="people-outline" size={16} color="#69F0AE" />
              </View>
              <Text style={styles.statsVal}>
                {campaigns.reduce((acc, curr) => acc + curr.totalContacts, 0)}
              </Text>
              <Text style={styles.statsLbl}>Contacts</Text>
            </View>
            <View style={styles.statsGridItem}>
              <View style={[styles.statsIconCircle, { backgroundColor: 'rgba(213, 0, 249, 0.08)' }]}>
                <Ionicons name="call-outline" size={16} color="#D500F9" />
              </View>
              <Text style={styles.statsVal}>{allLogs.length}</Text>
              <Text style={styles.statsLbl}>Calls Made</Text>
            </View>
            <View style={styles.statsGridItem}>
              <View style={[styles.statsIconCircle, { backgroundColor: 'rgba(255, 171, 64, 0.08)' }]}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#FFAB40" />
              </View>
              <Text style={styles.statsVal}>
                {allLogs.length > 0
                  ? `${Math.round((allLogs.filter(l => l.status === 'COMPLETED').length / allLogs.length) * 100)}%`
                  : '0%'}
              </Text>
              <Text style={styles.statsLbl}>Success</Text>
            </View>
          </View>
        </GlassCard>

        {/* Active Campaign Card */}
        {activeCampaign ? (
          <GlassCard style={styles.activeCard} borderColor="#00E5FF" glow>
            <View style={styles.activeHeader}>
              <View>
                <Text style={styles.activeLabel}>ACTIVE CAMPAIGN RUNNING</Text>
                <Text style={styles.activeTitle}>{activeCampaign.campaignName}</Text>
              </View>
              <Text style={styles.timer}>{formatRunningTime(runningTime)}</Text>
            </View>

            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.progressText}>{progressPercent}% Dialed</Text>
            </View>

            {/* Metrics grid */}
            <View style={styles.grid}>
              <View style={styles.gridItem}>
                <Text style={styles.gridVal}>{total}</Text>
                <Text style={styles.gridLbl}>Total</Text>
              </View>
              <View style={[styles.gridItem, styles.completedBorder]}>
                <Text style={[styles.gridVal, { color: '#69F0AE' }]}>{completed}</Text>
                <Text style={styles.gridLbl}>Delivered</Text>
              </View>
              <View style={[styles.gridItem, styles.busyBorder]}>
                <Text style={[styles.gridVal, { color: '#FFAB40' }]}>{busy}</Text>
                <Text style={styles.gridLbl}>Busy</Text>
              </View>
              <View style={[styles.gridItem, styles.failedBorder]}>
                <Text style={[styles.gridVal, { color: '#FF5252' }]}>{failed}</Text>
                <Text style={styles.gridLbl}>Failed</Text>
              </View>
              <View style={[styles.gridItem, styles.dialingBorder]}>
                <Text style={[styles.gridVal, { color: '#40C4FF' }]}>{dialing + pending}</Text>
                <Text style={styles.gridLbl}>Remaining</Text>
              </View>
            </View>

            {/* Active controls */}
            <View style={styles.controls}>
              <TouchableOpacity
                style={styles.pauseBtn}
                onPress={() => pauseCampaign(activeCampaign.campaignId)}
              >
                <Ionicons name="pause" size={20} color="#00E5FF" />
                <Text style={styles.pauseBtnText}>Pause</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stopBtn}
                onPress={() => stopCampaign(activeCampaign.campaignId)}
              >
                <Ionicons name="stop" size={20} color="#FF5252" />
                <Text style={styles.stopBtnText}>End Calling</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        ) : (
          <GlassCard style={styles.idleCard}>
            <Ionicons name="radio-outline" size={40} color="#60646C" style={styles.idleIcon} />
            <Text style={styles.idleTitle}>No Active Broadcast</Text>
            <Text style={styles.idleText}>
              Select a campaign below or click "+ Campaign" to record a message and start broadcasting.
            </Text>
          </GlassCard>
        )}

        {/* Campaign list */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Your Calling Campaigns</Text>
          {campaigns.length === 0 ? (
            <Text style={styles.emptyText}>No campaigns created yet. Tap "+ Campaign" above.</Text>
          ) : (
            campaigns.map((camp) => (
              <TouchableOpacity
                key={camp.campaignId}
                style={styles.campaignItem}
                onPress={() => router.push({
                  pathname: '/campaign/[id]',
                  params: { id: camp.campaignId.toString() }
                })}
              >
                <GlassCard style={[styles.campaignCard, camp.status === 'RUNNING' && styles.runningCampaignCard]}>
                  <View style={styles.campaignMeta}>
                    <View style={styles.campaignInfo}>
                      <Text style={styles.campaignName}>{camp.campaignName}</Text>
                      <Text style={styles.campaignSub}>
                        {camp.totalContacts} Contacts • {camp.delayBetweenCalls}s Wait Time
                      </Text>
                    </View>
                    <View style={styles.campaignAction}>
                      <StatusBadge status={camp.status === 'RUNNING' ? 'DIALING' : camp.status} />
                      <View style={{ width: 8 }} />
                      {camp.status !== 'RUNNING' && (
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => deleteCampaign(camp.campaignId)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#FF5252" />
                        </TouchableOpacity>
                      )}
                      <View style={{ width: 6 }} />
                      <Ionicons name="chevron-forward" size={18} color="#4B5563" />
                    </View>
                  </View>

                  {/* Quick Start / Play button if draft or paused */}
                  {camp.status !== 'RUNNING' && camp.status !== 'COMPLETED' && camp.totalContacts > 0 && (
                    <TouchableOpacity
                      style={styles.quickStartBtn}
                      onPress={() => startCampaign(camp.campaignId)}
                    >
                      <Ionicons name="play" size={16} color="#000" />
                      <Text style={styles.quickStartText}>Start Automatic Calling</Text>
                    </TouchableOpacity>
                  )}
                </GlassCard>
              </TouchableOpacity>
            ))
          )}
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 4,
    elevation: 3,
  },
  newButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  permissionCard: {
    backgroundColor: '#241E15',
    borderColor: '#FFB74D',
    marginBottom: 20,
    padding: 16,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  permissionTitle: {
    color: '#FFB74D',
    fontSize: 16,
    fontWeight: '800',
  },
  permissionText: {
    color: '#FFE0B2',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  grantBtn: {
    backgroundColor: '#FFB74D',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  grantBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 13,
  },
  activeCard: {
    marginBottom: 24,
    backgroundColor: '#111827',
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  activeLabel: {
    color: '#00E5FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  activeTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  timer: {
    color: '#D500F9',
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '700',
    backgroundColor: '#1E1B29',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(213, 0, 249, 0.2)',
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#1F2937',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00E5FF',
    borderRadius: 4,
  },
  progressText: {
    color: '#B0B4BA',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  gridItem: {
    flex: 1,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#60646C',
  },
  gridVal: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  gridLbl: {
    color: '#9CA3AF',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  completedBorder: { borderBottomColor: '#69F0AE' },
  busyBorder: { borderBottomColor: '#FFAB40' },
  failedBorder: { borderBottomColor: '#FF5252' },
  dialingBorder: { borderBottomColor: '#40C4FF' },
  controls: {
    flexDirection: 'row',
    gap: 12,
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
  idleCard: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 24,
  },
  idleIcon: {
    marginBottom: 12,
  },
  idleTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  idleText: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  listSection: {
    gap: 12,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  campaignItem: {
    marginBottom: 4,
  },
  campaignCard: {
    padding: 14,
    backgroundColor: '#111827',
  },
  campaignMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  campaignInfo: {
    flex: 1,
  },
  campaignName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  campaignSub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  campaignAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteBtn: {
    padding: 6,
    backgroundColor: '#3F161B',
    borderRadius: 8,
  },
  quickStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E5FF',
    marginTop: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  quickStartText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 12,
  },
  overviewCard: {
    backgroundColor: '#111827',
    padding: 16,
    marginBottom: 24,
  },
  overviewHeaderTitle: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statsGridItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1F2937',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  statsIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsVal: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  statsLbl: {
    color: '#9CA3AF',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  runningCampaignCard: {
    borderColor: '#00E5FF',
    borderWidth: 1,
    backgroundColor: '#112233',
  },
});
