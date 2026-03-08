import React from 'react';

const ConflictTable = ({ conflicts, onResolve }) => {
    if (!conflicts || conflicts.length === 0) return null;

    return (
        <div className="card" style={{ borderColor: '#ef4444', borderWeight: '2px' }}>
            <h2 className="title" style={{ color: '#ef4444', webkitTextFillColor: '#ef4444' }}>Potential Duplicates Detected</h2>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#fef2f2' }}>
                        <th style={{ padding: '0.75rem' }}>New Distance</th>
                        <th style={{ padding: '0.75rem' }}>Existing Crack</th>
                        <th style={{ padding: '0.75rem' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {conflicts.map((conf, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #fee2e2' }}>
                            <td style={{ padding: '0.75rem' }}>{conf.new_distance} ft</td>
                            <td style={{ padding: '0.75rem' }}>{conf.existing_crack.distance} ft (ID: {conf.existing_crack.id})</td>
                            <td style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => onResolve(idx, 'keep')} style={{ background: '#3b82f6', fontSize: '0.75rem' }}>Keep Both</button>
                                <button onClick={() => onResolve(idx, 'merge')} style={{ background: '#10b981', fontSize: '0.75rem' }}>Merge/Update</button>
                                <button onClick={() => onResolve(idx, 'discard')} style={{ background: '#64748b', fontSize: '0.75rem' }}>Discard New</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ConflictTable;
