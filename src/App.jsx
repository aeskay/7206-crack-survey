import React, { useState, useEffect } from 'react';
import ProjectSelection from './components/ProjectSelection';
import SectionConfig from './components/SectionConfig';
import DataEntry from './components/DataEntry';
import PavementChart from './components/PavementChart';
import ConflictTable from './components/ConflictTable';
import SCurveChart from './components/SCurveChart';
import FrequencyChart from './components/FrequencyChart';
import CrackPropagationChart from './components/CrackPropagationChart';
import CrackDensityChart from './components/CrackDensityChart';
import SpacingBoxPlotChart from './components/SpacingBoxPlotChart';
import './index.css';

const API_BASE = 'http://127.0.0.1:8000';

const TABS = [
    { id: 'sections', label: '⚙️ Sections' },
    { id: 'data', label: '📋 Data Entry' },
    { id: 'charts', label: '📊 Dashboard' },
];

function App() {
    const [projects, setProjects] = useState([]);
    const [activeProject, setActiveProject] = useState(null);
    const [data, setData] = useState({ sections: [], survey_days: [], cracks: [], tolerance: 0.1 });
    const [conflicts, setConflicts] = useState([]);
    const [activeTab, setActiveTab] = useState('sections');
    const [analysisType, setAnalysisType] = useState('overview');
    const [apiError, setApiError] = useState(false);

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        if (activeProject) {
            fetchProjectData(activeProject.id);
        }
    }, [activeProject]);

    const fetchProjects = async () => {
        try {
            const res = await fetch(`${API_BASE}/projects`);
            const json = await res.json();
            if (Array.isArray(json)) {
                setProjects(json);
                setApiError(false);
            } else {
                console.error("API returned non-array for projects:", json);
                setProjects([]);
                // If it's a 404, the server definitely needs a restart or has an error
                setApiError(true);
            }
        } catch (err) {
            console.error("Failed to fetch projects:", err);
            setApiError(true);
        }
    };

    const fetchProjectData = async (projectId) => {
        try {
            const res = await fetch(`${API_BASE}/projects/${projectId}/data`);
            const json = await res.json();
            setData(json);
            setApiError(false);
        } catch (err) {
            console.error("Failed to fetch project data:", err);
            setApiError(true);
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
            setProjects([newProject, ...projects]);
            setActiveProject(newProject);
        } catch (err) {
            console.error("Failed to create project:", err);
        }
    };

    const handleSaveSections = async (sections) => {
        await fetch(`${API_BASE}/projects/${activeProject.id}/sections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sections)
        });
        fetchProjectData(activeProject.id);
    };

    const handleAddDay = async (newDay) => {
        await fetch(`${API_BASE}/projects/${activeProject.id}/survey-days`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newDay)
        });
        fetchProjectData(activeProject.id);
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
            await fetch(`${API_BASE}/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
            fetchProjects();
        } catch (err) {
            console.error("Failed to update project:", err);
        }
    };

    const handleDeleteProject = async (projectId) => {
        try {
            await fetch(`${API_BASE}/projects/${projectId}`, { method: 'DELETE' });
            fetchProjects();
        } catch (err) {
            console.error("Failed to delete project:", err);
        }
    };

    const handleDuplicateProject = async (projectId) => {
        try {
            await fetch(`${API_BASE}/projects/${projectId}/duplicate`, { method: 'POST' });
            fetchProjects();
        } catch (err) {
            console.error("Failed to duplicate project:", err);
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
                                background: '#f1f5f9',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                color: '#475569',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
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
                {activeTab === 'sections' && (
                    <SectionConfig sections={data.sections} onSave={handleSaveSections} />
                )}

                {activeTab === 'data' && (
                    <>
                        <DataEntry
                            surveyDays={data.survey_days}
                            cracks={data.cracks}
                            onUpload={handleUploadCracks}
                            onDelete={handleDeleteCrack}
                            onUpdate={handleUpdateCrack}
                            onUpdateDay={handleUpdateDay}
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
                                <button
                                    onClick={() => setAnalysisType('overview')}
                                    style={{
                                        padding: '0.4rem 1rem', fontSize: '0.85rem', fontWeight: 600, border: 'none',
                                        borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                                        background: analysisType === 'overview' ? '#ffffff' : 'transparent',
                                        color: analysisType === 'overview' ? '#0f172a' : '#64748b',
                                        boxShadow: analysisType === 'overview' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                                    }}
                                >
                                    Cracks Layout
                                </button>
                                <button
                                    onClick={() => setAnalysisType('scurve')}
                                    style={{
                                        padding: '0.4rem 1rem', fontSize: '0.85rem', fontWeight: 600, border: 'none',
                                        borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                                        background: analysisType === 'scurve' ? '#ffffff' : 'transparent',
                                        color: analysisType === 'scurve' ? '#0f172a' : '#64748b',
                                        boxShadow: analysisType === 'scurve' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                                    }}
                                >
                                    Cumulative Distribution (S-Curve)
                                </button>
                                <button
                                    onClick={() => setAnalysisType('frequency')}
                                    style={{
                                        padding: '0.4rem 1rem', fontSize: '0.85rem', fontWeight: 600, border: 'none',
                                        borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                                        background: analysisType === 'frequency' ? '#ffffff' : 'transparent',
                                        color: analysisType === 'frequency' ? '#0f172a' : '#64748b',
                                        boxShadow: analysisType === 'frequency' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                                    }}
                                >
                                    Spacing Frequency
                                </button>
                                <button
                                    onClick={() => setAnalysisType('other')}
                                    style={{
                                        padding: '0.4rem 1rem', fontSize: '0.85rem', fontWeight: 600, border: 'none',
                                        borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                                        background: analysisType === 'other' ? '#ffffff' : 'transparent',
                                        color: analysisType === 'other' ? '#0f172a' : '#64748b',
                                        boxShadow: analysisType === 'other' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                                    }}
                                >
                                    Other Analyses
                                </button>
                            </div>
                        </div>

                        {analysisType === 'overview' && (
                            <PavementChart
                                sections={data.sections}
                                cracks={data.cracks}
                                surveyDays={data.survey_days}
                            />
                        )}
                        {analysisType === 'scurve' && (
                            <SCurveChart
                                sections={data.sections}
                                cracks={data.cracks}
                                surveyDays={data.survey_days}
                            />
                        )}
                        {analysisType === 'frequency' && (
                            <FrequencyChart
                                sections={data.sections}
                                cracks={data.cracks}
                                surveyDays={data.survey_days}
                            />
                        )}
                        {analysisType === 'other' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                <CrackPropagationChart
                                    sections={data.sections}
                                    cracks={data.cracks}
                                    surveyDays={data.survey_days}
                                />
                                <SpacingBoxPlotChart
                                    sections={data.sections}
                                    cracks={data.cracks}
                                />
                                <CrackDensityChart
                                    sections={data.sections}
                                    cracks={data.cracks}
                                    surveyDays={data.survey_days}
                                />
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
