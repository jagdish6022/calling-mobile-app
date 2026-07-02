import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CallingAppModule from '@/modules/calling-app-module/src/CallingAppModule';
import GlassCard from '@/components/GlassCard';

export default function NewCampaignScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [delay, setDelay] = useState('10');
  const [retry, setRetry] = useState('2');

  // Load default settings to populate the form
  useEffect(() => {
    CallingAppModule.getSettings()
      .then((settings) => {
        if (settings) {
          setDelay(settings.delayBetweenCalls.toString());
          setRetry(settings.retryCount.toString());
        }
      })
      .catch((err) => console.log('Error loading default settings', err));
  }, []);

  const handleSave = async () => {
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
      const campaign = await CallingAppModule.createCampaign(name, delayVal, retryVal);
      // Navigate to campaign detail screen to add contacts and record audio
      router.replace(`/campaign/${campaign.campaignId}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to create campaign');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Campaign</Text>
        </View>

        <GlassCard style={styles.formCard}>
          <Text style={styles.label}>Campaign Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Diwali Promo, Customer Alert"
            placeholderTextColor="#6B7280"
            value={name}
            onChangeText={setName}
            maxLength={50}
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Delay between calls (s)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={delay}
                onChangeText={setDelay}
                maxLength={4}
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Retry Count</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={retry}
                onChangeText={setRetry}
                maxLength={2}
              />
            </View>
          </View>

          <Text style={styles.note}>
            Note: You can record custom audio and import contacts in the next screen after saving.
          </Text>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Create & Proceed</Text>
            <Ionicons name="arrow-forward" size={18} color="#000" />
          </TouchableOpacity>
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
  container: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
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
  formCard: {
    backgroundColor: '#111827',
    padding: 20,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1F2937',
    color: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  col: {
    flex: 1,
  },
  note: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 24,
    fontStyle: 'italic',
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
