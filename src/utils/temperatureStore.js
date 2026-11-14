import { get, set, del } from 'idb-keyval';
import { db } from '../firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

export const DEFAULT_TEMP_SETTINGS = {
    enabled: true,
    color: '#dc2626',
    min: '',
    max: '',
    dtick: '',
    yTitle: 'Temperature (<sup>o</sup>F)'
};

const getStorageKey = (projectId) => `crack_survey_temp_${projectId || 'default'}`;
const API_BASE = import.meta.env?.VITE_API_BASE || 'http://127.0.0.1:8000';

function sanitizeBundle(projectId, bundle) {
    if (!bundle) return null;
    return {
        projectId: Number(projectId),
        fileName: String(bundle.fileName || 'temperature.csv').slice(0, 200),
        sheetName: bundle.sheetName ? String(bundle.sheetName).slice(0, 200) : null,
        data: Array.isArray(bundle.data) ? bundle.data : [],
        summary: bundle.summary && typeof bundle.summary === 'object' ? bundle.summary : {},
        meta: bundle.meta && typeof bundle.meta === 'object' ? bundle.meta : {},
        settings: {
            ...DEFAULT_TEMP_SETTINGS,
            ...(bundle.settings && typeof bundle.settings === 'object' ? bundle.settings : {})
        },
        updatedAt: bundle.updatedAt || new Date().toISOString()
    };
}

/**
 * Retrieve saved temperature data and settings for a given project from Firestore / local cache.
 * @param {string|number} projectId
 * @returns {Promise<Object|null>}
 */
export async function getProjectTemperature(projectId) {
    if (!projectId) return null;

    // 1. Check local IndexedDB first for instant cache response
    let localData = null;
    try {
        localData = await get(getStorageKey(projectId));
    } catch (err) {
        console.warn('Failed to read temperature from IndexedDB:', err);
    }

    // 2. Fetch fresh copy from Firestore
    try {
        const docRef = doc(db, 'project_temperatures', String(projectId));
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const remoteData = snap.data();
            // Cache locally in IndexedDB
            await set(getStorageKey(projectId), remoteData);
            return remoteData;
        } else if (localData) {
            // Document does not exist on Firestore: if local exists, sync it up to Firestore
            try {
                const sanitized = sanitizeBundle(projectId, localData);
                await setDoc(docRef, sanitized);
                return sanitized;
            } catch (syncErr) {
                console.warn('Could not sync local temperature to Firestore:', syncErr);
                return localData;
            }
        }
        return null;
    } catch (fsErr) {
        console.warn('Firestore temperature fetch failed, trying API/cache:', fsErr);
    }

    // 3. Fallback: try FastAPI endpoint if Firestore client had network/permission issues
    try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/temperature`);
        if (res.ok) {
            const json = await res.json();
            if (json?.temperature) {
                await set(getStorageKey(projectId), json.temperature);
                return json.temperature;
            }
        }
    } catch (apiErr) {
        // Backend not running or unreachable
    }

    return localData || null;
}

/**
 * Save temperature data and metadata to Firestore and IndexedDB for a given project.
 * @param {string|number} projectId
 * @param {Object} tempBundle
 * @returns {Promise<void>}
 */
export async function saveProjectTemperature(projectId, tempBundle) {
    if (!projectId || !tempBundle) return;
    const sanitized = sanitizeBundle(projectId, {
        ...tempBundle,
        updatedAt: new Date().toISOString()
    });

    // 1. Save immediately to IndexedDB
    try {
        await set(getStorageKey(projectId), sanitized);
    } catch (idbErr) {
        console.warn('Failed to save temperature to IndexedDB:', idbErr);
    }

    // 2. Save to Firestore
    try {
        const docRef = doc(db, 'project_temperatures', String(projectId));
        await setDoc(docRef, sanitized);
    } catch (fsErr) {
        console.error('Failed to save temperature to Firestore:', fsErr);
    }

    // 3. Also persist to FastAPI backend if available
    try {
        await fetch(`${API_BASE}/projects/${projectId}/temperature`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sanitized)
        });
    } catch (apiErr) {
        // Backend optional
    }
}

// Debounce timer for remote settings writes to prevent network thrashing on rapid typing
let remoteSettingsTimeout = null;
let pendingSettingsByProject = {};

/**
 * Update just the chart display settings for the project's temperature series.
 * @param {string|number} projectId
 * @param {Object} newSettings
 * @returns {Promise<Object>} updated full bundle
 */
export async function updateProjectTemperatureSettings(projectId, newSettings) {
    if (!projectId) return {};

    pendingSettingsByProject[projectId] = {
        ...(pendingSettingsByProject[projectId] || {}),
        ...newSettings
    };

    let existing = await get(getStorageKey(projectId));
    if (!existing) {
        try {
            const snap = await getDoc(doc(db, 'project_temperatures', String(projectId)));
            if (snap.exists()) existing = snap.data();
        } catch (e) {}
    }

    const merged = {
        ...(existing || {}),
        projectId: Number(projectId),
        fileName: existing?.fileName || 'temperature.csv',
        data: existing?.data || [],
        summary: existing?.summary || {},
        settings: {
            ...(existing?.settings || DEFAULT_TEMP_SETTINGS),
            ...pendingSettingsByProject[projectId]
        },
        updatedAt: new Date().toISOString()
    };

    // Save immediately to local IndexedDB
    try {
        await set(getStorageKey(projectId), merged);
    } catch (e) {}

    // Debounce remote writes (Firestore + Backend) by 400ms so typing is frictionless
    if (remoteSettingsTimeout) {
        clearTimeout(remoteSettingsTimeout);
    }

    remoteSettingsTimeout = setTimeout(async () => {
        const toSaveSettings = pendingSettingsByProject[projectId];
        delete pendingSettingsByProject[projectId];

        if (!toSaveSettings) return;

        // Save to Firestore
        try {
            const docRef = doc(db, 'project_temperatures', String(projectId));
            await setDoc(docRef, { settings: toSaveSettings, updatedAt: new Date().toISOString() }, { merge: true });
        } catch (fsErr) {
            console.warn('Failed to update temperature settings in Firestore:', fsErr);
        }

        // Backend update (only update settings, don't re-post full series data)
        try {
            await fetch(`${API_BASE}/projects/${projectId}/temperature`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: Number(projectId),
                    settings: toSaveSettings
                })
            });
        } catch (e) {}
    }, 400);

    return merged;
}

/**
 * Delete temperature data for a project from Firestore and IndexedDB.
 * @param {string|number} projectId
 * @returns {Promise<void>}
 */
export async function clearProjectTemperature(projectId) {
    if (!projectId) return;

    // Delete from IndexedDB
    try {
        await del(getStorageKey(projectId));
    } catch (e) {}

    // Delete from Firestore
    try {
        const docRef = doc(db, 'project_temperatures', String(projectId));
        await deleteDoc(docRef);
    } catch (fsErr) {
        console.error('Failed to delete temperature from Firestore:', fsErr);
    }

    // Delete from backend
    try {
        await fetch(`${API_BASE}/projects/${projectId}/temperature`, { method: 'DELETE' });
    } catch (e) {}
}
