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

function sanitizeForFirestore(projectId, bundle) {
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
 * Retrieve saved temperature data and settings for a given project from local IndexedDB.
 * Blazing fast: returns in < 5ms without blocking the UI.
 * @param {string|number} projectId
 * @returns {Promise<Object|null>}
 */
export async function getProjectTemperature(projectId) {
    if (!projectId) return null;
    try {
        const data = await get(getStorageKey(projectId));
        return data || null;
    } catch (err) {
        console.warn('Failed to load temperature data from IndexedDB:', err);
        return null;
    }
}

/**
 * Non-blocking background sync with Firestore (Stale-While-Revalidate).
 * Checks if cloud has data or if local needs to be uploaded to cloud.
 * @param {string|number} projectId
 * @returns {Promise<Object|null>} Updated bundle if cloud was newer, or null if no update needed
 */
export async function syncProjectTemperatureWithFirestore(projectId) {
    if (!projectId) return null;
    try {
        const local = await getProjectTemperature(projectId);
        const docRef = doc(db, 'project_temperatures', String(projectId));
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const remote = snap.data();
            const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
            const localTime = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0;

            if (!local || remoteTime > localTime) {
                // Cloud is newer (or local had no data) -> update local IndexedDB cache
                await set(getStorageKey(projectId), remote);
                return remote;
            } else if (local && localTime > remoteTime) {
                // Local is newer -> push to cloud in background
                const sanitized = sanitizeForFirestore(projectId, local);
                setDoc(docRef, sanitized).catch(e => console.warn('Background Firestore push failed:', e));
            }
        } else if (local) {
            // Local exists but cloud doesn't have it yet -> upload local to cloud in background
            const sanitized = sanitizeForFirestore(projectId, local);
            setDoc(docRef, sanitized).catch(e => console.warn('Background initial Firestore sync failed:', e));
        }
        return null;
    } catch (err) {
        console.warn('Background Firestore sync skipped (offline or unauthenticated):', err);
        return null;
    }
}

/**
 * Save temperature data and metadata to IndexedDB immediately, then sync to Firestore in background.
 * @param {string|number} projectId
 * @param {Object} tempBundle
 * @returns {Promise<void>}
 */
export async function saveProjectTemperature(projectId, tempBundle) {
    if (!projectId || !tempBundle) return;
    const complete = {
        ...tempBundle,
        projectId: Number(projectId),
        updatedAt: new Date().toISOString()
    };

    // 1. Instant local IndexedDB write (0ms UI wait)
    try {
        await set(getStorageKey(projectId), complete);
    } catch (err) {
        console.error('Failed to save temperature data to IndexedDB:', err);
    }

    // 2. Non-blocking background cloud persist to Firestore
    try {
        const sanitized = sanitizeForFirestore(projectId, complete);
        const docRef = doc(db, 'project_temperatures', String(projectId));
        setDoc(docRef, sanitized).catch(e => console.warn('Background Firestore write failed:', e));
    } catch (e) {
        console.warn('Could not initiate Firestore write:', e);
    }
}

// Debounce timer for background settings updates
let settingsDebounceTimer = null;
let pendingSettings = {};

/**
 * Update chart display settings in IndexedDB immediately, and debounces Firestore update in background.
 * @param {string|number} projectId
 * @param {Object} newSettings
 * @returns {Promise<Object>} updated full bundle
 */
export async function updateProjectTemperatureSettings(projectId, newSettings) {
    if (!projectId) return {};
    pendingSettings = { ...pendingSettings, ...newSettings };

    const existing = (await get(getStorageKey(projectId))) || {};
    const merged = {
        ...existing,
        projectId: Number(projectId),
        settings: {
            ...(existing.settings || DEFAULT_TEMP_SETTINGS),
            ...newSettings
        },
        updatedAt: new Date().toISOString()
    };

    // Save immediately to local IndexedDB (instant)
    try {
        await set(getStorageKey(projectId), merged);
    } catch (e) {}

    // Debounce cloud write by 500ms so rapid changes don't send repeated network requests
    if (settingsDebounceTimer) {
        clearTimeout(settingsDebounceTimer);
    }
    settingsDebounceTimer = setTimeout(async () => {
        try {
            const docRef = doc(db, 'project_temperatures', String(projectId));
            await setDoc(docRef, { settings: merged.settings, updatedAt: merged.updatedAt }, { merge: true });
        } catch (e) {
            console.warn('Background Firestore settings update warning:', e);
        }
    }, 500);

    return merged;
}

/**
 * Delete temperature data for a project from IndexedDB and Firestore.
 * @param {string|number} projectId
 * @returns {Promise<void>}
 */
export async function clearProjectTemperature(projectId) {
    if (!projectId) return;

    // 1. Delete immediately from IndexedDB
    try {
        await del(getStorageKey(projectId));
    } catch (err) {
        console.error('Failed to delete temperature data from IndexedDB:', err);
    }

    // 2. Delete from Firestore in background
    try {
        const docRef = doc(db, 'project_temperatures', String(projectId));
        deleteDoc(docRef).catch(e => console.warn('Background Firestore delete warning:', e));
    } catch (e) {}
}
