import { useState, useEffect } from 'react'
import { getContacts, createContact, updateContact, deleteContact } from '../services/api'
import type { Contact } from '../types'

function ContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    tier: 'secondary' as 'primary' | 'secondary',
    priority: 1,
  })

  useEffect(() => {
    fetchContacts()
  }, [])

  const fetchContacts = async () => {
    try {
      const data = await getContacts()
      setContacts(data)
    } catch (e) {
      console.error('Fetch contacts error:', e)
    } finally {
      setLoading(false)
    }
  }

  const openForm = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact)
      setFormData({ name: contact.name, phone: contact.phone, tier: contact.tier, priority: contact.priority })
    } else {
      setEditingContact(null)
      setFormData({ name: '', phone: '', tier: 'secondary', priority: contacts.length + 1 })
    }
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingContact(null)
    setFormData({ name: '', phone: '', tier: 'secondary', priority: contacts.length + 1 })
  }

  const saveContact = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      alert('Name and phone are required')
      return
    }

    try {
      if (editingContact) {
        await updateContact(editingContact.id, formData)
        alert('Contact updated')
      } else {
        await createContact(formData)
        alert('Contact added')
      }
      closeForm()
      fetchContacts()
    } catch (e) {
      alert('Error: ' + (e instanceof Error ? e.message : 'Failed to save contact'))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contact?')) return
    try {
      await deleteContact(id)
      fetchContacts()
    } catch (e) {
      alert('Error: Failed to delete contact')
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Trusted Contacts</h2>
        <button style={styles.addBtn} onClick={() => openForm()}>+ Add</button>
      </div>

      {loading ? (
        <div style={styles.loading}>Loading...</div>
      ) : contacts.length === 0 ? (
        <div style={styles.empty}>
          <p>No contacts yet</p>
          <p style={{ color: '#666', fontSize: '14px' }}>Add at least one primary contact for emergency alerts</p>
          <button style={styles.addBtn} onClick={() => openForm()}>Add First Contact</button>
        </div>
      ) : (
        <div style={styles.list}>
          {contacts.map(contact => (
            <div key={contact.id} style={styles.contactCard}>
              <div style={styles.contactInfo}>
                <span style={contact.tier === 'primary' ? styles.tierBadgePrimary : styles.tierBadgeSecondary}>
                  {contact.tier.toUpperCase()}
                </span>
                <div>
                  <p style={styles.contactName}>{contact.name}</p>
                  <p style={styles.contactPhone}>{contact.phone}</p>
                </div>
                <span style={styles.priority}>Priority: {contact.priority}</span>
              </div>
              <div style={styles.actions}>
                <button onClick={() => openForm(contact)} style={styles.editBtn}>Edit</button>
                <button onClick={() => handleDelete(contact.id)} style={styles.deleteBtn}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={styles.modalOverlay} onClick={closeForm}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>{editingContact ? 'Edit Contact' : 'Add Contact'}</h3>
              <button onClick={closeForm} style={styles.closeBtn}>✕</button>
            </div>
            <input style={styles.input} placeholder="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} autoCapitalize="words" />
            <input style={styles.input} placeholder="Phone (E.164: +91XXXXXXXXXX)" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} type="tel" />
            <div style={styles.tierSelector}>
              <label style={styles.tierLabel}>Tier</label>
              <div style={styles.tierButtons}>
                {['primary', 'secondary'].map(t => (
                  <button
                    key={t}
                    style={formData.tier === t ? styles.tierBtnSelected : styles.tierBtn}
                    onClick={() => setFormData({ ...formData, tier: t as 'primary' | 'secondary' })}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div style={styles.priorityInput}>
              <label style={styles.tierLabel}>Priority (lower = notified first)</label>
              <input style={styles.input} type="number" value={formData.priority} onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })} />
            </div>
            <button style={styles.saveBtn} onClick={saveContact}>
              {editingContact ? 'Save Changes' : 'Add Contact'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '20px', maxWidth: '600px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  addBtn: { padding: '8px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600' },
  loading: { textAlign: 'center', padding: '40px', color: '#666' },
  empty: { textAlign: 'center', padding: '40px' },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  contactCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#fafafa', borderRadius: '8px', border: '1px solid #eee' },
  contactInfo: { display: 'flex', alignItems: 'center', gap: '12px' },
  tierBadgePrimary: { padding: '4px 10px', borderRadius: '12px', color: '#fff', fontSize: '11px', fontWeight: 'bold', background: '#1976d2' },
  tierBadgeSecondary: { padding: '4px 10px', borderRadius: '12px', color: '#fff', fontSize: '11px', fontWeight: 'bold', background: '#f57f17' },
  contactName: { fontWeight: '600', margin: 0, color: '#333' },
  contactPhone: { fontSize: '13px', color: '#666', margin: '2px 0 0' },
  priority: { fontSize: '12px', color: '#888', fontFamily: 'monospace' },
  actions: { display: 'flex', gap: '8px' },
  editBtn: { padding: '6px 12px', background: '#e3f2fd', color: '#1976d2', border: 'none', borderRadius: '6px', fontSize: '13px' },
  deleteBtn: { padding: '6px 12px', background: '#fdeaea', color: '#c62828', border: 'none', borderRadius: '6px', fontSize: '13px' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
  modal: { background: '#fff', borderRadius: '16px', padding: '20px', width: '90%', maxWidth: '400px', maxHeight: '80vh', overflow: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  closeBtn: { fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#666' },
  input: { width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px' },
  tierLabel: { fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' },
  tierSelector: { marginBottom: '16px' },
  tierButtons: { display: 'flex', gap: '8px' },
  tierBtn: { flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '8px', background: '#fafafa', fontWeight: '500' },
  tierBtnSelected: { borderColor: '#1976d2', background: '#e3f2fd', color: '#1976d2' },
  priorityInput: { marginBottom: '16px' },
  saveBtn: { width: '100%', padding: '12px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '16px' },
}

export default ContactsScreen