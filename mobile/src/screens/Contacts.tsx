import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, TouchableOpacity, Modal, FlatList } from 'react-native';
import { BASE_URL } from '../services/config';

type Contact = {
  id: string;
  name: string;
  phone: string;
  tier: 'primary' | 'secondary';
  priority: number;
};

export default function Contacts({ route, navigation }: any) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', tier: 'secondary' as 'primary' | 'secondary', priority: 1 });

  const fetchContacts = async () => {
    try {
      const res = await fetch(`${BASE_URL}/contacts`, {
        headers: { 'Authorization': 'test_user_id' },
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch (e) {
      console.error('Fetch contacts error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, []);

  const openAddModal = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({ name: contact.name, phone: contact.phone, tier: contact.tier, priority: contact.priority });
    } else {
      setEditingContact(null);
      setFormData({ name: '', phone: '', tier: 'secondary', priority: contacts.length + 1 });
    }
    setShowAddModal(true);
  };

  const saveContact = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      Alert.alert('Error', 'Name and phone are required');
      return;
    }

    try {
      const method = editingContact ? 'PUT' : 'POST';
      const url = editingContact ? `${BASE_URL}/contacts/${editingContact.id}` : `${BASE_URL}/contacts`;
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'test_user_id' },
        body: JSON.stringify(formData),
      });
      
      Alert.alert('Success', editingContact ? 'Contact updated' : 'Contact added');
      setShowAddModal(false);
      fetchContacts();
    } catch (e) {
      Alert.alert('Error', 'Failed to save contact');
    }
  };

  const deleteContact = async (id: string) => {
    Alert.alert('Delete Contact', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${BASE_URL}/contacts/${id}`, { method: 'DELETE', headers: { 'Authorization': 'test_user_id' } });
            fetchContacts();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete contact');
          }
        }
      },
    ]);
  };

  const renderContact = ({ item }: { item: Contact }) => (
    <TouchableOpacity style={styles.contactCard} onPress={() => openAddModal(item)}>
      <View style={styles.contactInfo}>
        <View style={[
          styles.tierBadge, 
          { backgroundColor: item.tier === 'primary' ? '#1976d2' : '#f57f17' }
        ]}>
          <Text style={styles.tierText}>{item.tier.toUpperCase()}</Text>
        </View>
        <View style={styles.contactDetails}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactPhone}>{item.phone}</Text>
        </View>
        <Text style={styles.priority}>Priority: {item.priority}</Text>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteContact(item.id)}>
        <Text style={styles.deleteBtnText}>Delete</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trusted Contacts</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openAddModal()} activeOpacity={0.7}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}><Text>Loading...</Text></View>
      ) : contacts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No contacts yet</Text>
          <Text style={styles.emptySubtext}>Add at least one primary contact for emergency alerts</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => openAddModal()} activeOpacity={0.7}>
            <Text style={styles.emptyBtnText}>Add First Contact</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={item => item.id}
          renderItem={renderContact}
          contentContainerStyle={styles.list}
          ListEmptyComponent={() => <View style={styles.empty}><Text>No contacts</Text></View>}
        />
      )}

      <Modal visible={showAddModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay} onTouchStart={() => setShowAddModal(false)}>
          <View style={styles.modalContent} onTouchStart={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingContact ? 'Edit Contact' : 'Add Contact'}</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={formData.name}
              onChangeText={v => setFormData({ ...formData, name: v })}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Phone (E.164 format: +91XXXXXXXXXX)"
              value={formData.phone}
              onChangeText={v => setFormData({ ...formData, phone: v })}
              keyboardType="phone-pad"
            />
            <View style={styles.tierSelector}>
              <Text style={styles.tierLabel}>Tier</Text>
              <View style={styles.tierButtons}>
                {['primary', 'secondary'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.tierBtn,
                      formData.tier === t && styles.tierBtnSelected
                    ]}
                    onPress={() => setFormData({ ...formData, tier: t as 'primary' | 'secondary' })}
                  >
                    <Text style={[
                      styles.tierBtnText,
                      formData.tier === t && styles.tierBtnTextSelected
                    ]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.priorityInput}>
              <Text style={styles.tierLabel}>Priority (lower = notified first)</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                value={String(formData.priority)}
                onChangeText={v => setFormData({ ...formData, priority: parseInt(v) || 1 })}
                keyboardType="numeric"
              />
            </View>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={saveContact}
              activeOpacity={0.7}
            >
              <Text style={styles.saveBtnText}>{editingContact ? 'Save Changes' : 'Add Contact'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 20, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#1976d2', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  addBtnText: { color: 'white', fontWeight: '600' },
  list: { padding: 16 },
  contactCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fafafa', borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  contactInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tierText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
  contactDetails: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: '600', color: '#333' },
  contactPhone: { fontSize: 13, color: '#666', marginTop: 2 },
  priority: { fontSize: 12, color: '#888', fontFamily: 'monospace' },
  deleteBtn: { padding: 8 },
  deleteBtnText: { color: '#d32f2f', fontSize: 13 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { color: '#666', textAlign: 'center', marginBottom: 16 },
  emptyBtn: { backgroundColor: '#1976d2', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginTop: 8 },
  emptyBtnText: { color: 'white', fontWeight: '600', fontSize: 16 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  closeBtn: { fontSize: 24, color: '#666' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  tierLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  tierSelector: { marginBottom: 16 },
  tierButtons: { flexDirection: 'row', gap: 8 },
  tierBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', backgroundColor: '#fafafa' },
  tierBtnSelected: { borderColor: '#1976d2', backgroundColor: '#e3f2fd' },
  tierBtnText: { fontSize: 14, color: '#444' },
  tierBtnTextSelected: { color: '#1976d2', fontWeight: 'bold' },
  priorityInput: { marginBottom: 16 },
  saveBtn: { backgroundColor: '#1976d2', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: 'white', fontWeight: '600', fontSize: 16 },
});