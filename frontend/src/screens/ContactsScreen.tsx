import { useCallback, useEffect, useState } from 'react'
import { getContacts, createContact, updateContact, deleteContact } from '../services/api'
import { Modal, Spinner, EmptyState } from '../components/ui'
import { IconPlus, IconStar, IconPerson, IconPencil, IconTrash, IconSave, IconUsers } from '../components/Icons'
import type { Contact } from '../types'

const EMPTY = { name: '', phone: '', tier: 'secondary' as 'primary' | 'secondary', priority: 1 }

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<Contact[] | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setContacts(await getContacts()) } catch { setContacts([]) }
  }, [])
  useEffect(() => { load() }, [load])

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModalOpen(true) }
  const openEdit = (c: Contact) => {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone, tier: c.tier, priority: c.priority })
    setModalOpen(true)
  }

  const save = async () => {
    setError('')
    if (!form.name.trim() || !form.phone.trim()) { setError('Name and phone are required'); return }
    if (!/^\+?[0-9]{7,15}$/.test(form.phone.replace(/[\s-]/g, ''))) {
      setError('Phone must be E.164-ish, e.g. +919876543210')
      return
    }
    try {
      if (editing) await updateContact(editing.id, form)
      else await createContact(form)
      setModalOpen(false)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save contact')
    }
  }

  const remove = async (id: string) => {
    try { await deleteContact(id); load() } catch { /* ignore */ }
  }

  if (contacts === null) return <Spinner />

  return (
    <>
      <div className="row-between mb-2">
        <p className="muted">Primary contacts get a soft heads-up at L2. Everyone is alerted at L3+.</p>
        <button className="clay-btn" onClick={openAdd}><IconPlus size={17} /> Add contact</button>
      </div>

      {contacts.length === 0 ? (
        <EmptyState icon={<IconUsers size={30} color="var(--ink-faint)" />} text="No trusted contacts yet — add one so alerts can reach someone." />
      ) : (
        <div className="grid grid-2">
          {contacts.map(c => (
            <div key={c.id} className="clay card">
              <div className="row-between">
                <div className="row">
                  <div className="stat-ico">
                    {c.tier === 'primary' ? <IconStar size={22} color="#14496B" /> : <IconPerson size={22} color="#14496B" />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{c.name}</div>
                    <div className="tiny">{c.phone}</div>
                  </div>
                </div>
                <span className={`badge ${c.tier === 'primary' ? 'safe' : 'neutral'}`}>{c.tier}</span>
              </div>
              <div className="row mt-2">
                <span className="tiny grow">Priority {c.priority}</span>
                <button className="clay-btn ghost" style={{ padding: '7px 14px' }} onClick={() => openEdit(c)}>
                  <IconPencil size={15} /> Edit
                </button>
                <button className="clay-btn danger" style={{ padding: '7px 12px' }} onClick={() => remove(c.id)} aria-label="Delete contact">
                  <IconTrash size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit contact' : 'Add trusted contact'}>
        <label className="clay-label">Name</label>
        <input className="clay-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Mom" />
        <label className="clay-label mt-2">Phone (E.164)</label>
        <input className="clay-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+919876543210" />
        <label className="clay-label mt-2">Tier</label>
        <div className="row">
          {(['primary', 'secondary'] as const).map(t => (
            <button key={t} className={`chip${form.tier === t ? ' active' : ''}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setForm({ ...form, tier: t })}>
              {t === 'primary' ? <><IconStar size={15} /> Primary</> : <><IconPerson size={15} /> Secondary</>}
            </button>
          ))}
        </div>
        <label className="clay-label mt-2">Priority</label>
        <input className="clay-input" type="number" min={1} max={9} value={form.priority}
          onChange={e => setForm({ ...form, priority: Number(e.target.value) || 1 })} />
        {error && <div className="error-note">{error}</div>}
        <button className="clay-btn mt-2" style={{ width: '100%' }} onClick={save}>
          {editing ? <><IconSave size={17} /> Save changes</> : <><IconPlus size={17} /> Add contact</>}
        </button>
      </Modal>
    </>
  )
}
