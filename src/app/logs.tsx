import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Alert
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import CallingAppModule, { CallLog, Campaign } from '@/modules/calling-app-module/src/CallingAppModule';
import GlassCard from '@/components/GlassCard';
import StatusBadge from '@/components/StatusBadge';

export default function LogsScreen() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadInitialData = async () => {
    try {
      const camps = await CallingAppModule.getCampaigns();
      setCampaigns(camps);
      
      // Default to the first campaign if available
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
    useCallback(() => {
      loadInitialData();
    }, [selectedCampaignId])
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
      
      // Share CSV using Expo sharing
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(csvUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Call Logs',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert('Sharing Unavailable', 'Native sharing is not supported on this device.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Export Failed', 'An error occurred while generating the CSV report.');
    } finally {
      setExporting(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + date.toLocaleDateString();
  };

  const selectedCampaignName = campaigns.find(c => c.campaignId === selectedCampaignId)?.campaignName || 'Campaign';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>SIM Telephony History</Text>
            <Text style={styles.headerTitle}>Call Logs</Text>
          </View>
          {selectedCampaignId !== null && logs.length > 0 && (
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="share-outline" size={18} color="#000" />
                  <Text style={styles.exportText}>Export CSV</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Campaign Horizontal Selector */}
        {campaigns.length > 0 && (
          <View style={styles.pickerWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerScroll}>
              {campaigns.map((camp) => (
                <TouchableOpacity
                  key={camp.campaignId}
                  style={[
                    styles.pickerItem,
                    selectedCampaignId === camp.campaignId && styles.pickerItemActive
                  ]}
                  onPress={() => handleCampaignChange(camp.campaignId)}
                >
                  <Text
                    style={[
                      styles.pickerText,
                      selectedCampaignId === camp.campaignId && styles.pickerTextActive
                    ]}
                  >
                    {camp.campaignName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Logs List */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#00E5FF" />
          </View>
        ) : campaigns.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="document-text-outline" size={48} color="#4B5563" style={styles.emptyIcon} />
            <Text style={styles.emptyText}>Create a campaign and start calling to view logs.</Text>
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="call-outline" size={48} color="#4B5563" style={styles.emptyIcon} />
            <Text style={styles.emptyText}>No call attempts recorded for '{selectedCampaignName}'.</Text>
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item) => item.logId.toString()}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <GlassCard style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View>
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
                    <Text style={styles.detailText}>
                      Duration: {item.duration}s
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons
                      name={item.audioPlayed ? "volume-high" : "volume-mute"}
                      size={14}
                      color={item.audioPlayed ? "#00E5FF" : "#9CA3AF"}
                    />
                    <Text style={[styles.detailText, item.audioPlayed && { color: '#00E5FF', fontWeight: '600' }]}>
                      {item.audioPlayed ? 'Audio Broadcast Played' : 'Audio Not Played'}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            )}
          />
        )}
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
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
    elevation: 3,
  },
  exportText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 13,
  },
  pickerWrapper: {
    marginBottom: 16,
    height: 44,
  },
  pickerScroll: {
    gap: 8,
    paddingRight: 16,
  },
  pickerItem: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  pickerItemActive: {
    backgroundColor: '#1E293B',
    borderColor: '#00E5FF',
  },
  pickerText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
  pickerTextActive: {
    color: '#00E5FF',
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    gap: 12,
    paddingBottom: 100,
  },
  logCard: {
    backgroundColor: '#111827',
    padding: 14,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  logPhone: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 10,
  },
  logDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
});
