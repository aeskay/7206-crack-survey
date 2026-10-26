import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Convert a 0-based column index to Excel column letters (0 -> A, 1 -> B, 25 -> Z, 26 -> AA, etc.).
 * @param {number} colIndex
 * @returns {string}
 */
export function getColumnLetter(colIndex) {
    let letter = '';
    let temp = colIndex;
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
}

/**
 * Parse a date/time string or Excel serial number into a timestamp (milliseconds since epoch).
 * @param {string|number|Date} val
 * @returns {number|null} ms timestamp, or null if invalid
 */
export function parseDateTimeToMs(val) {
    if (val == null || val === '') return null;
    if (val instanceof Date) {
        const ms = val.getTime();
        return isNaN(ms) ? null : ms;
    }
    if (typeof val === 'number') {
        // Excel serial date (days since Dec 30, 1899)
        if (val > 20000 && val < 90000) {
            const ms = Math.round((val - 25569) * 86400 * 1000);
            return isNaN(ms) ? null : ms;
        }
    }
    const str = String(val).trim();
    if (!str) return null;

    // Replace space with T if standard ISO format YYYY-MM-DD HH:mm:ss
    let normalized = str;
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?/.test(str)) {
        normalized = str.replace(/\s+/, 'T');
    }
    const parsed = new Date(normalized).getTime();
    if (!isNaN(parsed)) return parsed;

    // Try standard Date.parse
    const fallback = Date.parse(str);
    return isNaN(fallback) ? null : fallback;
}

/**
 * Format a Date or timestamp into YYYY-MM-DD HH:mm:ss
 * @param {number|Date} dateOrMs
 * @returns {string}
 */
export function formatDateTime(dateOrMs) {
    const d = new Date(dateOrMs);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Reads a specific sheet from an XLSX workbook as raw 2D array and gets total columns.
 * @param {any} workbook
 * @param {string} sheetName
 * @returns {{ rows: any[][], totalCols: number }}
 */
export function readSheetRows(workbook, sheetName) {
    if (!workbook || !sheetName || !workbook.Sheets[sheetName]) return { rows: [], totalCols: 0 };
    const sheet = workbook.Sheets[sheetName];
    let totalCols = 0;
    if (sheet['!ref']) {
        const range = XLSX.utils.decode_range(sheet['!ref']);
        totalCols = range.e.c + 1;
    }
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
    return { rows, totalCols };
}

/**
 * Loads file workbook metadata, total column count, and initial raw rows.
 * @param {File} file
 * @returns {Promise<{ isExcel: boolean, sheetNames: string[], workbook: any, rawRows: any[][], totalCols: number }>}
 */
export async function loadFileStructure(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheetNames = workbook.SheetNames || [];
        const firstSheet = sheetNames[0] || '';
        const { rows, totalCols } = firstSheet ? readSheetRows(workbook, firstSheet) : { rows: [], totalCols: 0 };
        return { isExcel: true, sheetNames, workbook, rawRows: rows, totalCols };
    }

    // CSV, TSV, DAT, TXT
    const text = await file.text();
    const rawRows = await new Promise((resolve, reject) => {
        Papa.parse(text, {
            skipEmptyLines: 'greedy',
            complete: (results) => resolve(results.data),
            error: (err) => reject(err)
        });
    });

    let maxCols = 0;
    for (let i = 0; i < Math.min(rawRows.length, 50); i++) {
        if (rawRows[i] && rawRows[i].length > maxCols) maxCols = rawRows[i].length;
    }

    return { isExcel: false, sheetNames: [], workbook: null, rawRows, totalCols: maxCols };
}

/**
 * Reads a File object into a 2D array of raw rows.
 * @param {File} file
 * @returns {Promise<any[][]>}
 */
export async function readRawRowsFromFile(file) {
    const { rawRows } = await loadFileStructure(file);
    return rawRows;
}

/**
 * Inspect raw rows to detect TOA5 format, multi-row headers, full column list, and candidate timestamps.
 * @param {any[][]} rawRows
 * @param {Object} [options]
 * @param {number} [options.manualHeaderRowIdx] - User override for header row index (0-based)
 * @param {number} [options.totalCols] - Total columns from sheet range
 * @returns {Object}
 */
export function inspectTableStructure(rawRows, options = {}) {
    if (!rawRows || rawRows.length === 0) {
        return {
            headerRowIdx: 0,
            headers: [],
            columns: [],
            detectedTimeCol: 0,
            detectedTempCol: 0,
            detectedConvertCtoF: false,
            candidateStartTimes: [],
            isTOA5: false,
            firstDataRowIdx: 0,
            totalCols: 0
        };
    }

    // 1. Determine total column count across top rows (never truncate columns!)
    const scanLimit = Math.min(rawRows.length, 50);
    let totalCols = options.totalCols || 0;
    for (let r = 0; r < scanLimit; r++) {
        if (rawRows[r] && rawRows[r].length > totalCols) {
            totalCols = rawRows[r].length;
        }
    }
    if (totalCols === 0) totalCols = 1;

    // 2. Scan first 15 rows for Campbell Scientific TOA5 signature
    let toa5RowIdx = -1;
    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
        const row = rawRows[r];
        if (row && row.some(c => {
            const s = String(c).trim().toUpperCase();
            return s === 'TOA5' || s.startsWith('TOA5,') || s.startsWith('"TOA5"');
        })) {
            toa5RowIdx = r;
            break;
        }
    }

    const isTOA5 = toa5RowIdx !== -1;
    const toa5FieldRowIdx = isTOA5 ? toa5RowIdx + 1 : -1;
    const toa5UnitRowIdx = isTOA5 ? toa5RowIdx + 2 : -1;
    const toa5ProcessRowIdx = isTOA5 ? toa5RowIdx + 3 : -1;
    const userLabelRowIdx = (isTOA5 && toa5RowIdx > 0) ? toa5RowIdx - 1 : -1;

    // 3. Determine headerRowIdx
    let headerRowIdx = 0;
    if (options.manualHeaderRowIdx !== undefined && options.manualHeaderRowIdx >= 0) {
        headerRowIdx = Math.min(options.manualHeaderRowIdx, rawRows.length - 1);
    } else if (isTOA5) {
        // If user labels exist above TOA5, default to user labels row
        headerRowIdx = userLabelRowIdx >= 0 ? userLabelRowIdx : toa5FieldRowIdx;
    } else {
        // Search first 10 rows for TIMESTAMP or DATE or TIME
        for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
            const row = rawRows[r];
            if (row && row.some(c => {
                const s = String(c).trim().toUpperCase();
                return s.includes('TIMESTAMP') || s.includes('DATETIME') || s.includes('DATE_TIME') || s.includes('TIME');
            })) {
                headerRowIdx = r;
                break;
            }
        }
    }

    // 4. Determine first real data row (starts after TOA5 or after header)
    let firstDataRowIdx = isTOA5 ? toa5RowIdx + 4 : headerRowIdx + 1;
    for (let r = Math.max(0, firstDataRowIdx); r < Math.min(rawRows.length, firstDataRowIdx + 25); r++) {
        if (rawRows[r] && rawRows[r].some(cell => parseDateTimeToMs(cell) !== null)) {
            firstDataRowIdx = r;
            break;
        }
    }

    // 5. Build rich column descriptors for ALL columns from 0 to totalCols - 1
    const columns = [];
    const headers = [];

    for (let c = 0; c < totalCols; c++) {
        const colLetter = getColumnLetter(c);
        const excelName = String(rawRows[0]?.[c] ?? '').trim();
        const userLabel = (userLabelRowIdx >= 0) ? String(rawRows[userLabelRowIdx]?.[c] ?? '').trim() : '';
        const fieldName = (toa5FieldRowIdx >= 0) ? String(rawRows[toa5FieldRowIdx]?.[c] ?? '').trim() : '';
        const unit = (toa5UnitRowIdx >= 0) ? String(rawRows[toa5UnitRowIdx]?.[c] ?? '').trim() : '';
        const manualVal = String(rawRows[headerRowIdx]?.[c] ?? '').trim();

        let title = '';
        if (options.manualHeaderRowIdx !== undefined && manualVal) {
            title = manualVal;
            if (fieldName && fieldName.toLowerCase() !== manualVal.toLowerCase()) {
                title += ` / ${fieldName}`;
            }
        } else if (userLabel && fieldName && userLabel.toLowerCase() !== fieldName.toLowerCase()) {
            title = `${userLabel} / ${fieldName}`;
        } else {
            title = userLabel || fieldName || manualVal || excelName || `Column ${c + 1}`;
        }

        if (unit && !title.toLowerCase().includes(unit.toLowerCase())) {
            title += ` [${unit}]`;
        }

        const displayLabel = `Col ${c + 1} (${colLetter}): ${title}`;
        headers.push(title);

        // Scan first 100 data rows for valid numeric values
        let validNumCount = 0;
        let sampleVal = null;
        for (let r = firstDataRowIdx; r < Math.min(rawRows.length, firstDataRowIdx + 100); r++) {
            const v = rawRows[r]?.[c];
            if (v !== '' && v !== 'NAN' && v !== '#N/A' && v !== '#VALUE!' && v != null) {
                const num = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
                if (!isNaN(num)) {
                    validNumCount++;
                    if (sampleVal === null) sampleVal = num;
                }
            }
        }

        columns.push({
            index: c,
            colLetter,
            title,
            displayLabel,
            userLabel,
            fieldName,
            unit,
            excelName,
            manualVal,
            validNumCount,
            sampleVal
        });
    }

    // 6. Detect Date/Time Column
    let detectedTimeCol = -1;
    for (const col of columns) {
        const text = `${col.userLabel} ${col.fieldName} ${col.title}`.toLowerCase();
        if (text.includes('timestamp') || text.includes('datetime') || text.includes('date_time')) {
            detectedTimeCol = col.index;
            break;
        }
    }
    if (detectedTimeCol === -1) {
        for (const col of columns) {
            const text = `${col.userLabel} ${col.fieldName} ${col.title}`.toLowerCase();
            if (text.includes('time') || text.includes('date')) {
                detectedTimeCol = col.index;
                break;
            }
        }
    }
    if (detectedTimeCol === -1) {
        for (let c = 0; c < totalCols; c++) {
            if (parseDateTimeToMs(rawRows[firstDataRowIdx]?.[c]) !== null) {
                detectedTimeCol = c;
                break;
            }
        }
    }
    if (detectedTimeCol === -1) detectedTimeCol = 0;

    // 7. Detect Temperature Column with weighted scoring
    let detectedTempCol = -1;
    let highestScore = -100;

    for (const col of columns) {
        if (col.index === detectedTimeCol) continue;
        const text = `${col.userLabel} ${col.fieldName} ${col.unit} ${col.excelName} ${col.title}`.toLowerCase();
        let score = 0;

        if (text.includes('temp_c') || text.includes('temp_f') || text.includes('airtc') || text.includes('deg c') || text.includes('deg_c') || text.includes('deg f') || text.includes('deg_f')) {
            score += 60;
        }
        if (text.includes('therm')) score += 50;
        if (text.includes('°c') || text.includes('°f') || text.includes('celsius') || text.includes('fahrenheit')) score += 40;
        if (text.includes('temp') || text.includes('tt_')) score += 30;

        // Penalty for frequency, strain gauge, or record numbers
        if (text.includes('freq') || text.includes('hz') || text.includes('record')) score -= 70;

        // Bonus for having valid numeric values in data rows
        if (col.validNumCount > 0) score += 15;

        if (score > highestScore && score >= 20) {
            highestScore = score;
            detectedTempCol = col.index;
        }
    }

    if (detectedTempCol === -1) {
        for (const col of columns) {
            if (col.index !== detectedTimeCol && col.validNumCount > 0) {
                detectedTempCol = col.index;
                break;
            }
        }
    }
    if (detectedTempCol === -1) {
        detectedTempCol = columns.length > 1 ? 1 : 0;
    }

    // 8. Candidate start times from firstDataRowIdx onward
    const candidateStartTimes = [];
    for (let r = firstDataRowIdx; r < Math.min(rawRows.length, firstDataRowIdx + 50); r++) {
        const val = rawRows[r]?.[detectedTimeCol];
        const ms = parseDateTimeToMs(val);
        if (ms !== null) {
            const formatted = formatDateTime(ms);
            if (!candidateStartTimes.includes(formatted)) {
                candidateStartTimes.push(formatted);
            }
        }
    }

    return {
        headerRowIdx,
        headers,
        columns,
        detectedTimeCol,
        detectedTempCol,
        candidateStartTimes: candidateStartTimes.slice(0, 20),
        isTOA5,
        firstDataRowIdx,
        totalCols
    };
}

/**
 * Process and downsample raw rows starting from chosen start point.
 * Temperature values are treated directly as Fahrenheit (°F).
 *
 * @param {Object} options
 * @param {any[][]} options.rawRows
 * @param {number} [options.headerRowIdx=0]
 * @param {number} [options.firstDataRowIdx]
 * @param {number} [options.timeColIdx=0]
 * @param {number} [options.tempColIdx=1]
 * @param {string} options.startDateTimeStr - The selected start timestamp ("Day 0")
 * @param {number} [options.intervalMinutes=60] - e.g. 60 or 30 or 15 or 5
 * @returns {{ points: Array<{ timestamp: string, day: number, temp: number }>, summary: Object }}
 */
export function processTemperatureSeries({
    rawRows,
    headerRowIdx = 0,
    firstDataRowIdx,
    timeColIdx = 0,
    tempColIdx = 1,
    startDateTimeStr,
    intervalMinutes = 60
}) {
    if (!rawRows || rawRows.length === 0) {
        throw new Error("No data rows to process.");
    }

    const startMs = parseDateTimeToMs(startDateTimeStr);
    if (!startMs) {
        throw new Error(`Invalid start date/time: "${startDateTimeStr}"`);
    }

    const startRow = (firstDataRowIdx !== undefined && firstDataRowIdx > headerRowIdx) ? firstDataRowIdx : headerRowIdx + 1;

    // Step 1: Collect all valid data records at or after startMs
    const validRecords = [];
    for (let r = startRow; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const timeVal = row[timeColIdx];
        const tempVal = row[tempColIdx];

        if (tempVal === '' || tempVal === 'NAN' || tempVal === '#N/A' || tempVal === '#VALUE!' || tempVal == null) {
            continue;
        }

        const timeMs = parseDateTimeToMs(timeVal);
        if (timeMs === null) continue;

        const rawNum = typeof tempVal === 'number' ? tempVal : parseFloat(String(tempVal).replace(/[^\d.-]/g, ''));
        if (isNaN(rawNum)) continue;

        // Keep records from startMs onward (with 1-min tolerance)
        if (timeMs >= startMs - 60000) {
            validRecords.push({ ms: timeMs, temp: rawNum });
        }
    }

    if (validRecords.length === 0) {
        throw new Error("No valid temperature records found at or after the selected Start Date/Time.");
    }

    validRecords.sort((a, b) => a.ms - b.ms);

    const intervalMs = intervalMinutes * 60 * 1000;
    const dayMs = 24 * 60 * 60 * 1000;

    // High-performance single-pass bucketing: strictly O(N)
    const buckets = new Map();
    for (let i = 0; i < validRecords.length; i++) {
        const rec = validRecords[i];
        const delta = rec.ms - startMs;
        if (delta < -30000) continue; // ignore records prior to start
        const k = Math.max(0, Math.round(delta / intervalMs));
        let b = buckets.get(k);
        if (!b) {
            b = { sum: 0, count: 0, targetMs: startMs + k * intervalMs };
            buckets.set(k, b);
        }
        b.sum += rec.temp;
        b.count++;
    }

    const sortedKs = Array.from(buckets.keys()).sort((a, b) => a - b);
    const points = [];
    for (const k of sortedKs) {
        const b = buckets.get(k);
        const elapsedDays = (k * intervalMs) / dayMs;
        points.push({
            timestamp: formatDateTime(b.targetMs),
            day: parseFloat(elapsedDays.toFixed(4)),
            temp: parseFloat((b.sum / b.count).toFixed(2))
        });
    }

    const temps = points.map(p => p.temp);
    const minTemp = temps.length > 0 ? Math.min(...temps) : 0;
    const maxTemp = temps.length > 0 ? Math.max(...temps) : 0;

    return {
        points,
        summary: {
            totalValidRecords: validRecords.length,
            retainedPoints: points.length,
            startDateTime: formatDateTime(startMs),
            endDateTime: points.length > 0 ? points[points.length - 1].timestamp : '',
            intervalMinutes,
            minTemp,
            maxTemp,
            dayCount: points.length > 0 ? points[points.length - 1].day : 0
        }
    };
}
