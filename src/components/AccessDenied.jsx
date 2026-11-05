import React from 'react';
import { auth, signOut } from '../firebase';

export default function AccessDenied({ userEmail, onSignOut }) {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      if (onSignOut) onSignOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      padding: '1.5rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        padding: '2.5rem 2rem',
        textAlign: 'center'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#fee2e2',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          margin: '0 auto 1.25rem auto'
        }}>
          🚫
        </div>

        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>
          Access Restricted
        </h2>

        <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
          Your account <strong style={{ color: '#0f172a' }}>{userEmail}</strong> is signed in, but has not been added to the authorized access list for this application.
        </p>

        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1.75rem',
          textAlign: 'left',
          fontSize: '0.85rem',
          color: '#334155'
        }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: '#0f172a' }}>
            Need Access?
          </div>
          Please contact the project administrator to request authorization:
          <div style={{ marginTop: '0.4rem', fontWeight: 600, color: '#2563eb' }}>
            ✉️ samuel.alalade@ttu.edu
          </div>
        </div>

        <button
          onClick={handleSignOut}
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '8px',
            border: 'none',
            background: '#334155',
            color: '#ffffff',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#1e293b'}
          onMouseOut={(e) => e.currentTarget.style.background = '#334155'}
        >
          Sign Out / Use Different Account
        </button>
      </div>
    </div>
  );
}
