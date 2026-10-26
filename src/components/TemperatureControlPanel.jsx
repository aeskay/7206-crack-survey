import React, { useState } from 'react';

const PRESET_COLORS = [
    { label: 'Red', hex: '#dc2626' },
    { label: 'Orange', hex: '#ea580c' },
    { label: 'Amber', hex: '#d97706' },
    { label: 'Purple', hex: '#7c3aed' },
    { label: 'Blue', hex: '#0284c7' },
    { label: 'Emerald', hex: '#059669' },
    { label: 'Slate', hex: '#475569' }
];

const TemperatureControlPanel = ({
    tempBundle,
    settings,
    onUpdateSettings,
    onOpenUploadModal,
    onClearData
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const hasData = Boolean(tempBundle?.data && tempBundle.data.length > 0);
    const isEnabled = Boolean(settings?.enabled && hasData);

    const handleSettingChange = (field, value) => {
        onUpdateSettings({ [field]: value });
    };

    return (
        <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            marginBottom: '1rem',
            overflow: 'hidden'
        }}>
            {/* Header Toolbar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.6rem 1rem',
                background: isEnabled ? '#f0fdf4' : '#f8fafc',
                borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                transition: 'background 0.2s'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {hasData ? (
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            color: '#0f172a'
                        }}>
                            <input
                                type="checkbox"
                                checked={Boolean(settings?.enabled)}
                                onChange={(e) => handleSettingChange('enabled', e.target.checked)}
                                style={{ width: '16px', height: '16px', accentColor: settings?.color || '#dc2626', cursor: 'pointer' }}
                            />
                            <span>🌡️ Temperature Overlay</span>
                        </label>
                    ) : (
                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            🌡️ Temperature Overlay
                        </span>
                    )}

                    {hasData ? (
                        <span style={{
                            background: '#e2e8f0',
                            color: '#475569',
                            fontSize: '0.75rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '12px',
                            fontWeight: 500
                        }}>
                            📁 {tempBundle.fileName} ({tempBundle.data.length.toLocaleString()} points)
                        </span>
                    ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            (No temperature data loaded for this project)
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {hasData && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            style={{
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '0.3rem 0.6rem',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#475569',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                            }}
                        >
                            ⚙️ {isExpanded ? 'Hide Controls' : 'Y-Axis & Colors'}
                        </button>
                    )}

                    <button
                        onClick={onOpenUploadModal}
                        style={{
                            background: hasData ? '#f1f5f9' : '#2563eb',
                            color: hasData ? '#334155' : '#ffffff',
                            border: hasData ? '1px solid #cbd5e1' : 'none',
                            borderRadius: '6px',
                            padding: '0.3rem 0.75rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                        }}
                    >
                        {hasData ? '🔄 Replace Data' : '➕ Upload Temperature'}
                    </button>
                </div>
            </div>

            {/* Expandable Settings Panel */}
            {isExpanded && hasData && (
                <div style={{ padding: '1rem', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'flex-start' }}>
                        {/* Line Color Selection */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>
                                Line Color:
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {PRESET_COLORS.map(c => (
                                    <button
                                        key={c.hex}
                                        type="button"
                                        title={c.label}
                                        onClick={() => handleSettingChange('color', c.hex)}
                                        style={{
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '50%',
                                            background: c.hex,
                                            border: (settings?.color || '#dc2626') === c.hex ? '2px solid #0f172a' : '2px solid #ffffff',
                                            boxShadow: '0 0 0 1px #cbd5e1',
                                            cursor: 'pointer',
                                            padding: 0
                                        }}
                                    />
                                ))}
                                <input
                                    type="color"
                                    value={settings?.color || '#dc2626'}
                                    onChange={(e) => handleSettingChange('color', e.target.value)}
                                    title="Custom Color"
                                    style={{ width: '26px', height: '26px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                                />
                            </div>
                        </div>

                        {/* Y-Axis Min */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                                Y-Axis Min:
                            </label>
                            <input
                                type="number"
                                placeholder="Auto"
                                value={settings?.min ?? ''}
                                onChange={(e) => handleSettingChange('min', e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.6rem',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.85rem'
                                }}
                            />
                        </div>

                        {/* Y-Axis Max */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                                Y-Axis Max:
                            </label>
                            <input
                                type="number"
                                placeholder="Auto"
                                value={settings?.max ?? ''}
                                onChange={(e) => handleSettingChange('max', e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.6rem',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.85rem'
                                }}
                            />
                        </div>

                        {/* Y-Axis Interval (dtick) */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                                Interval (Step):
                            </label>
                            <input
                                type="number"
                                placeholder="Auto"
                                value={settings?.dtick ?? ''}
                                onChange={(e) => handleSettingChange('dtick', e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.6rem',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.85rem'
                                }}
                            />
                        </div>

                        {/* Y-Axis Title */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                                Y-Axis Label:
                            </label>
                            <input
                                type="text"
                                placeholder="Temperature (<sup>o</sup>F)"
                                value={settings?.yTitle ?? 'Temperature (<sup>o</sup>F)'}
                                onChange={(e) => handleSettingChange('yTitle', e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.6rem',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.85rem'
                                }}
                            />
                        </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px solid #f1f5f9',
                        paddingTop: '0.75rem',
                        fontSize: '0.8rem',
                        color: '#64748b'
                    }}>
                        <div>
                            {tempBundle.summary?.sheetName && (
                                <>
                                    <span>Sheet: <b>{tempBundle.summary.sheetName}</b></span>
                                    <span style={{ margin: '0 0.5rem' }}>•</span>
                                </>
                            )}
                            <span>Start ("Day 0"): <b>{tempBundle.summary?.startDateTime || 'N/A'}</b></span>
                            <span style={{ margin: '0 0.5rem' }}>•</span>
                            <span>Interval: <b>{tempBundle.summary?.intervalMinutes || 60} mins</b></span>
                            {tempBundle.summary?.minTemp != null && (
                                <>
                                    <span style={{ margin: '0 0.5rem' }}>•</span>
                                    <span>Range: <b>{tempBundle.summary.minTemp}° – {tempBundle.summary.maxTemp}°</b></span>
                                </>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                if (window.confirm("Are you sure you want to remove the local temperature data for this project?")) {
                                    onClearData();
                                }
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: '0.2rem 0.5rem'
                            }}
                        >
                            🗑️ Remove from Project
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemperatureControlPanel;
