import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db } from '../firebase';

const SUPER_ADMINS = ['samuel.alalade@ttu.edu', 'alaladesambluez@gmail.com'];

export default function UserManagement({ currentUser, onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'authorized_users'));
      const list = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });

      // Ensure super admins are represented
      SUPER_ADMINS.forEach(sa => {
        if (!list.some(u => u.email?.toLowerCase() === sa.toLowerCase())) {
          list.unshift({
            id: sa.toLowerCase(),
            email: sa,
            role: 'admin',
            added_by: 'system',
            added_at: 'Permanent Super Admin'
          });
        }
      });

      // Sort by email
      list.sort((a, b) => a.email.localeCompare(b.email));
      setUsers(list);
    } catch (err) {
      console.error("Error fetching authorized users:", err);
      // Fallback display if Firestore rules restrict direct read:
      setUsers(SUPER_ADMINS.map(sa => ({
        id: sa.toLowerCase(),
        email: sa,
        role: 'admin',
        added_by: 'system',
        added_at: 'Permanent Super Admin'
      })));
      setFeedback({ type: 'error', message: 'Unable to load full users list from Firestore. Ensure Firestore rules allow read.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFeedback({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    if (users.some(u => u.email?.toLowerCase() === cleanEmail)) {
      setFeedback({ type: 'error', message: `User '${cleanEmail}' is already authorized.` });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const userDoc = {
        email: cleanEmail,
        role: newRole,
        added_by: currentUser?.email || 'admin',
        added_at: new Date().toISOString()
      };

      // Use lowercased email as doc ID to prevent duplicates
      await setDoc(doc(db, 'authorized_users', cleanEmail), userDoc);

      setFeedback({ type: 'success', message: `Successfully added ${cleanEmail} as ${newRole}.` });
      setNewEmail('');
      setNewRole('user');
      await fetchUsers();
    } catch (err) {
      console.error("Error adding user:", err);
      setFeedback({ type: 'error', message: `Failed to add user: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveUser = async (emailToRemove) => {
    const cleanEmail = emailToRemove.toLowerCase();
    if (SUPER_ADMINS.includes(cleanEmail)) {
      alert("Permanent Super Admins cannot be removed.");
      return;
    }

    if (!window.confirm(`Are you sure you want to revoke access for ${emailToRemove}? They will no longer be able to log in.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'authorized_users', cleanEmail));
      setFeedback({ type: 'success', message: `Revoked access for ${emailToRemove}.` });
      await fetchUsers();
    } catch (err) {
      console.error("Error removing user:", err);
      setFeedback({ type: 'error', message: `Failed to remove user: ${err.message}` });
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Banner / Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
            👥 User Access Management
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
            Only email addresses registered here can log into the Crack Survey Manager.
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            ← Return to Survey
          </button>
        )}
      </div>

      {feedback && (
        <div style={{
          padding: '0.85rem 1.25rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          fontWeight: 500,
          background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
          color: feedback.type === 'success' ? '#166534' : '#991b1b',
          border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`
        }}>
          {feedback.type === 'success' ? '✅ ' : '⚠️ '}
          {feedback.message}
        </div>
      )}

      {/* Add User Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0',
        marginBottom: '2rem'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>
          ➕ Authorize New User
        </h3>
        <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 250px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              User Email Address
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="e.g. colleague@ttu.edu"
              required
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ flex: '1 1 160px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Access Role
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                background: '#ffffff',
                boxSizing: 'border-box'
              }}
            >
              <option value="user">User / Viewer</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              height: '40px',
              whiteSpace: 'nowrap'
            }}
          >
            {isSubmitting ? 'Adding…' : 'Add User'}
          </button>
        </form>
      </div>

      {/* Users List Table Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>
            Authorized Users ({users.length})
          </h3>
          <button
            onClick={fetchUsers}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            Loading authorized users…
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.85rem 1.5rem' }}>Email</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Role</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Added By</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Date Added</th>
                  <th style={{ padding: '0.85rem 1.5rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isSuper = SUPER_ADMINS.includes(u.email?.toLowerCase());
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: '#0f172a' }}>
                        {u.email}
                        {isSuper && (
                          <span style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '999px',
                            background: '#dbeafe',
                            color: '#1e40af',
                            fontWeight: 700
                          }}>
                            SUPER ADMIN
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem 1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: u.role === 'admin' ? '#eff6ff' : '#f1f5f9',
                          color: u.role === 'admin' ? '#2563eb' : '#475569'
                        }}>
                          {u.role === 'admin' ? 'Administrator' : 'Viewer / User'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                        {u.added_by || 'system'}
                      </td>
                      <td style={{ padding: '1rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                        {u.added_at && u.added_at.includes('T')
                          ? new Date(u.added_at).toLocaleDateString()
                          : u.added_at || '—'}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        {isSuper ? (
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            Protected
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRemoveUser(u.email)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              border: '1px solid #fecaca',
                              background: '#fff',
                              color: '#dc2626',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; }}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
