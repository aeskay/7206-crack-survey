import { get, set, del } from 'idb-keyval';

export const DEFAULT_TEMP_SETTINGS = {
    enabled: true,
    color: '#dc2626',
    min: '',
    max: '',
    dtick: '',
    yTitle: 'Temperature (<sup>o</sup>F)'
};

const getStorageKey = (projectId) => `crack_survey_temp_${projectId || 'default'}`;

/**
 * Retrieve saved temperature data and settings for a given project from browser IndexedDB.
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
 * Save temperature data and metadata to IndexedDB for a given project.
 * @param {string|number} projectId
 * @param {Object} tempBundle
 * @returns {Promise<void>}
 */
export async function saveProjectTemperature(projectId, tempBundle) {
    if (!projectId || !tempBundle) return;
    try {
        await set(getStorageKey(projectId), {
            ...tempBundle,
            projectId: Number(projectId),
            updatedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('Failed to save temperature data to IndexedDB:', err);
        throw err;
    }
}

/**
 * Update chart display settings for the project's temperature series in IndexedDB.
 * @param {string|number} projectId
 * @param {Object} newSettings
 * @returns {Promise<Object>} updated full bundle
 */
export async function updateProjectTemperatureSettings(projectId, newSettings) {
    if (!projectId) return {};
    try {
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
        await set(getStorageKey(projectId), merged);
        return merged;
    } catch (err) {
        console.error('Failed to update temperature settings in IndexedDB:', err);
        throw err;
    }
}

/**
 * Delete temperature data for a project from IndexedDB.
 * @param {string|number} projectId
 * @returns {Promise<void>}
 */
export async function clearProjectTemperature(projectId) {
    if (!projectId) return;
    try {
        await del(getStorageKey(projectId));
    } catch (err) {
        console.error('Failed to delete temperature data from IndexedDB:', err);
        throw err;
    }
}
