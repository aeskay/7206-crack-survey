import { useState, useEffect, useCallback } from 'react';
import {
    getProjectTemperature,
    syncProjectTemperatureWithFirestore,
    saveProjectTemperature,
    updateProjectTemperatureSettings,
    clearProjectTemperature,
    DEFAULT_TEMP_SETTINGS
} from './temperatureStore';

export function useProjectTemperature(projectId) {
    const [tempBundle, setTempBundle] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const loadData = useCallback(async () => {
        if (!projectId) {
            setTempBundle(null);
            setIsLoading(false);
            return;
        }

        // 1. Instant local read from IndexedDB (< 5ms) - Zero lag, presentation-ready
        try {
            const cached = await getProjectTemperature(projectId);
            if (cached) {
                setTempBundle(cached);
            }
        } catch (err) {
            console.warn('Local temperature cache read warning:', err);
        }

        // 2. Non-blocking background sync with Firestore (Stale-While-Revalidate)
        syncProjectTemperatureWithFirestore(projectId).then(fresh => {
            if (fresh) {
                setTempBundle(fresh);
            }
        }).catch(err => {
            console.warn('Background temperature sync warning:', err);
        });
    }, [projectId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSaveBundle = useCallback(async (newBundle) => {
        if (!projectId) return;
        const completeBundle = {
            ...newBundle,
            settings: {
                ...DEFAULT_TEMP_SETTINGS,
                ...(newBundle.settings || {})
            }
        };
        // Instant local save + background Firestore upload
        await saveProjectTemperature(projectId, completeBundle);
        setTempBundle(completeBundle);
    }, [projectId]);

    const handleUpdateSettings = useCallback((newSettings) => {
        if (!projectId) return;
        // Optimistic instant state update for immediate chart rendering
        setTempBundle(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                settings: {
                    ...(prev.settings || DEFAULT_TEMP_SETTINGS),
                    ...newSettings
                }
            };
        });
        // Background persistence without blocking UI
        updateProjectTemperatureSettings(projectId, newSettings).catch(err => {
            console.warn('Failed to persist temperature settings:', err);
        });
    }, [projectId]);

    const handleClear = useCallback(async () => {
        if (!projectId) return;
        await clearProjectTemperature(projectId);
        setTempBundle(null);
    }, [projectId]);

    return {
        tempBundle,
        isLoading,
        saveBundle: handleSaveBundle,
        updateSettings: handleUpdateSettings,
        clearTemperature: handleClear,
        refresh: loadData
    };
}
