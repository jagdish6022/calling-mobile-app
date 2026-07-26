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
  Alert,
  useWindowDimensions
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

  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const pad = isTablet ? 32 : 16;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

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
      Alert.alert('Error', 'Could not load contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isNaN(campaignId)) { loadContacts(); }
  }, [campaignId]);

  const handleAddManual = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Missing Info', 'Please enter both a name and a phone number.');
      return;
    }
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid phone number between 7 and 15 digits.');
      return;
    }
    const isDup = contacts.some(c => c.phoneNumber.replace(/\D/g, '') === digitsOnly);
    if (isDup) {
      Alert.alert('Already Added', 'This phone number is already in your contacts list.');
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
      Alert.alert('Error', 'Could not add contact. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (contactId: number) => {
    Alert.alert(
      'Remove Contact',
      'Are you sure you want to remove this contact from the campaign?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await CallingAppModule.deleteContact(contactId);
              loadContacts();
            } catch (e) {
              Alert.alert('Error', 'Could not remove contact.');
            }
          }
        }
      ]
    );
  };

  const handleImportCsv = async () => {
    try {
      const doc = await DocumentPicker.getDocumentAsync({
        type: ['text/comma-separated-values', 'text/csv', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true
      });
      if (doc.canceled || !doc.assets || doc.assets.length === 0) return;
      setImporting(true);
      const uri = doc.assets[0].uri;
      const count = await CallingAppModule.importContactsCsv(uri, campaignId);
      Alert.alert('Import Complete ✅', `Successfully added ${count} contacts to this campaign!`);
      loadContacts();
    } catch (e) {
      Alert.alert('Import Failed', 'Could not read the file. Make sure it is a valid CSV file.');
      setLoading(false);
    } finally {
      setImporting(false);
    }
  };

  const filteredContacts = contacts.filter((c) =>
    c.customerName.toLowerCase().includes(search.toLowerCase()) ||
    c.phoneNumber.includes(search)
  );

  const pending = contacts.filter(c => c.status === 'PENDING').length;
  const done = contacts.filter(c => c.status === 'COMPLETED').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, { padding: pad }]}>
        <View style={[isTablet ? styles.tabletInner : undefined, { flex: 1 }]}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.replace({ pathname: '/campaign/[id]', params: { id: campaignId.toString() } })}
            >
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, isTablet && { fontSize: 28 }]}>
                Contacts ({contacts.length})
              </Text>
              <Text style={styles.headerSub}>
                {pending > 0 ? `${pending} waiting to be called` : done > 0 ? `${done} called successfully` : 'Add people to call'}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.importBtn, importing && { opacity: 0.7 }]}
              onPress={handleImportCsv}
              disabled={importing}
            >
              {importing ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={20} color="#000" />
                  <Text style={styles.importBtnText}>Upload CSV File</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
              <Ionicons name="person-add-outline" size={20} color="#00E5FF" />
              <Text style={styles.addBtnText}>Add One Person</Text>
            </TouchableOpacity>
          </View>

          {/* CSV Format Hint (shown when empty) */}
          {contacts.length === 0 && !loading && (
            <GlassCard style={styles.helpCard}>
              <Text style={styles.helpTitle}>📄 How to prepare your contacts file</Text>
              <Text style={styles.helpText}>
                Save your spreadsheet as a CSV file with a header row like this:
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
                  <Text style={styles.tableCell}>+919876543211</Text>
                </View>
              </View>
              <Text style={styles.helpNote}>
                ✓ Duplicates are automatically removed · Phone numbers can include country code
              </Text>
            </GlassCard>
          )}

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or phone number..."
              placeholderTextColor="#6B7280"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearch}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Contact List */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#00E5FF" />
              <Text style={styles.loadingText}>Loading contacts...</Text>
            </View>
          ) : filteredContacts.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="people-outline" size={56} color="#374151" />
              <Text style={styles.emptyTitle}>
                {search.length > 0 ? 'No results found' : 'No contacts yet'}
              </Text>
              <Text style={styles.emptyText}>
                {search.length > 0
                  ? 'Try searching by a different name or number.'
                  : 'Upload a CSV file or add contacts one by one using the buttons above.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.contactId.toString()}
              contentContainerStyle={[styles.list, isTablet && styles.tabletList]}
              numColumns={isTablet ? 2 : 1}
              key={isTablet ? 'tablet' : 'phone'}
              columnWrapperStyle={isTablet ? styles.columnWrapper : undefined}
              renderItem={({ item }) => (
                <GlassCard style={[styles.contactCard, isTablet && styles.contactCardTablet]}>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{item.customerName}</Text>
                    <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
                    {item.attempts > 0 && (
                      <Text style={styles.contactAttempts}>
                        Called {item.attempts} time{item.attempts > 1 ? 's' : ''}
                      </Text>
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
        </View>

        {/* Add Contact Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <GlassCard style={[styles.modalContent, isTablet && { maxWidth: 480, alignSelf: 'center', width: '100%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add a Contact</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={22} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Full Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Raj Patel"
                placeholderTextColor="#6B7280"
                value={name}
                onChangeText={setName}
                maxLength={50}
              />

              <Text style={styles.modalLabel}>Phone Number</Text>
              <TextInput
                style={styles.modalInput}
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
                  onPress={() => { setName(''); setPhone(''); setModalVisible(false); }}
                  disabled={submitting}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalAddBtn} onPress={handleAddManual} disabled={submitting}>
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
  safeArea: { flex: 1, backgroundColor: '#0A0A0C' },
  container: { flex: 1 },
  tabletInner: { maxWidth: 860, alignSelf: 'center', width: '100%' },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 10, gap: 12 },
  backBtn: { padding: 10, backgroundColor: '#1F2937', borderRadius: 12 },
  headerTitle: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  headerSub: { color: '#00E5FF', fontSize: 12, fontWeight: '600', marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  importBtn: {
    flex: 1, flexDirection: 'row', backgroundColor: '#00E5FF',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  importBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  addBtn: {
    flex: 1, flexDirection: 'row', borderWidth: 1.5, borderColor: '#00E5FF',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  addBtnText: { color: '#00E5FF', fontWeight: '700', fontSize: 14 },

  helpCard: { backgroundColor: '#1E1B15', borderColor: '#FFA000', marginBottom: 16, padding: 16 },
  helpTitle: { color: '#FFA000', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  helpText: { color: '#FFD54F', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  table: {
    backgroundColor: '#111827', borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)', marginBottom: 10, overflow: 'hidden',
  },
  tableRowHeader: { flexDirection: 'row', backgroundColor: '#1F2937', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  tableHeaderCell: { flex: 1, color: '#FFF', fontSize: 13, fontWeight: '700', padding: 10, textAlign: 'center' },
  tableCell: { flex: 1, color: '#9CA3AF', fontSize: 13, padding: 10, textAlign: 'center' },
  helpNote: { color: '#9CA3AF', fontSize: 12, fontStyle: 'italic' },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14, marginBottom: 16, minHeight: 50,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#FFF', paddingVertical: 12, fontSize: 15 },
  clearSearch: { padding: 4 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 10 },
  loadingText: { color: '#9CA3AF', fontSize: 14 },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  list: { gap: 10, paddingBottom: 60 },
  tabletList: { gap: 12 },
  columnWrapper: { gap: 12 },

  contactCard: { backgroundColor: '#111827', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  contactCardTablet: { flex: 1 },
  contactInfo: { flex: 1 },
  contactName: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  contactPhone: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
  contactAttempts: { color: '#D500F9', fontSize: 11, fontWeight: '600', marginTop: 4 },
  contactActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deleteBtn: { padding: 8, backgroundColor: '#3F161B', borderRadius: 8 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#111827', padding: 24, borderColor: 'rgba(255,255,255,0.1)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  modalCloseBtn: { padding: 4 },
  modalLabel: { color: '#9CA3AF', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  modalInput: {
    backgroundColor: '#1F2937', color: '#FFF', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#374151', paddingVertical: 14, borderRadius: 10,
  },
  modalCancelText: { color: '#B0B4BA', fontWeight: '700', fontSize: 15 },
  modalAddBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00E5FF', paddingVertical: 14, borderRadius: 10,
  },
  modalAddText: { color: '#000', fontWeight: '800', fontSize: 15 },
});
