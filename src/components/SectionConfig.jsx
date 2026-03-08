import React, { useState, useEffect } from 'react';

const SectionConfig = ({ sections, onSave }) => {
    const [localSections, setLocalSections] = useState(sections || []);
    const [saving, setSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState('');

    // Sync when parent data reloads (e.g., after fetchData)
    useEffect(() => {
        setLocalSections(sections || []);
    }, [sections]);

    const addSection = () => {
        const nextId = localSections.length > 0
            ? Math.max(...localSections.map(s => s.id)) + 1
            : 0;
        const start = localSections.length > 0
            ? localSections[localSections.length - 1].end_station
            : 0;
        setLocalSections([...localSections, {
            id: nextId,
            name: `Section ${nextId}`,
            start_station: start,
            end_station: start + 100
        }]);
    };

    const deleteSection = (index) => {
        const updated = localSections.filter((_, i) => i !== index);
        setLocalSections(updated);
    };

    const updateSection = (index, field, value) => {
        const updated = [...localSections];
        // Name stays a string; station fields are numeric
        if (field === 'name') {
            updated[index][field] = value;
        } else {
            const parsed = parseFloat(value);
            updated[index][field] = isNaN(parsed) ? 0 : parsed;
        }
        setLocalSections(updated);
    };

    const handleSave = async () => {
        setSaving(true);
        setSavedMsg('');
        try {
            await onSave(localSections);
            setSavedMsg('Saved!');
        } catch (e) {
            setSavedMsg('Error saving.');
        } finally {
            setSaving(false);
            setTimeout(() => setSavedMsg(''), 3000);
        }
    };

    const totalSpan = localSections.length > 0
        ? localSections[localSections.length - 1].end_station
        : 0;

    return (
        <div className="card">
            <h2 className="title">Section Management</h2>
            <p>Total Project Span: <strong>{totalSpan} ft</strong></p>
            {localSections.map((sec, idx) => (
                <div
                    key={sec.id ?? idx}
                    style={{
                        marginBottom: '1rem',
                        borderBottom: '1px solid #eee',
                        paddingBottom: '1rem',
                        position: 'relative'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#555' }}>Section {idx + 1}</strong>
                        <button
                            onClick={() => deleteSection(idx)}
                            style={{
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '2px 10px',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                            }}
                        >
                            Delete
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                        <div>
                            <label>Name</label>
                            <input
                                value={sec.name}
                                onChange={(e) => updateSection(idx, 'name', e.target.value)}
                                type="text"
                            />
                        </div>
                        <div>
                            <label>Start Station</label>
                            <input
                                value={sec.start_station}
                                onChange={(e) => updateSection(idx, 'start_station', e.target.value)}
                                type="number"
                            />
                        </div>
                        <div>
                            <label>End Station</label>
                            <input
                                value={sec.end_station}
                                onChange={(e) => updateSection(idx, 'end_station', e.target.value)}
                                type="number"
                            />
                        </div>
                    </div>
                </div>
            ))}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button onClick={addSection}>+ Add Section</button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{ background: '#10b981', opacity: saving ? 0.7 : 1 }}
                >
                    {saving ? 'Saving...' : 'Save Configuration'}
                </button>
                {savedMsg && (
                    <span style={{ color: savedMsg === 'Saved!' ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                        {savedMsg}
                    </span>
                )}
            </div>
        </div>
    );
};

export default SectionConfig;
