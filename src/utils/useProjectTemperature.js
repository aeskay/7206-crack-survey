import { useState, useEffect, useCallback } from 'react';
import {
    getProjectTemperature,
    saveProjectTemperature,
    updateProjectTemperatureSettings,
    clearProjectTemperature,
    DEFAULT_TEMP_SETTINGS
} from './temperatureStore';

export function useProjectTemperature(projectId) {
    const [tempBundle, setTempBundle] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const loadData = useCallback(async () => {
        if (!projectId) {
            setTempBundle(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const stored = await getProjectTemperature(projectId);
            setTempBundle(stored);
        } catch (err) {
            console.error('Error loading project temperature:', err);
            setTempBundle(null);
        } finally {
            setIsLoading(false);
        }
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
        await saveProjectTemperature(projectId, completeBundle);
        setTempBundle(completeBundle);
    }, [projectId]);

    const handleUpdateSettings = useCallback(async (newSettings) => {
        if (!projectId) return;
        const updated = await updateProjectTemperatureSettings(projectId, newSettings);
        setTempBundle(updated);
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
