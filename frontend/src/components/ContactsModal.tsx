import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface Contact {
  id: string;
  name: string;
  phone: string;
  createdAt: Timestamp;
}

const ContactsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'add' | 'view'>('add');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'view') {
      fetchContacts();
    }
  }, [isOpen, activeTab]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'contacts'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const contactsData: Contact[] = [];
      querySnapshot.forEach((doc) => {
        contactsData.push({ id: doc.id, ...doc.data() } as Contact);
      });
      setContacts(contactsData);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    try {
      setLoading(true);
      if (editingContact) {
        await updateDoc(doc(db, 'contacts', editingContact.id), {
          name: formData.name,
          phone: formData.phone
        });
        setEditingContact(null);
      } else {
        await addDoc(collection(db, 'contacts'), {
          name: formData.name,
          phone: formData.phone,
          createdAt: Timestamp.now()
        });
      }
      setFormData({ name: '', phone: '' });
      if (activeTab === 'view') {
        fetchContacts();
      }
    } catch (error) {
      console.error('Error saving contact:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (contact: Contact) => {
    setFormData({ name: contact.name, phone: contact.phone });
    setEditingContact(contact);
    setActiveTab('add');
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'contacts', id));
      fetchContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold">Contacts</h2>
          <button
            onClick={onClose}
            className="text-sm font-medium border px-3 py-1 rounded hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => {
              setActiveTab('add');
              setEditingContact(null);
              setFormData({ name: '', phone: '' });
            }}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === 'add'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Add
          </button>
          <button
            onClick={() => {
              setActiveTab('view');
              setEditingContact(null);
              setFormData({ name: '', phone: '' });
              fetchContacts();
            }}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === 'view'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            View
          </button>
        </div>

        <div className="px-6 py-4">
          {activeTab === 'add' ? (
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2 bg-blue-500 text-white font-medium rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : editingContact ? 'Update' : 'Add Contact'}
                </button>
                {editingContact && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingContact(null);
                      setFormData({ name: '', phone: '' });
                    }}
                    className="w-full px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No contacts found</div>
              ) : (
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <div>
                        <div className="font-medium">{contact.name}</div>
                        <div className="text-sm text-gray-500">{contact.phone}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(contact)}
                          className="p-2 text-blue-500 hover:bg-blue-100 rounded-full"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-full"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactsModal;
