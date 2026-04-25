import React, { useRef } from 'react';

function DataManagement({ projectId, projectData, onImportComplete, apiBase }) {
    const fileInputRef = useRef(null);

    const handleDownload = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `project_${projectId}_backup.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleUploadClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const uploadedData = JSON.parse(event.target.result);
                
                // Basic validation
                if (!uploadedData.sections || !uploadedData.survey_days || !uploadedData.cracks) {
                    alert("Invalid backup file format. Missing core data structures.");
                    return;
                }

                const confirmed = window.confirm(
                    "⚠️ WARNING: This will permanently DELETE and OVERWRITE all existing data for this project. Are you absolutely sure you want to proceed?"
                );

                if (!confirmed) {
                    e.target.value = null; // reset input
                    return;
                }

                const res = await fetch(`${apiBase}/projects/${projectId}/import`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(uploadedData)
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.detail || 'Failed to import backup');
                }

                alert("Backup restored successfully!");
                if (onImportComplete) {
                    onImportComplete();
                }

            } catch (err) {
                console.error("Import error:", err);
                alert("Error importing backup: " + err.message);
            } finally {
                e.target.value = null; // reset input
            }
        };
        reader.readAsText(file);
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Data Management</h2>
            <p style={{ color: '#64748b', marginBottom: '2rem', lineHeight: 1.5 }}>
                Use these tools to backup your current project data to a file, or restore a project from a previous backup. 
                Please note that restoring a backup will permanently overwrite all existing data in this project.
            </p>

            <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div style={{ flex: 1, padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#334155', marginBottom: '0.5rem' }}>Download Backup</h3>
                    <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem' }}>Save a copy of your project data to your computer.</p>
                    <button 
                        onClick={handleDownload}
                        style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s', width: '100%' }}
                    >
                        ⬇️ Download Backup
                    </button>
                </div>

                <div style={{ flex: 1, padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#334155', marginBottom: '0.5rem' }}>Upload Backup</h3>
                    <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem' }}>Restore your project data from a backup file.</p>
                    <input 
                        type="file" 
                        accept=".json" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        onChange={handleFileChange} 
                    />
                    <button 
                        onClick={handleUploadClick}
                        style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s', width: '100%' }}
                    >
                        ⬆️ Upload Backup
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DataManagement;
