import React, { useState, useMemo, useEffect } from 'react';

const DataEntry = ({ surveyDays, cracks, onUpload, onDelete, onUpdate, onUpdateDay, onDeleteDay, onAddDay, onBulkDelete, onReorderDays }) => {
    const [dayId, setDayId] = useState('');
    const [bulkData, setBulkData] = useState('');
    const [color, setColor] = useState('#2563eb');
    const [newDayName, setNewDayName] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [selected, setSelected] = useState(new Set());

    // Drag and drop ordering state
    const [draggedItemIndex, setDraggedItemIndex] = useState(null);
    const [dragOverItemIndex, setDragOverItemIndex] = useState(null);

    // Editable day name state
    const [editingDayName, setEditingDayName] = useState(false);
    const [dayNameValue, setDayNameValue] = useState('');

    const dayCracks = useMemo(() => {
        if (!dayId) return [];
        return cracks
            .filter(c => String(c.day_id) === String(dayId))
            .sort((a, b) => a.distance - b.distance);
    }, [cracks, dayId]);

    const selectedDay = surveyDays.find(d => String(d.id) === String(dayId));

    // When day changes, reset selection and day name edit, and sync color picker
    const handleDayChange = (e) => {
        setDayId(e.target.value);
        setSelected(new Set());
        setEditingDayName(false);
    };

    // Sync color picker to selected day's color whenever the day changes
    useEffect(() => {
        if (selectedDay) setColor(selectedDay.color);
    }, [selectedDay?.id]);

    const handleUpload = async () => {
        if (!dayId) return;
        const distances = bulkData
            .split(/[\n,]+/)
            .map(v => parseFloat(v.trim()))
            .filter(v => !isNaN(v));
        if (distances.length === 0) return;
        const status = await onUpload(dayId, distances);
        // Only clear the textarea when everything was accepted (no conflicts)
        if (status !== 'conflict') {
            setBulkData('');
        }
    };

    // ── Crack inline edit ──────────────────────────────────
    const startEdit = (crack) => {
        setEditingId(crack.id);
        setEditValue(String(crack.distance));
    };

    const confirmEdit = (crack) => {
        const newDist = parseFloat(editValue);
        if (!isNaN(newDist) && newDist !== crack.distance) {
            onUpdate(crack.id, newDist);
        }
        setEditingId(null);
    };

    const cancelEdit = () => setEditingId(null);

    // ── Day name edit ──────────────────────────────────────
    const startDayNameEdit = () => {
        setDayNameValue(selectedDay?.name || '');
        setEditingDayName(true);
    };

    const confirmDayNameEdit = () => {
        if (selectedDay && dayNameValue.trim() && dayNameValue.trim() !== selectedDay.name) {
            onUpdateDay(selectedDay.id, { ...selectedDay, name: dayNameValue.trim() });
        }
        setEditingDayName(false);
    };

    // ── Day color update ───────────────────────────────────
    const confirmColorUpdate = () => {
        if (selectedDay && color !== selectedDay.color) {
            onUpdateDay(selectedDay.id, { ...selectedDay, color });
        }
    };

    const handleAddDay = async () => {
        if (!newDayName.trim()) return;

        const dateStr = new Date().toISOString().split('T')[0];

        const createdDay = await onAddDay({
            name: newDayName.trim(),
            date: dateStr,
            color: color
        });

        setNewDayName('');
        if (createdDay && createdDay.id) {
            setDayId(String(createdDay.id));
        }
    };

    // ── Checkbox selection ────────────────────────────────
    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selected.size === dayCracks.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(dayCracks.map(c => c.id)));
        }
    };

    const handleBulkDelete = () => {
        if (selected.size === 0) return;
        if (window.confirm(`Delete ${selected.size} selected crack${selected.size > 1 ? 's' : ''}?`)) {
            onBulkDelete([...selected]);
            setSelected(new Set());
        }
    };

    // ── Drag and Drop ──────────────────────────────────────
    const handleDragStart = (e, index) => {
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = "move";
        // Optionally set drag image or data
    };

    const handleDragEnter = (e, index) => {
        if (index !== draggedItemIndex) {
            setDragOverItemIndex(index);
        }
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
        setDragOverItemIndex(null);
    };

    const handleDrop = () => {
        if (draggedItemIndex !== null && dragOverItemIndex !== null && draggedItemIndex !== dragOverItemIndex) {
            const newOrder = [...surveyDays];
            const draggedDay = newOrder[draggedItemIndex];
            newOrder.splice(draggedItemIndex, 1);
            newOrder.splice(dragOverItemIndex, 0, draggedDay);
            onReorderDays(newOrder.map(d => d.id));
        }
        setDraggedItemIndex(null);
        setDragOverItemIndex(null);
    };

    const handleMoveDay = (index, direction) => {
        if (
            (direction === -1 && index === 0) ||
            (direction === 1 && index === surveyDays.length - 1)
        ) return;

        const newOrder = [...surveyDays];
        const targetIndex = index + direction;

        // Swap elements
        const temp = newOrder[index];
        newOrder[index] = newOrder[targetIndex];
        newOrder[targetIndex] = temp;

        onReorderDays(newOrder.map(d => d.id));
    };


    return (
        <div className="card">
            <h2 className="title">Data Entry</h2>
            <div className="grid">
                {/* Left column */}
                <div>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Survey Days</span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'normal' }}>Drag to reorder</span>
                    </label>
                    <div className="day-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1.5rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                        {surveyDays.length === 0 && <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>No days added yet.</div>}
                        {surveyDays.map((day, index) => {
                            const isSelected = String(day.id) === String(dayId);
                            const isDragged = draggedItemIndex === index;
                            const isDragOver = dragOverItemIndex === index;

                            return (
                                <div
                                    key={day.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragEnter={(e) => handleDragEnter(e, index)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={handleDrop}
                                    onClick={() => handleDayChange({ target: { value: String(day.id) } })}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '0.5rem 0.75rem',
                                        background: isSelected ? '#f8fafc' : '#ffffff',
                                        border: `1px solid ${isSelected ? '#cbd5e1' : '#e2e8f0'} `,
                                        borderRadius: '6px',
                                        cursor: 'grab',
                                        opacity: isDragged ? 0.5 : 1,
                                        transform: isDragOver ? (draggedItemIndex < dragOverItemIndex ? 'translateY(-4px)' : 'translateY(4px)') : 'none',
                                        boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <div style={{ cursor: 'grab', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <div style={{ width: '12px', height: '2px', background: 'currentColor', borderRadius: '1px' }}></div>
                                            <div style={{ width: '12px', height: '2px', background: 'currentColor', borderRadius: '1px' }}></div>
                                            <div style={{ width: '12px', height: '2px', background: 'currentColor', borderRadius: '1px' }}></div>
                                        </div>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: day.color }}></div>
                                        <span style={{ fontWeight: isSelected ? 600 : 500, color: isSelected ? '#0f172a' : '#475569', fontSize: '0.9rem' }}>{day.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {isSelected && <span style={{ color: '#2563eb', fontSize: '1.2rem', lineHeight: 1, marginRight: '0.2rem' }}>✓</span>}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleMoveDay(index, -1); }}
                                                disabled={index === 0}
                                                style={{
                                                    background: 'transparent', border: 'none', padding: '0 4px',
                                                    cursor: index === 0 ? 'not-allowed' : 'pointer',
                                                    opacity: index === 0 ? 0.3 : 0.7, fontSize: '12px', lineHeight: 1,
                                                    color: '#475569'
                                                }}
                                                title="Move up"
                                            >▲</button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleMoveDay(index, 1); }}
                                                disabled={index === surveyDays.length - 1}
                                                style={{
                                                    background: 'transparent', border: 'none', padding: '0 4px',
                                                    cursor: index === surveyDays.length - 1 ? 'not-allowed' : 'pointer',
                                                    opacity: index === surveyDays.length - 1 ? 0.3 : 0.7, fontSize: '12px', lineHeight: 1,
                                                    color: '#475569'
                                                }}
                                                title="Move down"
                                            >▼</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Editable day name */}
                    {selectedDay && (
                        <div style={{ marginBottom: '1rem' }}>
                            <label>Day Name</label>
                            {editingDayName ? (
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                    <input
                                        value={dayNameValue}
                                        onChange={e => setDayNameValue(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') confirmDayNameEdit();
                                            if (e.key === 'Escape') setEditingDayName(false);
                                        }}
                                        autoFocus
                                        style={{ flex: 1 }}
                                    />
                                    <button onClick={confirmDayNameEdit} style={{ background: '#10b981', padding: '0.35rem 0.7rem' }}>✓</button>
                                    <button onClick={() => setEditingDayName(false)} style={{ background: '#64748b', padding: '0.35rem 0.7rem' }}>✕</button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            background: selectedDay.color,
                                            color: '#fff',
                                            borderRadius: '999px',
                                            padding: '0.2rem 0.8rem',
                                            fontWeight: 600,
                                            fontSize: '0.9rem',
                                        }}
                                    >
                                        {selectedDay.name}
                                    </span>
                                    <button
                                        onClick={startDayNameEdit}
                                        style={{ background: 'transparent', color: '#2563eb', padding: '0.2rem 0.5rem', fontSize: '0.8rem', border: '1px solid #2563eb', borderRadius: '5px' }}
                                    >
                                        ✏️ Rename
                                    </button>
                                    <button
                                        onClick={() => onDeleteDay(selectedDay.id)}
                                        style={{ background: 'transparent', color: '#ef4444', padding: '0.2rem 0.5rem', fontSize: '0.8rem', border: '1px solid #ef4444', borderRadius: '5px' }}
                                    >
                                        🗑️ Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <label>Add New Day (Name)</label>
                    <input
                        value={newDayName}
                        onChange={(e) => setNewDayName(e.target.value)}
                        placeholder="e.g. Day 14"
                    />
                    {/* Color picker — updates selected day OR used for new day */}
                    {selectedDay ? (
                        <div style={{ marginBottom: '1rem' }}>
                            <label>Marker Color</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    style={{ padding: 0, height: '36px', width: '48px', cursor: 'pointer', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                />
                                <button
                                    onClick={confirmColorUpdate}
                                    disabled={color === selectedDay.color}
                                    style={{
                                        background: color === selectedDay.color ? '#94a3b8' : color,
                                        color: '#fff',
                                        padding: '0.3rem 0.7rem',
                                        fontSize: '0.8rem',
                                        borderRadius: '5px',
                                        border: 'none',
                                        cursor: color === selectedDay.color ? 'default' : 'pointer',
                                        transition: 'background 0.2s',
                                    }}
                                >
                                    Apply Color
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label style={{ marginTop: '0.5rem' }}>Marker Color</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    style={{ padding: 0, height: '36px', width: '48px', cursor: 'pointer', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                />
                                <button
                                    onClick={handleAddDay}
                                    disabled={!newDayName.trim()}
                                    style={{
                                        background: !newDayName.trim() ? '#cbd5e1' : '#2563eb',
                                        color: '#fff',
                                        padding: '0.3rem 0.7rem',
                                        fontSize: '0.8rem',
                                        borderRadius: '5px',
                                        border: 'none',
                                        cursor: !newDayName.trim() ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    + Add Day
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right column */}
                <div>
                    <label>
                        Add Crack Distances
                        {selectedDay && (
                            <span style={{ color: selectedDay.color, marginLeft: '0.5rem', fontWeight: 700 }}>
                                → {selectedDay.name}
                            </span>
                        )}
                    </label>
                    <textarea
                        value={bulkData}
                        onChange={(e) => setBulkData(e.target.value)}
                        style={{
                            width: '100%', height: '150px',
                            border: '1.5px solid var(--border)', borderRadius: '6px', padding: '0.5rem',
                            fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical'
                        }}
                        placeholder="10.5, 22.1, 45.8... (comma or newline separated)"
                    />
                    <button
                        onClick={handleUpload}
                        disabled={!dayId || !bulkData.trim()}
                        style={{ marginTop: '0.75rem' }}
                    >
                        Upload &amp; Assign Cracks
                    </button>
                </div>
            </div>

            {/* Existing cracks table */}
            {dayId && (
                <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                            Existing Cracks
                        </h3>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            {dayCracks.length} crack{dayCracks.length !== 1 ? 's' : ''}
                        </span>
                        {selected.size > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                style={{ background: '#ef4444', padding: '0.3rem 0.9rem', fontSize: '0.82rem', marginLeft: 'auto' }}
                            >
                                🗑 Delete Selected ({selected.size})
                            </button>
                        )}
                    </div>

                    {dayCracks.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>
                            No cracks recorded for this day yet.
                        </p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ background: '#f1f5f9' }}>
                                        <th style={thStyle}>
                                            <input
                                                type="checkbox"
                                                style={{ width: 'auto', margin: 0 }}
                                                checked={selected.size === dayCracks.length && dayCracks.length > 0}
                                                onChange={toggleSelectAll}
                                                title="Select all"
                                            />
                                        </th>
                                        <th style={thStyle}>#</th>
                                        <th style={thStyle}>Distance (ft)</th>
                                        <th style={thStyle}>Section</th>
                                        <th style={thStyle}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dayCracks.map((crack, idx) => (
                                        <tr
                                            key={crack.id}
                                            style={{
                                                borderBottom: '1px solid #e2e8f0',
                                                background: selected.has(crack.id) ? '#eff6ff' : undefined
                                            }}
                                        >
                                            <td style={tdStyle}>
                                                <input
                                                    type="checkbox"
                                                    style={{ width: 'auto', margin: 0 }}
                                                    checked={selected.has(crack.id)}
                                                    onChange={() => toggleSelect(crack.id)}
                                                />
                                            </td>
                                            <td style={tdStyle}>{idx + 1}</td>
                                            <td style={tdStyle}>
                                                {editingId === crack.id ? (
                                                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                        <input
                                                            type="number"
                                                            value={editValue}
                                                            onChange={e => setEditValue(e.target.value)}
                                                            style={{ width: '100px', padding: '0.25rem 0.5rem', fontSize: '0.9rem' }}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') confirmEdit(crack);
                                                                if (e.key === 'Escape') cancelEdit();
                                                            }}
                                                            autoFocus
                                                        />
                                                        <button onClick={() => confirmEdit(crack)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', background: '#10b981' }}>✓</button>
                                                        <button onClick={cancelEdit} style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', background: '#64748b' }}>✕</button>
                                                    </div>
                                                ) : (
                                                    <span
                                                        style={{ cursor: 'pointer', color: '#2563eb', fontWeight: 600 }}
                                                        onClick={() => startEdit(crack)}
                                                        title="Click to edit"
                                                    >
                                                        {crack.distance}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ ...tdStyle, color: '#64748b' }}>
                                                {crack.section_id ?? '—'}
                                            </td>
                                            <td style={tdStyle}>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm(`Delete crack at ${crack.distance} ft ? `)) {
                                                            onDelete(crack.id);
                                                        }
                                                    }}
                                                    style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem', background: '#ef4444' }}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const thStyle = {
    padding: '0.6rem 0.75rem',
    textAlign: 'left',
    fontWeight: 700,
    color: '#475569',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '2px solid #e2e8f0',
};

const tdStyle = {
    padding: '0.55rem 0.75rem',
    verticalAlign: 'middle',
};

export default DataEntry;
