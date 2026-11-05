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
import Login from './components/Login';
import AccessDenied from './components/AccessDenied';
import UserManagement from './components/UserManagement';
import { useProjectTemperature } from './utils/useProjectTemperature';
import { auth, onAuthStateChanged, signOut, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import logo from './assets/logo.png';
import './index.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

const SUPER_ADMINS = ['samuel.alalade@ttu.edu', 'alaladesambluez@gmail.com'];

const BASE_TABS = [
    { id: 'sections', label: '⚙️ Sections' },
    { id: 'data', label: '📋 Data Entry' },
    { id: 'charts', label: '📊 Dashboard' },
    { id: 'data-management', label: '💾 Data Management' }
];

function App() {
    // Auth state
    const [currentUser, setCurrentUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showUserManagement, setShowUserManagement] = useState(false);

    // App state
    const [projects, setProjects] = useState([]);
    const [activeProject, setActiveProject] = useState(null);
    const [data, setData] = useState({ sections: [], survey_days: [], cracks: [], tolerance: 0.1 });
    const [conflicts, setConflicts] = useState([]);
    const [activeTab, setActiveTab] = useState('sections');
    const [analysisType, setAnalysisType] = useState('overview');
    const [apiError, setApiError] = useState(false);
    const [isLoadingProjects, setIsLoadingProjects] = useState(true);
    const [isLoadingData, setIsLoadingData] = useState(false);

    const {
        tempBundle,
        saveBundle: handleSaveTempBundle,
        updateSettings: handleUpdateTempSettings,
        clearTemperature: handleClearTempData
    } = useProjectTemperature(activeProject?.id);

    // Listen to Firebase Auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setCurrentUser(null);
                setIsAuthorized(false);
                setIsAdmin(false);
                setAuthLoading(false);
                return;
            }

            const cleanEmail = (user.email || '').toLowerCase().trim();
            const isSuper = SUPER_ADMINS.some(sa => sa.toLowerCase() === cleanEmail);

            if (isSuper) {
                setCurrentUser(user);
                setIsAuthorized(true);
                setIsAdmin(true);
                setAuthLoading(false);

                // Silently ensure super admin doc exists in Firestore
                try {
                    await setDoc(doc(db, 'authorized_users', cleanEmail), {
                        id: cleanEmail,
                        email: cleanEmail,
                        role: 'admin',
                        added_by: 'system',
                        added_at: 'Permanent Super Admin'
                    }, { merge: true });
                } catch (e) {
                    console.warn("Could not sync super admin to Firestore:", e);
                }
            } else {
                try {
                    const userSnap = await getDoc(doc(db, 'authorized_users', cleanEmail));
                    if (userSnap.exists()) {
                        const uData = userSnap.data();
                        setCurrentUser(user);
                        setIsAuthorized(true);
                        setIsAdmin(uData?.role === 'admin');
                    } else {
                        setCurrentUser(user);
                        setIsAuthorized(false);
                        setIsAdmin(false);
                    }
                } catch (err) {
                    console.error("Error checking authorized_users:", err);
                    setCurrentUser(user);
                    setIsAuthorized(false);
                    setIsAdmin(false);
                } finally {
                    setAuthLoading(false);
                }
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (isAuthorized) {
            fetchProjects();
        }
    }, [isAuthorized]);

    useEffect(() => {
        if (activeProject && isAuthorized) {
            fetchProjectData(activeProject.id);
        }
    }, [activeProject, isAuthorized]);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            setActiveProject(null);
            setShowUserManagement(false);
        } catch (err) {
            console.error("Sign out error:", err);
        }
    };

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
            const newProj = await res.json();
            if (newProj && newProj.id != null) {
                setProjects(prev => [newProj, ...prev]);
                setActiveProject(newProj);
                setApiError(false);
            } else {
                console.error("Failed to create project: backend returned empty or invalid response", newProj);
                setApiError(true);
                fetchProjects();
            }
        } catch (err) {
            console.error("Failed to create project:", err);
            setApiError(true);
        }
    };

    const handleSaveSections = async (newSections) => {
        const res = await fetch(`${API_BASE}/projects/${activeProject.id}/sections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSections)
        });
        if (res.ok) {
            fetchProjectData(activeProject.id);
            setActiveTab('data');
        } else {
            console.error("Failed to update sections");
        }
    };

    const handleAddDay = async (day) => {
        const res = await fetch(`${API_BASE}/projects/${activeProject.id}/survey-days`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(day)
        });
        if (res.ok) {
            fetchProjectData(activeProject.id);
        }
    };

    const handleUploadCracks = async (dayId, distances) => {
        const res = await fetch(`${API_BASE}/projects/${activeProject.id}/upload-cracks?day_id=${dayId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(distances)
        });
        const resData = await res.json();
        if (resData.status === 'conflict') {
            setConflicts(resData.conflicts);
        } else {
            fetchProjectData(activeProject.id);
            setConflicts([]);
        }
    };

    const handleResolveConflict = async (resolution) => {
        const remaining = conflicts.filter(c => c !== resolution.conflict);
        setConflicts(remaining);

        await fetch(`${API_BASE}/projects/${activeProject.id}/resolve-conflicts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{
                type: resolution.action,
                new_distance: resolution.conflict.new_distance,
                day_id: resolution.conflict.day_id,
                existing_id: resolution.conflict.existing_crack.id
            }])
        });

        if (remaining.length === 0) {
            fetchProjectData(activeProject.id);
        }
    };

    const handleDeleteDay = async (dayId) => {
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

    const handleReorderDays = async (reorderedDays) => {
        const dayIds = reorderedDays.map(d => d.id);
        await fetch(`${API_BASE}/projects/${activeProject.id}/survey-days/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dayIds)
        });
        setData(prev => ({ ...prev, survey_days: reorderedDays }));
    };

    const handleUpdateProject = async (projectId, name) => {
        try {
            const res = await fetch(`${API_BASE}/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const updated = await res.json();
            setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name: updated.name } : p));
            if (activeProject && activeProject.id === projectId) {
                setActiveProject(prev => ({ ...prev, name: updated.name }));
            }
        } catch (err) {
            console.error("Failed to update project name:", err);
            fetchProjects();
        }
    };

    const handleDeleteProject = async (projectId) => {
        try {
            const res = await fetch(`${API_BASE}/projects/${projectId}`, { method: 'DELETE' });
            if (res.ok) {
                setProjects(prev => prev.filter(p => p.id !== projectId));
                if (activeProject && activeProject.id === projectId) {
                    setActiveProject(null);
                }
            } else {
                console.error("Failed to delete project on backend");
            }
        } catch (err) {
            console.error("Failed to delete project:", err);
            fetchProjects();
        }
    };

    const handleDuplicateProject = async (projectId) => {
        try {
            const res = await fetch(`${API_BASE}/projects/${projectId}/duplicate`, { method: 'POST' });
            const duplicated = await res.json();
            if (duplicated && duplicated.id) {
                setProjects(prev => [duplicated, ...prev]);
                fetchProjects();
            }
        } catch (err) {
            console.error("Failed to duplicate project:", err);
        }
    };

    // 1. Loading credentials
    if (authLoading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0f172a',
                color: '#ffffff',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '3px solid rgba(255,255,255,0.2)',
                        borderTopColor: '#38bdf8',
                        borderRadius: '50%',
                        animation: 'spin 0.7s linear infinite',
                        margin: '0 auto 1rem auto'
                    }} />
                    <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#94a3b8' }}>
                        Verifying authorization…
                    </div>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // 2. Not logged in
    if (!currentUser) {
        return <Login onAuthSuccess={() => {}} />;
    }

    // 3. Logged in but not on whitelist
    if (!isAuthorized) {
        return <AccessDenied userEmail={currentUser.email} onSignOut={handleSignOut} />;
    }

    // Dynamic tabs (admin gets "User Access" tab)
    const currentTabs = isAdmin
        ? [...BASE_TABS, { id: 'users', label: '👥 User Access' }]
        : BASE_TABS;

    // Top Header Bar
    const renderTopBar = () => (
        <div style={{
            background: '#0f172a',
            color: '#ffffff',
            padding: '0.6rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
            borderBottom: '1px solid #1e293b'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600 }}>
                <img src={logo} alt="Logo" style={{ width: '22px', height: '22px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
                <span>TxDOT 0-7206 Crack Survey</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#cbd5e1' }}>
                    <span>{currentUser.email}</span>
                    <span style={{
                        background: isAdmin ? '#2563eb' : '#475569',
                        color: '#ffffff',
                        padding: '0.12rem 0.5rem',
                        borderRadius: '999px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                    }}>
                        {isAdmin ? 'Admin' : 'Viewer'}
                    </span>
                </div>

                {isAdmin && !activeProject && (
                    <button
                        onClick={() => setShowUserManagement(!showUserManagement)}
                        style={{
                            background: showUserManagement ? '#334155' : 'transparent',
                            border: '1px solid #475569',
                            color: '#ffffff',
                            borderRadius: '6px',
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        {showUserManagement ? '← Return to Projects' : '👥 Manage Users'}
                    </button>
                )}

                <button
                    onClick={handleSignOut}
                    style={{
                        background: 'transparent',
                        border: '1px solid #475569',
                        color: '#f87171',
                        borderRadius: '6px',
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#450a0a'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    Sign Out
                </button>
            </div>
        </div>
    );

    // If on project selection screen and admin toggled user management
    if (!activeProject && showUserManagement && isAdmin) {
        return (
            <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
                {renderTopBar()}
                <UserManagement currentUser={currentUser} onBack={() => setShowUserManagement(false)} />
            </div>
        );
    }

    if (!activeProject) {
        return (
            <>
                {renderTopBar()}
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
            {renderTopBar()}
            <header className="app-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={() => {
                                setActiveProject(null);
                                setShowUserManagement(false);
                            }}
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
                    {currentTabs.map(tab => (
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
                                        <CrackSpacingChart
                                            sections={data.sections}
                                            cracks={data.cracks}
                                            surveyDays={data.survey_days}
                                            projectId={activeProject?.id}
                                            tempBundle={tempBundle}
                                            onSaveTempBundle={handleSaveTempBundle}
                                            onUpdateTempSettings={handleUpdateTempSettings}
                                            onClearTempData={handleClearTempData}
                                        />
                                        <CrackPropagationChart
                                            sections={data.sections}
                                            cracks={data.cracks}
                                            surveyDays={data.survey_days}
                                            projectId={activeProject?.id}
                                            tempBundle={tempBundle}
                                            onSaveTempBundle={handleSaveTempBundle}
                                            onUpdateTempSettings={handleUpdateTempSettings}
                                            onClearTempData={handleClearTempData}
                                        />
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

                        {activeTab === 'users' && isAdmin && (
                            <UserManagement
                                currentUser={currentUser}
                                onBack={() => setActiveTab('sections')}
                            />
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

export default App;
