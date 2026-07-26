import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import CallingAppModule, { CallLog, Campaign } from '@/modules/calling-app-module/src/CallingAppModule';
import GlassCard from '@/components/GlassCard';
import StatusBadge from '@/components/StatusBadge';

export default function LogsScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const pad = isTablet ? 32 : 16;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadInitialData = async () => {
    try {
      const camps = await CallingAppModule.getCampaigns();
      setCampaigns(camps);
      if (camps.length > 0 && selectedCampaignId === null) {
        setSelectedCampaignId(camps[0].campaignId);
      }
      await fetchLogs(selectedCampaignId ?? (camps.length > 0 ? camps[0].campaignId : null));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (campaignId: number | null) => {
    try {
      if (campaignId !== null) {
        const campaignLogs = await CallingAppModule.getLogs(campaignId);
        setLogs(campaignLogs);
      } else {
        setLogs([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(
    useCallback(() => { loadInitialData(); }, [selectedCampaignId])
  );

  const handleCampaignChange = (campaignId: number) => {
    setSelectedCampaignId(campaignId);
    fetchLogs(campaignId);
  };

  const handleExport = async () => {
    if (selectedCampaignId === null) return;
    try {
      setExporting(true);
      const csvUri = await CallingAppModule.exportLogsCsv(selectedCampaignId);
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(csvUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Call Logs',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert('Cannot Share', 'File sharing is not available on this device.');
      }
    } catch (e) {
      Alert.alert('Export Failed', 'Something went wrong while creating the report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '  ' + date.toLocaleDateString();
  };

  const selectedCampaignName = campaigns.find(c => c.campaignId === selectedCampaignId)?.campaignName || 'Campaign';

  // Stats summary
  const delivered = logs.filter(l => l.status === 'COMPLETED').length;
  const failed = logs.filter(l => l.status === 'FAILED' || l.status === 'REJECTED').length;
  const busy = logs.filter(l => l.status === 'BUSY' || l.status === 'NO_ANSWER').length;
  const audioPlayed = logs.filter(l => l.audioPlayed).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, { padding: pad }]}>
        <View style={[isTablet ? styles.tabletInner : undefined, { flex: 1 }]}>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerSubtitle}>History</Text>
              <Text style={[styles.headerTitle, isTablet && { fontSize: 38 }]}>Call Logs</Text>
            </View>
            {selectedCampaignId !== null && logs.length > 0 && (
              <TouchableOpacity
                style={[styles.exportBtn, isTablet ? styles.exportBtnTablet : styles.exportBtnCircle]}
                onPress={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Ionicons name="share-outline" size={18} color="#000" />
                    {isTablet && <Text style={styles.exportText}>Export CSV</Text>}
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Campaign Selector */}
          {campaigns.length > 0 && (
            <View style={styles.pickerWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerScroll}>
                {campaigns.map((camp) => (
                  <TouchableOpacity
                    key={camp.campaignId}
                    style={[styles.pickerItem, selectedCampaignId === camp.campaignId && styles.pickerItemActive]}
                    onPress={() => handleCampaignChange(camp.campaignId)}
                  >
                    <Text style={[styles.pickerText, selectedCampaignId === camp.campaignId && styles.pickerTextActive]}>
                      {camp.campaignName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Stats Summary Row */}
          {logs.length > 0 && (
            <View style={styles.summaryRow}>
              <View style={[styles.summaryChip, isTablet ? styles.summaryChipTablet : styles.summaryChipMobile, { borderColor: '#69F0AE' }]}>
                <Text style={[styles.summaryNum, { color: '#69F0AE' }]}>{delivered}</Text>
                <Text style={styles.summaryLbl}>Delivered</Text>
              </View>
              <View style={[styles.summaryChip, isTablet ? styles.summaryChipTablet : styles.summaryChipMobile, { borderColor: '#FFAB40' }]}>
                <Text style={[styles.summaryNum, { color: '#FFAB40' }]}>{busy}</Text>
                <Text style={styles.summaryLbl}>Busy / No Answer</Text>
              </View>
              <View style={[styles.summaryChip, isTablet ? styles.summaryChipTablet : styles.summaryChipMobile, { borderColor: '#FF5252' }]}>
                <Text style={[styles.summaryNum, { color: '#FF5252' }]}>{failed}</Text>
                <Text style={styles.summaryLbl}>Failed</Text>
              </View>
              <View style={[styles.summaryChip, isTablet ? styles.summaryChipTablet : styles.summaryChipMobile, { borderColor: '#00E5FF' }]}>
                <Text style={[styles.summaryNum, { color: '#00E5FF' }]}>{audioPlayed}</Text>
                <Text style={styles.summaryLbl}>Audio Played</Text>
              </View>
            </View>
          )}

          {/* Logs List */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#00E5FF" />
              <Text style={styles.loadingText}>Loading call history...</Text>
            </View>
          ) : campaigns.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="document-text-outline" size={56} color="#4B5563" style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No campaigns yet</Text>
              <Text style={styles.emptyText}>Create a campaign and start calling to see your call history here.</Text>
            </View>
          ) : logs.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="call-outline" size={56} color="#4B5563" style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No calls recorded</Text>
              <Text style={styles.emptyText}>No calls have been made yet for "{selectedCampaignName}".</Text>
            </View>
          ) : (
            <FlatList
              data={logs}
              keyExtractor={(item) => item.logId.toString()}
              contentContainerStyle={[styles.list, isTablet && styles.tabletList]}
              numColumns={isTablet ? 2 : 1}
              key={isTablet ? 'tablet' : 'phone'}
              columnWrapperStyle={isTablet ? styles.columnWrapper : undefined}
              renderItem={({ item }) => (
                <GlassCard style={[styles.logCard, isTablet && styles.logCardTablet]}>
                  <View style={styles.logHeader}>
                    <View style={styles.logHeaderLeft}>
                      <Text style={styles.logName}>{item.customerName}</Text>
                      <Text style={styles.logPhone}>{item.phoneNumber}</Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>

                  <View style={styles.separator} />

                  <View style={styles.logDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                      <Text style={styles.detailText}>{formatTime(item.callStartTime)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="hourglass-outline" size={14} color="#9CA3AF" />
                      <Text style={styles.detailText}>Duration: {item.duration}s</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons
                        name={item.audioPlayed ? 'volume-high' : 'volume-mute'}
                        size={14}
                        color={item.audioPlayed ? '#00E5FF' : '#9CA3AF'}
                      />
                      <Text style={[styles.detailText, item.audioPlayed && { color: '#00E5FF', fontWeight: '700' }]}>
                        {item.audioPlayed ? 'Voice message was played ✓' : 'Voice message not played'}
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              )}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0A0A0C' },
  container: { flex: 1 },
  tabletInner: { maxWidth: 860, alignSelf: 'center', width: '100%' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  headerSubtitle: { color: '#00E5FF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { color: '#FFF', fontSize: 32, fontWeight: '800' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00E5FF', elevation: 3,
    shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  exportBtnCircle: {
    width: 44, height: 44, borderRadius: 22,
  },
  exportBtnTablet: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, gap: 6,
  },
  exportText: { color: '#000', fontWeight: '700', fontSize: 13 },

  pickerWrapper: { marginBottom: 16 },
  pickerScroll: { gap: 8, paddingRight: 16 },
  pickerItem: {
    backgroundColor: '#111827', paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
  },
  pickerItemActive: { backgroundColor: '#1E293B', borderColor: '#00E5FF' },
  pickerText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  pickerTextActive: { color: '#00E5FF', fontWeight: '700' },

  summaryRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8, 
    marginBottom: 16,
    justifyContent: 'space-between'
  },
  summaryChip: {
    backgroundColor: '#111827', borderRadius: 12,
    borderWidth: 1, paddingVertical: 10, alignItems: 'center',
  },
  summaryChipMobile: {
    width: '48.5%',
  },
  summaryChipTablet: {
    flex: 1,
    minWidth: 120,
  },
  summaryNum: { fontSize: 20, fontWeight: '800' },
  summaryLbl: { color: '#6B7280', fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 10 },
  loadingText: { color: '#9CA3AF', fontSize: 14 },
  emptyIcon: {},
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  list: { gap: 10, paddingBottom: 100 },
  tabletList: { gap: 12 },
  columnWrapper: { gap: 12 },

  logCard: { backgroundColor: '#111827', padding: 16 },
  logCardTablet: { flex: 1 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logHeaderLeft: { flex: 1, marginRight: 8 },
  logName: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  logPhone: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },

  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 12 },

  logDetails: { gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { color: '#9CA3AF', fontSize: 13, fontWeight: '500', flex: 1 },
});
