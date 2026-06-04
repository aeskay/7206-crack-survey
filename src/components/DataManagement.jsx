import React, { useRef, useState } from 'react';

const DataManagement = ({ activeProject, onImportComplete }) => {
    const fileInputRef = useRef(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8080';

    const handleExport = async () => {
        try {
            setIsExporting(true);
            const res = await fetch(`${API_BASE}/projects/${activeProject.id}/export`);
            if (!res.ok) throw new Error("Failed to export data");
            
            const data = await res.json();
            
            // Format date for filename
            const dateStr = new Date().toISOString().split('T')[0];
            const safeName = activeProject.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `${safeName}_backup_${dateStr}.json`;
            
            // Trigger download
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Export error:", err);
            alert("An error occurred during export.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm(`Are you sure you want to restore from this backup?\n\nWARNING: This will completely WIPE and REPLACE all existing sections, survey days, and cracks in the project "${activeProject.name}". This action cannot be undone.`)) {
            e.target.value = ''; // Reset input
            return;
        }

        try {
            setIsImporting(true);
            const text = await file.text();
            const jsonData = JSON.parse(text);

            const res = await fetch(`${API_BASE}/projects/${activeProject.id}/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jsonData)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Failed to import data");
            }

            alert("Backup restored successfully!");
            if (onImportComplete) {
                onImportComplete();
            }
        } catch (err) {
            console.error("Import error:", err);
            alert(`An error occurred during import: ${err.message}`);
        } finally {
            setIsImporting(false);
            e.target.value = ''; // Reset input
        }
    };

    return (
        <div style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '2rem',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0'
        }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💾 Data Management
            </h2>
            <p style={{ color: '#64748b', marginBottom: '2rem', lineHeight: 1.6 }}>
                Export your project data as a backup or for offline analysis. You can also restore a project from a previously exported backup file. Restoring will overwrite the current project's data.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                
                {/* Export Card */}
                <div style={{
                    padding: '1.5rem',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>Export Backup</h3>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem', flex: 1 }}>
                        Download a complete JSON backup containing all sections, survey days, and cracks for this project.
                    </p>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        style={{
                            background: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            padding: '0.75rem',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: isExporting ? 'not-allowed' : 'pointer',
                            opacity: isExporting ? 0.7 : 1,
                            transition: 'all 0.2s',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        {isExporting ? 'Exporting...' : '⬇️ Download Backup'}
                    </button>
                </div>

                {/* Import Card */}
                <div style={{
                    padding: '1.5rem',
                    background: '#fff1f2',
                    borderRadius: '12px',
                    border: '1px solid #fecdd3',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#9f1239', marginBottom: '0.5rem' }}>Restore Backup</h3>
                    <p style={{ color: '#be123c', fontSize: '0.9rem', marginBottom: '1.5rem', flex: 1 }}>
                        Upload a previously exported JSON backup. <strong>Warning:</strong> This will completely overwrite this project's current data.
                    </p>
                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                    <button
                        onClick={handleImportClick}
                        disabled={isImporting}
                        style={{
                            background: '#e11d48',
                            color: '#ffffff',
                            border: 'none',
                            padding: '0.75rem',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: isImporting ? 'not-allowed' : 'pointer',
                            opacity: isImporting ? 0.7 : 1,
                            transition: 'all 0.2s',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        {isImporting ? 'Restoring...' : '⬆️ Upload Backup'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default DataManagement;
