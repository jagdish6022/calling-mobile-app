import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import CallingAppModule, { Contact } from '@/modules/calling-app-module/src/CallingAppModule';
import GlassCard from '@/components/GlassCard';
import StatusBadge from '@/components/StatusBadge';

export default function ContactsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const campaignId = id ? parseInt(id as string) : NaN;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Manual contact modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadContacts = async () => {
    if (isNaN(campaignId)) return;
    try {
      const list = await CallingAppModule.getContacts(campaignId);
      setContacts(list);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isNaN(campaignId)) {
      loadContacts();
    }
  }, [campaignId]);

  const handleAddManual = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Validation Error', 'Please fill in both name and phone number');
      return;
    }

    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      Alert.alert('Validation Error', 'Please enter a valid phone number (7 to 15 digits)');
      return;
    }

    // Check duplicate in list
    const isDup = contacts.some(c => c.phoneNumber.replace(/\D/g, '') === digitsOnly);
    if (isDup) {
      Alert.alert('Duplicate Contact', 'This phone number already exists in the campaign.');
      return;
    }

    try {
      setSubmitting(true);
      await CallingAppModule.addContact(campaignId, name.trim(), digitsOnly);
      setName('');
      setPhone('');
      setModalVisible(false);
      loadContacts();
    } catch (e) {
      Alert.alert('Error', 'Failed to add contact');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (contactId: number) => {
    Alert.alert('Delete Contact', 'Are you sure you want to remove this contact?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await CallingAppModule.deleteContact(contactId);
            loadContacts();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete contact');
          }
        }
      }
    ]);
  };

  const handleImportCsv = async () => {
    try {
      const doc = await DocumentPicker.getDocumentAsync({
        type: ['text/comma-separated-values', 'text/csv', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true
      });

      if (doc.canceled || !doc.assets || doc.assets.length === 0) {
        return;
      }

      setLoading(true);
      const uri = doc.assets[0].uri;

      // Pass URI to native Kotlin importer
      const count = await CallingAppModule.importContactsCsv(uri, campaignId);
      Alert.alert('Import Summary', `Successfully imported ${count} unique contacts!`);
      loadContacts();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to parse CSV file');
      setLoading(false);
    }
  };

  // Filter contacts based on search query
  const filteredContacts = contacts.filter((c) =>
    c.customerName.toLowerCase().includes(search.toLowerCase()) ||
    c.phoneNumber.includes(search)
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace({ pathname: '/campaign/[id]', params: { id: campaignId.toString() } })}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Campaign Contacts</Text>
            <Text style={styles.headerSub}>Manage & Import</Text>
          </View>
        </View>

        {/* Action controls card */}
        <GlassCard style={styles.actionCard}>
          <TouchableOpacity style={styles.importBtn} onPress={handleImportCsv}>
            <Ionicons name="cloud-upload-outline" size={20} color="#000" />
            <Text style={styles.importBtnText}>Import CSV List</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Ionicons name="add" size={20} color="#00E5FF" />
            <Text style={styles.addBtnText}>Add Manually</Text>
          </TouchableOpacity>
        </GlassCard>

        {contacts.length === 0 && (
          <GlassCard style={styles.helpCard}>
            <Text style={styles.helpTitle}>📄 How to format your CSV sheet</Text>
            <Text style={styles.helpText}>
              Ensure your list is saved as a **CSV** file, and has a header row exactly like this:
            </Text>
            <View style={styles.table}>
              <View style={styles.tableRowHeader}>
                <Text style={styles.tableHeaderCell}>name</Text>
                <Text style={styles.tableHeaderCell}>phone</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>John Doe</Text>
                <Text style={styles.tableCell}>9876543210</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>Jane Smith</Text>
                <Text style={styles.tableCell}>9876543211</Text>
              </View>
            </View>
            <Text style={styles.helpNote}>
              * The app automatically filters out duplicate numbers and keeps only valid phone numbers.
            </Text>
          </GlassCard>
        )}

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name or number..."
            placeholderTextColor="#6B7280"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearch}>
              <Ionicons name="close" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Contacts list */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#00E5FF" />
          </View>
        ) : filteredContacts.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="people-outline" size={48} color="#4B5563" style={styles.emptyIcon} />
            <Text style={styles.emptyText}>
              {search.length > 0 ? 'No contacts found matching search.' : 'No contacts added to this campaign.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => item.contactId.toString()}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <GlassCard style={styles.contactItem}>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{item.customerName}</Text>
                  <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
                  {item.attempts > 0 && (
                    <Text style={styles.contactAttempts}>Attempts: {item.attempts}</Text>
                  )}
                </View>
                <View style={styles.contactActions}>
                  <StatusBadge status={item.status} />
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.contactId)}>
                    <Ionicons name="trash-outline" size={16} color="#FF5252" />
                  </TouchableOpacity>
                </View>
              </GlassCard>
            )}
          />
        )}

        {/* Add Manual Contact Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <GlassCard style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Contact</Text>
              
              <Text style={styles.label}>Customer Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. John Doe"
                placeholderTextColor="#6B7280"
                value={name}
                onChangeText={setName}
                maxLength={40}
              />

              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 9876543210"
                placeholderTextColor="#6B7280"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={15}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    setName('');
                    setPhone('');
                    setModalVisible(false);
                  }}
                  disabled={submitting}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalAddBtn}
                  onPress={handleAddManual}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.modalAddText}>Add Contact</Text>
                  )}
                </TouchableOpacity>
              </View>
            </GlassCard>
          </View>
        </Modal>
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
  actionCard: {
    backgroundColor: '#111827',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  importBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  importBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 13,
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
  },
  addBtnText: {
    color: '#00E5FF',
    fontWeight: '700',
    fontSize: 13,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    paddingVertical: 10,
    fontSize: 15,
  },
  clearSearch: {
    padding: 4,
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
    gap: 10,
    paddingBottom: 40,
  },
  contactItem: {
    backgroundColor: '#111827',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  contactPhone: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 2,
  },
  contactAttempts: {
    color: '#D500F9',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtn: {
    padding: 8,
    backgroundColor: '#3F161B',
    borderRadius: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#111827',
    padding: 20,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 20,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1F2937',
    color: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalCancelText: {
    color: '#B0B4BA',
    fontWeight: '700',
    fontSize: 14,
  },
  modalAddBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E5FF',
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalAddText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
  },
  helpCard: {
    backgroundColor: '#1E1B15',
    borderColor: '#FFA000',
    marginBottom: 20,
    padding: 16,
  },
  helpTitle: {
    color: '#FFA000',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  helpText: {
    color: '#FFD54F',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  table: {
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 10,
    overflow: 'hidden',
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  tableHeaderCell: {
    flex: 1,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    padding: 8,
    textAlign: 'center',
  },
  tableCell: {
    flex: 1,
    color: '#9CA3AF',
    fontSize: 12,
    padding: 8,
    textAlign: 'center',
  },
  helpNote: {
    color: '#9CA3AF',
    fontSize: 11,
    fontStyle: 'italic',
  },
});
