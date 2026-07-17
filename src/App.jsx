import React, { useState, useEffect } from 'react';
import ProjectSelection from './components/ProjectSelection';
import SectionConfig from './components/SectionConfig';
import DataEntry from './components/DataEntry';
import PavementChart from './components/PavementChart';
import ConflictTable from './components/ConflictTable';
import SCurveChart from './components/SCurveChart';
import FrequencyChart from './components/FrequencyChart';
import CrackPropagationChart from './components/CrackPropagationChart';
import CrackSpacingChart from './components/CrackSpacingChart';
import CrackDensityChart from './components/CrackDensityChart';
import SpacingBoxPlotChart from './components/SpacingBoxPlotChart';
import DataManagement from './components/DataManagement';
import './index.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

const TABS = [
    { id: 'sections', label: '⚙️ Sections' },
    { id: 'data', label: '📋 Data Entry' },
    { id: 'charts', label: '📊 Dashboard' },
    { id: 'data-management', label: '💾 Data Management' }
];

function App() {
    const [projects, setProjects] = useState([]);
    const [activeProject, setActiveProject] = useState(null);
    const [data, setData] = useState({ sections: [], survey_days: [], cracks: [], tolerance: 0.1 });
    const [conflicts, setConflicts] = useState([]);
    const [activeTab, setActiveTab] = useState('sections');
    const [analysisType, setAnalysisType] = useState('overview');
    const [apiError, setApiError] = useState(false);
    const [isLoadingProjects, setIsLoadingProjects] = useState(true);
    const [isLoadingData, setIsLoadingData] = useState(false);

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        if (activeProject) {
            fetchProjectData(activeProject.id);
        }
    }, [activeProject]);

    const fetchProjects = async () => {
        setIsLoadingProjects(true);
        try {
            const res = await fetch(`${API_BASE}/projects`);
            const json = await res.json();
            if (Array.isArray(json)) {
                setProjects(json);
                setApiError(false);
            } else {
                console.error("API returned non-array for projects:", json);
                setProjects([]);
                setApiError(true);
            }
        } catch (err) {
            console.error("Failed to fetch projects:", err);
            setApiError(true);
        } finally {
            setIsLoadingProjects(false);
        }
    };

    const fetchProjectData = async (projectId) => {
        if (projectId == null) {
            console.error("fetchProjectData called with undefined/null projectId – skipping.");
            return;
        }
        setIsLoadingData(true);
        try {
            const res = await fetch(`${API_BASE}/projects/${projectId}/data`);
            if (!res.ok) {
                console.error(`Failed to fetch project data: HTTP ${res.status}`);
                setApiError(true);
                return;
            }
            const json = await res.json();
            setData(json);
            setApiError(false);
        } catch (err) {
            console.error("Failed to fetch project data:", err);
            setApiError(true);
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleCreateProject = async (name) => {
        try {
            const res = await fetch(`${API_BASE}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const newProject = await res.json();
            if (!newProject || newProject.id == null) {
                console.error("Failed to create project: server returned no valid project ID", newProject);
                alert('Error: Project was not created properly. Please try again.');
                return;
            }
            setProjects([newProject, ...projects]);
            setActiveProject(newProject);
        } catch (err) {
            console.error("Failed to create project:", err);
        }
    };

    const handleSaveSections = async (sections) => {
        if (!activeProject || activeProject.id == null) {
            console.error("handleSaveSections: activeProject.id is undefined – aborting save.");
            throw new Error('No active project selected.');
        }
        const res = await fetch(`${API_BASE}/projects/${activeProject.id}/sections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sections)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Server error ${res.status}`);
        }
        fetchProjectData(activeProject.id);
    };

    const handleAddDay = async (newDay) => {
        const res = await fetch(`${API_BASE}/projects/${activeProject.id}/survey-days`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newDay, project_id: activeProject.id })
        });
        const createdDay = await res.json();
        fetchProjectData(activeProject.id);
        return createdDay;
    };

    const handleUploadCracks = async (dayId, distances) => {
        const res = await fetch(`${API_BASE}/projects/${activeProject.id}/upload-cracks?day_id=${dayId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(distances)
        });
        const result = await res.json();
        fetchProjectData(activeProject.id);
        if (result.status === 'conflict') {
            setConflicts(result.conflicts);
        } else {
            setConflicts([]);
        }
        return result.status;
    };

    const handleResolveConflict = async (index, type) => {
        const conflict = conflicts[index];
        const resolutions = [{
            type,
            new_distance: conflict.new_distance,
            existing_id: conflict.existing_crack.id,
            day_id: conflict.day_id
        }];

        await fetch(`${API_BASE}/projects/${activeProject.id}/resolve-conflicts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resolutions)
        });

        const newConflicts = [...conflicts];
        newConflicts.splice(index, 1);
        setConflicts(newConflicts);
        if (newConflicts.length === 0) fetchProjectData(activeProject.id);
    };

    const handleDeleteDay = async (dayId) => {
        if (!window.confirm("Are you sure you want to delete this survey day and all its measurements? This cannot be undone.")) return;
        await fetch(`${API_BASE}/projects/${activeProject.id}/survey-days/${dayId}`, { method: 'DELETE' });
        fetchProjectData(activeProject.id);
    };

    const handleUpdateDay = async (dayId, updatedDay) => {
        await fetch(`${API_BASE}/projects/${activeProject.id}/survey-days/${dayId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedDay)
        });
        fetchProjectData(activeProject.id);
    };

    const handleBulkDelete = async (crackIds) => {
        await fetch(`${API_BASE}/projects/${activeProject.id}/cracks/bulk-delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(crackIds)
        });
        fetchProjectData(activeProject.id);
    };

    const handleDeleteCrack = async (crackId) => {
        await fetch(`${API_BASE}/projects/${activeProject.id}/cracks/${crackId}`, { method: 'DELETE' });
        fetchProjectData(activeProject.id);
    };

    const handleUpdateCrack = async (crackId, newDistance) => {
        await fetch(`${API_BASE}/projects/${activeProject.id}/cracks/${crackId}?distance=${newDistance}`, { method: 'PUT' });
        fetchProjectData(activeProject.id);
    };

    const handleReorderDays = async (dayIds) => {
        await fetch(`${API_BASE}/projects/${activeProject.id}/survey-days/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dayIds)
        });
        fetchProjectData(activeProject.id);
    };

    const handleUpdateProject = async (projectId, newName) => {
        try {
            const res = await fetch(`${API_BASE}/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || 'Failed to update project');
            }
            fetchProjects();
        } catch (err) {
            console.error("Failed to update project:", err);
            alert(`Error updating project: ${err.message}`);
        }
    };

    const handleDeleteProject = async (projectId) => {
        try {
            const res = await fetch(`${API_BASE}/projects/${projectId}`, { method: 'DELETE' });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || 'Failed to delete project');
            }
            fetchProjects();
        } catch (err) {
            console.error("Failed to delete project:", err);
            alert(`Error deleting project: ${err.message}`);
        }
    };

    const handleDuplicateProject = async (projectId) => {
        try {
            const res = await fetch(`${API_BASE}/projects/${projectId}/duplicate`, { method: 'POST' });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || 'Failed to duplicate project');
            }
            fetchProjects();
        } catch (err) {
            console.error("Failed to duplicate project:", err);
            alert(`Error duplicating project: ${err.message}`);
        }
    };

    if (!activeProject) {
        return (
            <>
                {apiError && (
                    <div className="api-error-banner" style={{ textAlign: 'center', background: '#fee2e2', color: '#b91c1c', padding: '1rem', fontWeight: 600 }}>
                        ⚠️ Cannot connect to backend (localhost:8000). Please ensure the Python server is running and restarted.
                    </div>
                )}
                <ProjectSelection
                    projects={projects}
                    isLoading={isLoadingProjects}
                    onSelectProject={setActiveProject}
                    onCreateProject={handleCreateProject}
                    onUpdateProject={handleUpdateProject}
                    onDeleteProject={handleDeleteProject}
                    onDuplicateProject={handleDuplicateProject}
                />
            </>
        );
    }

    return (
        <div className="app-shell">
            <header className="app-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={() => setActiveProject(null)}
                            style={{
                                background: '#f1f5f9', border: 'none', borderRadius: '8px',
                                padding: '0.5rem 0.75rem', fontSize: '0.875rem', fontWeight: 600,
                                color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
                            }}
                        >
                            ← Switch Project
                        </button>
                        <h1 className="app-title" style={{ margin: 0 }}>
                            {activeProject.name}
                        </h1>
                    </div>
                </div>

                {apiError && (
                    <div className="api-error-banner">
                        ⚠️ Cannot connect to backend (localhost:8000). Make sure the Python server is running.
                    </div>
                )}

                <nav className="tab-nav">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`tab-btn ${activeTab === tab.id ? 'tab-btn--active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                            {tab.id === 'data' && conflicts.length > 0 && (
                                <span className="tab-badge">{conflicts.length}</span>
                            )}
                        </button>
                    ))}
                </nav>
            </header>

            <main className="tab-content">
                {isLoadingData ? (
                    <div style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', color: '#64748b' }}>
                            <div style={{
                                width: '20px', height: '20px', border: '3px solid #e2e8f0',
                                borderTopColor: '#2563eb', borderRadius: '50%',
                                animation: 'spin 0.7s linear infinite', flexShrink: 0
                            }} />
                            <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Loading project data…</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {[200, 160, 120, 140, 100].map((w, i) => (
                                <div key={i} style={{
                                    height: '18px', width: `${w}px`, borderRadius: '6px',
                                    background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                                    backgroundSize: '800px 100%', animation: 'shimmer 1.4s infinite linear'
                                }} />
                            ))}
                            <div style={{ marginTop: '1rem', background: '#f8fafc', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
                                {[100, 80, 90, 70, 85, 60].map((w, i) => (
                                    <div key={i} style={{
                                        height: '14px', width: `${w}%`, borderRadius: '4px', marginBottom: '0.75rem',
                                        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                                        backgroundSize: '800px 100%', animation: 'shimmer 1.4s infinite linear'
                                    }} />
                                ))}
                            </div>
                        </div>
                        <style>{`
                            @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
                            @keyframes spin { to { transform: rotate(360deg); } }
                        `}</style>
                    </div>
                ) : (
                    <>
                        {activeTab === 'sections' && (
                            <SectionConfig sections={data.sections} onSave={handleSaveSections} />
                        )}

                        {activeTab === 'data' && (
                            <>
                                <DataEntry
                                    sections={data.sections}
                                    surveyDays={data.survey_days}
                                    cracks={data.cracks}
                                    onUpload={handleUploadCracks}
                                    onDelete={handleDeleteCrack}
                                    onUpdate={handleUpdateCrack}
                                    onUpdateDay={handleUpdateDay}
                                    onDeleteDay={handleDeleteDay}
                                    onAddDay={handleAddDay}
                                    onBulkDelete={handleBulkDelete}
                                    onReorderDays={handleReorderDays}
                                />
                                {conflicts.length > 0 && (
                                    <ConflictTable conflicts={conflicts} onResolve={handleResolveConflict} />
                                )}
                            </>
                        )}

                        {activeTab === 'charts' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#ffffff', padding: '0.75rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <span style={{ fontWeight: 600, color: '#475569', fontSize: '0.95rem' }}>Analysis Type:</span>
                                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.3rem', borderRadius: '8px', gap: '0.3rem' }}>
                                        {[
                                            { id: 'overview', label: 'Cracks Layout' },
                                            { id: 'scurve', label: 'Cumulative Distribution (S-Curve)' },
                                            { id: 'frequency', label: 'Spacing Frequency' },
                                            { id: 'other', label: 'Other Analyses' },
                                        ].map(at => (
                                            <button
                                                key={at.id}
                                                onClick={() => setAnalysisType(at.id)}
                                                style={{
                                                    padding: '0.4rem 1rem', fontSize: '0.85rem', fontWeight: 600,
                                                    border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                                                    background: analysisType === at.id ? '#ffffff' : 'transparent',
                                                    color: analysisType === at.id ? '#0f172a' : '#64748b',
                                                    boxShadow: analysisType === at.id ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                                                }}
                                            >
                                                {at.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {analysisType === 'overview' && (
                                    <PavementChart sections={data.sections} cracks={data.cracks} surveyDays={data.survey_days} />
                                )}
                                {analysisType === 'scurve' && (
                                    <SCurveChart sections={data.sections} cracks={data.cracks} surveyDays={data.survey_days} />
                                )}
                                {analysisType === 'frequency' && (
                                    <FrequencyChart sections={data.sections} cracks={data.cracks} surveyDays={data.survey_days} />
                                )}
                                {analysisType === 'other' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                        <CrackSpacingChart sections={data.sections} cracks={data.cracks} surveyDays={data.survey_days} />
                                        <CrackPropagationChart sections={data.sections} cracks={data.cracks} surveyDays={data.survey_days} />
                                        <SpacingBoxPlotChart sections={data.sections} cracks={data.cracks} />
                                        <CrackDensityChart sections={data.sections} cracks={data.cracks} surveyDays={data.survey_days} />
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'data-management' && (
                            <DataManagement
                                activeProject={activeProject}
                                onImportComplete={() => fetchProjectData(activeProject.id)}
                            />
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

export default App;
