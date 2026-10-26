import React, { useState, useRef } from 'react';
import {
    loadFileStructure,
    readSheetRows,
    inspectTableStructure,
    processTemperatureSeries,
    formatDateTime
} from '../utils/temperatureParser';

const TemperatureUploadModal = ({ isOpen, onClose, onSave, existingFileName }) => {
    const fileInputRef = useRef(null);
    const rawRowsRef = useRef(null);
    const workbookRef = useRef(null);
    const totalColsRef = useRef(0);

    const [fileName, setFileName] = useState('');
    const [rowCount, setRowCount] = useState(0);
    const [isReadingFile, setIsReadingFile] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);

    // Multisheet / Excel state
    const [isExcel, setIsExcel] = useState(false);
    const [sheetNames, setSheetNames] = useState([]);
    const [selectedSheet, setSelectedSheet] = useState('');

    // Table configuration & lightweight preview (only 6 real data rows in React state!)
    const [headerRowIdx, setHeaderRowIdx] = useState(0);
    const [headers, setHeaders] = useState([]);
    const [columns, setColumns] = useState([]);
    const [timeColIdx, setTimeColIdx] = useState(0);
    const [tempColIdx, setTempColIdx] = useState(1);
    const [candidateStartTimes, setCandidateStartTimes] = useState([]);
    const [startDateTime, setStartDateTime] = useState('');
    const [intervalMinutes, setIntervalMinutes] = useState(60);
    const [isTOA5, setIsTOA5] = useState(false);
    const [firstDataRowIdx, setFirstDataRowIdx] = useState(1);
    const [previewRows, setPreviewRows] = useState([]);

    if (!isOpen) return null;

    const applyRows = (rows, totalCols = 0) => {
        rawRowsRef.current = rows;
        totalColsRef.current = totalCols || (rows[0] ? rows[0].length : 0);
        setRowCount(rows.length);

        const structure = inspectTableStructure(rows, { totalCols: totalColsRef.current });
        setHeaderRowIdx(structure.headerRowIdx);
        setHeaders(structure.headers);
        setColumns(structure.columns);
        setTimeColIdx(structure.detectedTimeCol);
        setTempColIdx(structure.detectedTempCol);
        setCandidateStartTimes(structure.candidateStartTimes);
        setIsTOA5(structure.isTOA5);
        setFirstDataRowIdx(structure.firstDataRowIdx);

        // Keep strictly 6 real data rows starting from firstDataRowIdx
        setPreviewRows(rows.slice(structure.firstDataRowIdx, structure.firstDataRowIdx + 6));

        if (structure.candidateStartTimes.length > 0) {
            setStartDateTime(structure.candidateStartTimes[0]);
        }
    };

    const handleFileSelected = async (selectedFile) => {
        if (!selectedFile) return;
        setFileName(selectedFile.name);
        setError(null);
        setIsReadingFile(true);

        // Give browser UI a 30ms breath to show loading state
        await new Promise(r => setTimeout(r, 30));

        try {
            const fileStruct = await loadFileStructure(selectedFile);
            setIsExcel(fileStruct.isExcel);
            setSheetNames(fileStruct.sheetNames || []);
            workbookRef.current = fileStruct.workbook;

            const initialSheet = fileStruct.sheetNames?.[0] || '';
            setSelectedSheet(initialSheet);

            if (!fileStruct.rawRows || fileStruct.rawRows.length === 0) {
                throw new Error("The selected file or sheet is empty.");
            }
            applyRows(fileStruct.rawRows, fileStruct.totalCols);
        } catch (err) {
            console.error('Error reading file:', err);
            setError(err.message || 'Failed to read file.');
        } finally {
            setIsReadingFile(false);
        }
    };

    const handleSheetChange = async (newSheet) => {
        if (!workbookRef.current || !newSheet) return;
        setSelectedSheet(newSheet);
        setIsReadingFile(true);
        await new Promise(r => setTimeout(r, 20));

        try {
            const { rows, totalCols } = readSheetRows(workbookRef.current, newSheet);
            if (!rows || rows.length === 0) {
                setError(`Sheet "${newSheet}" is empty.`);
            } else {
                setError(null);
                applyRows(rows, totalCols);
            }
        } catch (err) {
            console.error('Error switching sheet:', err);
            setError(`Failed to read sheet "${newSheet}": ${err.message}`);
        } finally {
            setIsReadingFile(false);
        }
    };

    const handleHeaderRowChange = (newIdx) => {
        const rows = rawRowsRef.current;
        if (!rows || rows.length === 0) return;
        const idx = Math.max(0, Math.min(newIdx, rows.length - 1));
        setHeaderRowIdx(idx);

        const structure = inspectTableStructure(rows, {
            manualHeaderRowIdx: idx,
            totalCols: totalColsRef.current
        });
        setHeaders(structure.headers);
        setColumns(structure.columns);
        if (timeColIdx >= structure.columns.length) setTimeColIdx(0);
        if (tempColIdx >= structure.columns.length) setTempColIdx(structure.detectedTempCol);
        setFirstDataRowIdx(structure.firstDataRowIdx);
        setPreviewRows(rows.slice(structure.firstDataRowIdx, structure.firstDataRowIdx + 6));
    };

    const handleTimeColChange = (newCol) => {
        setTimeColIdx(newCol);
        const rows = rawRowsRef.current;
        if (rows) {
            const newCandidates = [];
            const startRow = Math.max(0, firstDataRowIdx);
            for (let r = startRow; r < Math.min(rows.length, startRow + 50); r++) {
                const val = rows[r]?.[newCol];
                const ms = parseDateTimeToMs(val);
                if (ms !== null) {
                    const formatted = formatDateTime(ms);
                    if (formatted && !newCandidates.includes(formatted)) newCandidates.push(formatted);
                }
            }
            if (newCandidates.length > 0) {
                setCandidateStartTimes(newCandidates);
                setStartDateTime(newCandidates[0]);
            }
        }
    };

    const handleTempColChange = (newCol) => {
        setTempColIdx(newCol);
    };

    const handleProcessAndSave = async () => {
        const rows = rawRowsRef.current;
        if (!rows || rows.length === 0) return;
        if (!startDateTime.trim()) {
            setError("Please select or enter the Start Date/Time (Day 0).");
            return;
        }

        setIsProcessing(true);
        setError(null);
        await new Promise(r => setTimeout(r, 30));

        try {
            const { points, summary } = processTemperatureSeries({
                rawRows: rows,
                headerRowIdx,
                firstDataRowIdx,
                timeColIdx,
                tempColIdx,
                startDateTimeStr: startDateTime,
                intervalMinutes: Number(intervalMinutes)
            });

            if (points.length === 0) {
                throw new Error("No data points generated. Please verify the Start Date/Time and selected columns.");
            }

            // ONLY SAVE the downsampled points + metadata to browser storage (IndexedDB)
            await onSave({
                fileName: fileName,
                sheetName: isExcel ? selectedSheet : null,
                data: points, // strictly [{ timestamp, day, temp }, ...]
                summary: {
                    ...summary,
                    sheetName: isExcel ? selectedSheet : null
                },
                meta: {
                    headerRowIdx,
                    sheetName: isExcel ? selectedSheet : null,
                    timeColName: columns[timeColIdx]?.title || `Column ${timeColIdx + 1}`,
                    tempColName: columns[tempColIdx]?.title || `Column ${tempColIdx + 1}`,
                    startDateTime,
                    intervalMinutes: Number(intervalMinutes)
                }
            });

            handleClose();
        } catch (err) {
            console.error('Processing error:', err);
            setError(err.message || "Failed to process temperature data.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        rawRowsRef.current = null;
        workbookRef.current = null;
        totalColsRef.current = 0;
        setFileName('');
        setRowCount(0);
        setError(null);
        setHeaders([]);
        setColumns([]);
        setIsExcel(false);
        setSheetNames([]);
        setSelectedSheet('');
        setPreviewRows([]);
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    const currentTempCol = columns[tempColIdx];

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            overflowY: 'auto'
        }}>
            <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '780px',
                maxHeight: '92vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8fafc',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px'
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🌡️ Import & Parse Temperature Data
                        </h2>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                            Only selected downsampled columns are saved locally in browser storage (IndexedDB)
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            fontSize: '1.25rem',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            lineHeight: 1,
                            padding: '0.25rem'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {error && (
                        <div style={{
                            background: '#fef2f2',
                            color: '#991b1b',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            padding: '0.75rem 1rem',
                            fontSize: '0.875rem'
                        }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {rowCount === 0 ? (
                        /* Step 1: File Upload */
                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                if (e.dataTransfer.files?.[0]) handleFileSelected(e.dataTransfer.files[0]);
                            }}
                            style={{
                                border: '2px dashed #cbd5e1',
                                borderRadius: '12px',
                                padding: '3rem 2rem',
                                textAlign: 'center',
                                background: '#f8fafc',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.xlsx,.xls,.dat,.txt,.tsv"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
                                }}
                            />
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📊</div>
                            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>
                                Click or drag temperature file here
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                                Supports Campbell Scientific TOA5 (.dat, .csv), Multi-sheet Excel (.xlsx, .xls), and CSV
                            </p>
                            {existingFileName && (
                                <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#059669', fontWeight: 500 }}>
                                    ✓ Currently loaded for this project: {existingFileName}
                                </p>
                            )}
                            {isReadingFile && (
                                <p style={{ marginTop: '1rem', color: '#2563eb', fontWeight: 600 }}>
                                    Reading and inspecting file…
                                </p>
                            )}
                        </div>
                    ) : (
                        /* Step 2: Configuration & Preview */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: '8px',
                                padding: '0.75rem 1rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <span style={{ fontWeight: 600, color: '#1e40af', fontSize: '0.9rem' }}>
                                        📁 {fileName}
                                    </span>
                                    <span style={{ color: '#3b82f6', fontSize: '0.8rem', marginLeft: '0.75rem' }}>
                                        ({rowCount.toLocaleString()} rows • {columns.length} columns detected
                                        {isTOA5 ? ' • Campbell Scientific TOA5' : ''})
                                    </span>
                                </div>
                                <button
                                    onClick={handleReset}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid #93c5fd',
                                        color: '#1d4ed8',
                                        borderRadius: '6px',
                                        padding: '0.25rem 0.6rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Change File
                                </button>
                            </div>

                            {/* Sheet Selection if Excel */}
                            {isExcel && sheetNames.length > 0 && (
                                <div style={{
                                    background: '#f8fafc',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    padding: '0.75rem 1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem'
                                }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
                                        📄 Select Sheet:
                                    </label>
                                    <select
                                        value={selectedSheet}
                                        onChange={(e) => handleSheetChange(e.target.value)}
                                        disabled={isReadingFile}
                                        style={{
                                            flex: 1,
                                            padding: '0.45rem 0.75rem',
                                            borderRadius: '6px',
                                            border: '1px solid #94a3b8',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: '#0f172a',
                                            background: '#ffffff'
                                        }}
                                    >
                                        {sheetNames.map((s, idx) => (
                                            <option key={idx} value={s}>
                                                {s} {idx === 0 ? '(First Sheet)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {sheetNames.length > 1 && (
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                            ({sheetNames.length} sheets in workbook)
                                        </span>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {/* Header Row */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                                        Header Row (Line #):
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={rowCount}
                                        value={headerRowIdx + 1}
                                        onChange={(e) => handleHeaderRowChange(parseInt(e.target.value || '1', 10) - 1)}
                                        style={{
                                            width: '100%',
                                            padding: '0.5rem 0.75rem',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.875rem'
                                        }}
                                    />
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        Line with column titles (Auto-detected Line {headerRowIdx + 1})
                                    </span>
                                </div>

                                {/* Sampling Interval */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                                        Downsample Interval:
                                    </label>
                                    <select
                                        value={intervalMinutes}
                                        onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                                        style={{
                                            width: '100%',
                                            padding: '0.5rem 0.75rem',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.875rem',
                                            background: '#fff'
                                        }}
                                    >
                                        <option value="60">1 Hour (Recommended)</option>
                                        <option value="30">30 Minutes</option>
                                        <option value="15">15 Minutes</option>
                                        <option value="5">5 Minutes (Raw)</option>
                                    </select>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        Reduces file size by window-averaging points
                                    </span>
                                </div>

                                {/* Date/Time Column */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                                        Date & Time Column:
                                    </label>
                                    <select
                                        value={timeColIdx}
                                        onChange={(e) => handleTimeColChange(Number(e.target.value))}
                                        style={{
                                            width: '100%',
                                            padding: '0.5rem 0.75rem',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.85rem',
                                            background: '#fff'
                                        }}
                                    >
                                        {columns.map((col) => (
                                            <option key={col.index} value={col.index}>
                                                {col.displayLabel}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Temperature Column */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                                        Temperature Column:
                                    </label>
                                    <select
                                        value={tempColIdx}
                                        onChange={(e) => handleTempColChange(Number(e.target.value))}
                                        style={{
                                            width: '100%',
                                            padding: '0.5rem 0.75rem',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.85rem',
                                            background: '#fff'
                                        }}
                                    >
                                        {columns.map((col) => (
                                            <option key={col.index} value={col.index}>
                                                {col.displayLabel}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Start Point (Day 0) Selection */}
                            <div style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                padding: '1rem'
                            }}>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>
                                    ⏱️ Starting Point ("Day 0"):
                                </label>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    {candidateStartTimes.length > 0 ? (
                                        <select
                                            value={startDateTime}
                                            onChange={(e) => setStartDateTime(e.target.value)}
                                            style={{
                                                flex: 1,
                                                padding: '0.5rem 0.75rem',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.875rem',
                                                background: '#fff'
                                            }}
                                        >
                                            {candidateStartTimes.map((t, idx) => (
                                                <option key={idx} value={t}>
                                                    {t} {idx === 0 ? '(Earliest Record)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    ) : null}
                                    <input
                                        type="text"
                                        placeholder="YYYY-MM-DD HH:mm:ss"
                                        value={startDateTime}
                                        onChange={(e) => setStartDateTime(e.target.value)}
                                        style={{
                                            flex: candidateStartTimes.length > 0 ? 1 : 2,
                                            padding: '0.5rem 0.75rem',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.875rem'
                                        }}
                                    />
                                </div>
                                <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                                    💡 This timestamp is defined as <b>Day 0</b>. Exactly 24 hours later will be <b>Day 1</b>, 48 hours later will be <b>Day 2</b>, etc., matching your crack survey days!
                                </p>
                            </div>

                            {/* Preview Table (Strictly real data rows) */}
                            <div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                                    Raw Data Preview ({selectedSheet ? `Sheet "${selectedSheet}" • ` : ''}First 6 Real Data Rows):
                                </span>
                                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ background: '#f1f5f9' }}>
                                                <th style={{ padding: '0.45rem 0.6rem', borderBottom: '1px solid #cbd5e1' }}>Line #</th>
                                                <th style={{ padding: '0.45rem 0.6rem', borderBottom: '1px solid #cbd5e1', color: '#2563eb' }}>
                                                    📅 Time: {columns[timeColIdx]?.displayLabel || `Col ${timeColIdx + 1}`}
                                                </th>
                                                <th style={{ padding: '0.45rem 0.6rem', borderBottom: '1px solid #cbd5e1', color: '#dc2626' }}>
                                                    🌡️ Temp: {columns[tempColIdx]?.displayLabel || `Col ${tempColIdx + 1}`}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewRows.map((row, rIdx) => (
                                                <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '0.45rem 0.6rem', color: '#64748b' }}>
                                                        {firstDataRowIdx + rIdx + 1}
                                                    </td>
                                                    <td style={{ padding: '0.45rem 0.6rem', fontFamily: 'monospace' }}>
                                                        {String(row[timeColIdx] ?? '')}
                                                    </td>
                                                    <td style={{ padding: '0.45rem 0.6rem', fontWeight: 600, color: '#0f172a' }}>
                                                        {String(row[tempColIdx] ?? '')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                                    <span style={{ color: currentTempCol?.validNumCount > 0 ? '#15803d' : '#b45309', fontWeight: 500 }}>
                                        {currentTempCol?.validNumCount > 0
                                            ? `✓ Valid numeric readings detected in "${currentTempCol?.title || `Col ${tempColIdx + 1}`}"`
                                            : `ℹ️ Note: First data rows for this column contain non-numeric or blank values (e.g. #N/A). Any valid readings starting later will be processed.`
                                        }
                                    </span>
                                    <span style={{ color: '#64748b' }}>
                                        Total Columns Detected: <b>{columns.length}</b>
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    background: '#f8fafc',
                    borderBottomLeftRadius: '16px',
                    borderBottomRightRadius: '16px'
                }}>
                    <button
                        onClick={handleClose}
                        disabled={isProcessing}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#475569',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    {rowCount > 0 && (
                        <button
                            onClick={handleProcessAndSave}
                            disabled={isProcessing}
                            style={{
                                padding: '0.5rem 1.25rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#2563eb',
                                color: '#ffffff',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                cursor: isProcessing ? 'wait' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                            }}
                        >
                            {isProcessing ? 'Processing & Downsampling…' : '✓ Process & Save Locally'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TemperatureUploadModal;