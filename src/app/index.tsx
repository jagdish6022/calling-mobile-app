import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CallingAppModule, { Campaign, Contact, CallLog } from '@/modules/calling-app-module/src/CallingAppModule';
import GlassCard from '@/components/GlassCard';
import StatusBadge from '@/components/StatusBadge';

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const pad = isTablet ? 32 : 16;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allLogs, setAllLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [activeContacts, setActiveContacts] = useState<Contact[]>([]);
  const [runningTime, setRunningTime] = useState(0);

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
      return true;
    }
  };

  const requestAppPermissions = async () => {
    try {
      await CallingAppModule.requestPermissions();
      setTimeout(() => { checkAppPermissions(); }, 1500);
    } catch (e) {
      console.log('Error requesting permissions:', e);
    }
  };

  const loadCampaigns = async () => {
    try {
      await checkAppPermissions();
      const list = await CallingAppModule.getCampaigns();
      setCampaigns(list);
      const logs = await CallingAppModule.getAllLogs();
      setAllLogs(logs);
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

  useFocusEffect(
    useCallback(() => {
      CallingAppModule.recoverUnfinishedCampaigns()
        .then(() => loadCampaigns())
        .catch((err: any) => { console.error(err); loadCampaigns(); });
    }, [])
  );

  useEffect(() => {
    let timer: any;
    if (activeCampaign) {
      timer = setInterval(async () => {
        try {
          const updated = await CallingAppModule.getCampaign(activeCampaign.campaignId);
          if (updated) {
            if (updated.status !== 'RUNNING') {
              setActiveCampaign(null);
              loadCampaigns();
            } else {
              setActiveCampaign(updated);
              const contactsList = await CallingAppModule.getContacts(updated.campaignId);
              setActiveContacts(contactsList);
            }
          }
        } catch (e) { console.error(e); }
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [activeCampaign]);

  useEffect(() => {
    let timer: any;
    if (activeCampaign && activeCampaign.status === 'RUNNING') {
      timer = setInterval(() => { setRunningTime((prev) => prev + 1); }, 1000);
    } else {
      setRunningTime(0);
    }
    return () => clearInterval(timer);
  }, [activeCampaign]);

  const handleRefresh = () => { setRefreshing(true); loadCampaigns(); };

  const startCampaign = async (campaignId: number) => {
    const hasPerms = await checkAppPermissions();
    if (!hasPerms) {
      Alert.alert(
        '📱 Permissions Needed',
        'To make calls, please allow this app to access your phone and microphone.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Allow Permissions', onPress: requestAppPermissions }
        ]
      );
      return;
    }
    try {
      await CallingAppModule.updateCampaignStatus(campaignId, 'RUNNING');
      await CallingAppModule.startCampaign(campaignId);
      loadCampaigns();
    } catch (e) {
      Alert.alert('Error', 'Could not start calling. Please try again.');
    }
  };

  const pauseCampaign = async (campaignId: number) => {
    try {
      await CallingAppModule.pauseCampaign(campaignId);
      loadCampaigns();
    } catch (e) {
      Alert.alert('Error', 'Could not pause calling.');
    }
  };

  const stopCampaign = async (campaignId: number) => {
    try {
      await CallingAppModule.stopCampaign(campaignId);
      loadCampaigns();
    } catch (e) {
      Alert.alert('Error', 'Could not stop calling.');
    }
  };

  const deleteCampaign = (campaignId: number) => {
    Alert.alert(
      'Delete Campaign',
      'This will permanently delete this campaign along with all its contacts and call history. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            await CallingAppModule.deleteCampaign(campaignId);
            loadCampaigns();
          }
        }
      ]
    );
  };

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
  const successRate = allLogs.length > 0
    ? `${Math.round((allLogs.filter(l => l.status === 'COMPLETED').length / allLogs.length) * 100)}%`
    : '0%';

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text style={styles.loadingText}>Loading your campaigns...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.container, { padding: pad, paddingBottom: 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00E5FF" />}
      >
        <View style={isTablet ? styles.tabletInner : undefined}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerSubtitle}>Voice Call Broadcaster</Text>
              <Text style={[styles.headerTitle, isTablet && { fontSize: 40 }]}>My Dashboard</Text>
            </View>
            <TouchableOpacity
              style={[styles.newButton, isTablet && { paddingHorizontal: 24, paddingVertical: 14 }]}
              onPress={() => router.push('/campaign/new')}
            >
              <Ionicons name="add" size={24} color="#000" />
              <Text style={[styles.newButtonText, isTablet && { fontSize: 16 }]}>New Campaign</Text>
            </TouchableOpacity>
          </View>

          {/* Permission Warning Banner */}
          {!hasAllPermissions && (
            <GlassCard style={styles.permissionCard} borderColor="#FFB74D" glow>
              <View style={styles.permissionHeader}>
                <Ionicons name="alert-circle-outline" size={26} color="#FFB74D" />
                <Text style={styles.permissionTitle}>App Permissions Required</Text>
              </View>
              <Text style={styles.permissionText}>
                This app needs permission to make phone calls and use the microphone.
                Please tap below to allow it.
              </Text>
              <TouchableOpacity style={styles.grantBtn} onPress={requestAppPermissions}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#000" />
                <Text style={styles.grantBtnText}>Allow Permissions Now</Text>
              </TouchableOpacity>
            </GlassCard>
          )}

          {/* Overview Stats */}
          <GlassCard style={styles.overviewCard} borderColor="rgba(255,255,255,0.08)">
            <Text style={styles.overviewHeaderTitle}>Overall Summary</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statsGridItem}>
                <View style={[styles.statsIconCircle, { backgroundColor: 'rgba(0,229,255,0.08)' }]}>
                  <Ionicons name="megaphone-outline" size={18} color="#00E5FF" />
                </View>
                <Text style={[styles.statsVal, isTablet && { fontSize: 22 }]}>{campaigns.length}</Text>
                <Text style={styles.statsLbl}>Campaigns</Text>
              </View>
              <View style={styles.statsGridItem}>
                <View style={[styles.statsIconCircle, { backgroundColor: 'rgba(105,240,174,0.08)' }]}>
                  <Ionicons name="people-outline" size={18} color="#69F0AE" />
                </View>
                <Text style={[styles.statsVal, isTablet && { fontSize: 22 }]}>
                  {campaigns.reduce((acc, curr) => acc + curr.totalContacts, 0)}
                </Text>
                <Text style={styles.statsLbl}>Contacts</Text>
              </View>
              <View style={styles.statsGridItem}>
                <View style={[styles.statsIconCircle, { backgroundColor: 'rgba(213,0,249,0.08)' }]}>
                  <Ionicons name="call-outline" size={18} color="#D500F9" />
                </View>
                <Text style={[styles.statsVal, isTablet && { fontSize: 22 }]}>{allLogs.length}</Text>
                <Text style={styles.statsLbl}>Calls Made</Text>
              </View>
              <View style={styles.statsGridItem}>
                <View style={[styles.statsIconCircle, { backgroundColor: 'rgba(255,171,64,0.08)' }]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFAB40" />
                </View>
                <Text style={[styles.statsVal, isTablet && { fontSize: 22 }]}>{successRate}</Text>
                <Text style={styles.statsLbl}>Success</Text>
              </View>
            </View>
          </GlassCard>

          {/* Active Campaign Live View */}
          {activeCampaign ? (
            <GlassCard style={styles.activeCard} borderColor="#00E5FF" glow>
              <View style={styles.activeBadgeRow}>
                <View style={styles.liveDot} />
                <Text style={styles.activeLabel}>CALLING IN PROGRESS</Text>
                <Text style={styles.timer}>{formatRunningTime(runningTime)}</Text>
              </View>
              <Text style={[styles.activeTitle, isTablet && { fontSize: 26 }]}>{activeCampaign.campaignName}</Text>

              <View style={styles.progressContainer}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>Progress</Text>
                  <Text style={styles.progressValue}>{progressPercent}% completed</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                </View>
              </View>

              <View style={[styles.grid, isTablet && { gap: 12 }]}>
                <View style={styles.gridItem}>
                  <Text style={styles.gridVal}>{total}</Text>
                  <Text style={styles.gridLbl}>Total</Text>
                </View>
                <View style={[styles.gridItem, styles.completedBorder]}>
                  <Text style={[styles.gridVal, { color: '#69F0AE' }]}>{completed}</Text>
                  <Text style={styles.gridLbl}>Done</Text>
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
                  <Text style={styles.gridLbl}>Left</Text>
                </View>
              </View>

              <View style={[styles.controls, isTablet && { gap: 16 }]}>
                <TouchableOpacity style={styles.pauseBtn} onPress={() => pauseCampaign(activeCampaign.campaignId)}>
                  <Ionicons name="pause" size={20} color="#00E5FF" />
                  <Text style={styles.pauseBtnText}>Pause Calling</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stopBtn} onPress={() => stopCampaign(activeCampaign.campaignId)}>
                  <Ionicons name="stop" size={20} color="#FF5252" />
                  <Text style={styles.stopBtnText}>Stop Campaign</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          ) : (
            <GlassCard style={styles.idleCard}>
              <Ionicons name="radio-outline" size={48} color="#374151" style={styles.idleIcon} />
              <Text style={styles.idleTitle}>No Active Broadcast</Text>
              <Text style={styles.idleText}>
                Pick a campaign below and tap "Start Calling" — or create a new one using the button above.
              </Text>
            </GlassCard>
          )}

          {/* Campaign List */}
          <View style={styles.listSection}>
            <Text style={[styles.sectionTitle, isTablet && { fontSize: 22 }]}>Your Campaigns</Text>
            {campaigns.length === 0 ? (
              <GlassCard style={styles.emptyCampaignsCard}>
                <Ionicons name="megaphone-outline" size={40} color="#374151" />
                <Text style={styles.emptyCampaignsTitle}>No campaigns yet</Text>
                <Text style={styles.emptyCampaignsText}>
                  Tap "+ New Campaign" above to create your first voice broadcasting campaign.
                </Text>
                <TouchableOpacity style={styles.createFirstBtn} onPress={() => router.push('/campaign/new')}>
                  <Ionicons name="add" size={20} color="#000" />
                  <Text style={styles.createFirstBtnText}>Create First Campaign</Text>
                </TouchableOpacity>
              </GlassCard>
            ) : (
              <View style={isTablet ? styles.tabletCampaignGrid : undefined}>
                {campaigns.map((camp) => (
                  <TouchableOpacity
                    key={camp.campaignId}
                    style={isTablet ? styles.tabletCampaignItem : styles.campaignItem}
                    onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: camp.campaignId.toString() } })}
                  >
                    <GlassCard style={[styles.campaignCard, camp.status === 'RUNNING' && styles.runningCampaignCard]}>
                      <View style={styles.campaignMeta}>
                        <View style={styles.campaignInfo}>
                          <Text style={[styles.campaignName, isTablet && { fontSize: 18 }]}>{camp.campaignName}</Text>
                          <Text style={styles.campaignSub}>
                            {camp.totalContacts} contacts · {camp.delayBetweenCalls}s between calls
                          </Text>
                        </View>
                        <View style={styles.campaignAction}>
                          <StatusBadge status={camp.status === 'RUNNING' ? 'DIALING' : camp.status} />
                          <View style={{ width: 8 }} />
                          {camp.status !== 'RUNNING' && (
                            <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteCampaign(camp.campaignId)}>
                              <Ionicons name="trash-outline" size={16} color="#FF5252" />
                            </TouchableOpacity>
                          )}
                          <View style={{ width: 6 }} />
                          <Ionicons name="chevron-forward" size={18} color="#4B5563" />
                        </View>
                      </View>

                      {camp.status !== 'RUNNING' && camp.status !== 'COMPLETED' && camp.totalContacts > 0 && (
                        <TouchableOpacity style={styles.quickStartBtn} onPress={() => startCampaign(camp.campaignId)}>
                          <Ionicons name="play" size={16} color="#000" />
                          <Text style={styles.quickStartText}>▶  Start Automatic Calling</Text>
                        </TouchableOpacity>
                      )}
                    </GlassCard>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 10 },
  headerSubtitle: { color: '#00E5FF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { color: '#FFF', fontSize: 32, fontWeight: '800' },
  newButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#00E5FF',
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, gap: 6, elevation: 3,
  },
  newButtonText: { color: '#000', fontWeight: '700', fontSize: 14 },

  permissionCard: { backgroundColor: '#241E15', marginBottom: 20, padding: 18, gap: 10 },
  permissionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  permissionTitle: { color: '#FFB74D', fontSize: 16, fontWeight: '800' },
  permissionText: { color: '#FFE0B2', fontSize: 14, lineHeight: 20 },
  grantBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFB74D', paddingVertical: 12, borderRadius: 10, gap: 8, marginTop: 4,
  },
  grantBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },

  overviewCard: { backgroundColor: '#111827', padding: 18, marginBottom: 24 },
  overviewHeaderTitle: { color: '#9CA3AF', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  statsGridItem: {
    flex: 1, alignItems: 'center', backgroundColor: '#1F2937',
    paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)',
  },
  statsIconCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statsVal: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  statsLbl: { color: '#9CA3AF', fontSize: 10, fontWeight: '600', marginTop: 3, textAlign: 'center' },

  activeCard: { marginBottom: 24, backgroundColor: '#111827' },
  activeBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5252' },
  activeLabel: { color: '#00E5FF', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, flex: 1 },
  timer: {
    color: '#D500F9', fontFamily: 'monospace', fontSize: 16, fontWeight: '700',
    backgroundColor: '#1E1B29', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(213,0,249,0.2)',
  },
  activeTitle: { color: '#FFF', fontSize: 22, fontWeight: '800', marginBottom: 16 },
  progressContainer: { marginBottom: 20 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  progressValue: { color: '#00E5FF', fontSize: 13, fontWeight: '800' },
  progressBarBg: { height: 10, backgroundColor: '#1F2937', borderRadius: 5, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#00E5FF', borderRadius: 5 },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 8 },
  gridItem: { flex: 1, backgroundColor: '#1F2937', alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderBottomWidth: 2, borderBottomColor: '#60646C' },
  gridVal: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  gridLbl: { color: '#9CA3AF', fontSize: 9, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  completedBorder: { borderBottomColor: '#69F0AE' },
  busyBorder: { borderBottomColor: '#FFAB40' },
  failedBorder: { borderBottomColor: '#FF5252' },
  dialingBorder: { borderBottomColor: '#40C4FF' },
  controls: { flexDirection: 'row', gap: 12 },
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

  idleCard: { alignItems: 'center', paddingVertical: 40, marginBottom: 24 },
  idleIcon: { marginBottom: 16 },
  idleTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  idleText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },

  listSection: { gap: 12 },
  sectionTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  emptyCampaignsCard: { alignItems: 'center', paddingVertical: 40, gap: 10, backgroundColor: '#111827' },
  emptyCampaignsTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  emptyCampaignsText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  createFirstBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#00E5FF',
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, gap: 8, marginTop: 6,
  },
  createFirstBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },

  tabletCampaignGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tabletCampaignItem: { width: '48.5%' },
  campaignItem: { marginBottom: 4 },
  campaignCard: { padding: 16, backgroundColor: '#111827' },
  runningCampaignCard: { borderColor: '#00E5FF', borderWidth: 1, backgroundColor: '#112233' },
  campaignMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  campaignInfo: { flex: 1 },
  campaignName: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  campaignSub: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  campaignAction: { flexDirection: 'row', alignItems: 'center' },
  deleteBtn: { padding: 8, backgroundColor: '#3F161B', borderRadius: 8 },
  quickStartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00E5FF', marginTop: 14, paddingVertical: 10, borderRadius: 10, gap: 6,
  },
  quickStartText: { color: '#000', fontWeight: '700', fontSize: 13 },
});
