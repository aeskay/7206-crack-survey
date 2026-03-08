import React, { useState } from 'react';

const ProjectSelection = ({ projects, onSelectProject, onCreateProject, onUpdateProject, onDeleteProject, onDuplicateProject }) => {
    const [newProjectName, setNewProjectName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [editName, setEditName] = useState('');
    const [deletingProject, setDeletingProject] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newProjectName.trim()) {
            onCreateProject(newProjectName.trim());
            setNewProjectName('');
            setIsCreating(false);
        }
    };

    const handleEditSubmit = (e) => {
        e.preventDefault();
        if (editName.trim() && editingProject) {
            onUpdateProject(editingProject.id, editName.trim());
            setEditingProject(null);
            setEditName('');
        }
    };

    const handleDeleteConfirm = (e) => {
        e.preventDefault();
        if (deleteConfirm === 'DELETE' && deletingProject) {
            onDeleteProject(deletingProject.id);
            setDeletingProject(null);
            setDeleteConfirm('');
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
        }}>
            <div style={{ maxWidth: '900px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                        Crack Survey Manager
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '1.1rem' }}>
                        Select a project to begin analysis or manage your projects.
                    </p>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '3rem'
                }}>
                    {Array.isArray(projects) && projects.map(project => (
                        <div
                            key={project.id}
                            className="project-card"
                            style={{
                                background: '#ffffff',
                                borderRadius: '16px',
                                padding: '1.5rem',
                                cursor: 'default',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                minHeight: '200px',
                                position: 'relative'
                            }}
                        >
                            <div onClick={() => onSelectProject(project)} style={{ cursor: 'pointer' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    background: '#eff6ff',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#2563eb',
                                    marginBottom: '1rem'
                                }}>
                                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                </div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>
                                    {project.name}
                                </h3>
                                <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                    Created {new Date(project.created_at).toLocaleDateString()}
                                </p>
                            </div>

                            <div style={{
                                display: 'flex',
                                gap: '0.5rem',
                                marginTop: '1.5rem',
                                paddingTop: '1rem',
                                borderTop: '1px solid #f1f5f9'
                            }}>
                                <button
                                    onClick={() => { setEditingProject(project); setEditName(project.name); }}
                                    title="Rename"
                                    style={{ background: 'none', border: 'none', padding: '5px', cursor: 'pointer', color: '#64748b' }}
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={() => onDuplicateProject(project.id)}
                                    title="Duplicate"
                                    style={{ background: 'none', border: 'none', padding: '5px', cursor: 'pointer', color: '#64748b' }}
                                >
                                    👯
                                </button>
                                <button
                                    onClick={() => setDeletingProject(project)}
                                    title="Delete"
                                    style={{ background: 'none', border: 'none', padding: '5px', cursor: 'pointer', color: '#ef4444' }}
                                >
                                    🗑️
                                </button>
                                <div style={{ flex: 1 }}></div>
                                <button
                                    onClick={() => onSelectProject(project)}
                                    style={{
                                        background: '#2563eb',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '4px 10px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Open →
                                </button>
                            </div>
                        </div>
                    ))}

                    <div
                        onClick={() => setIsCreating(true)}
                        style={{
                            background: 'rgba(255, 255, 255, 0.5)',
                            borderRadius: '16px',
                            padding: '1.5rem',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            border: '2px dashed #cbd5e1',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '200px',
                            color: '#64748b'
                        }}
                        className="add-project-card"
                    >
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '0.75rem',
                            fontSize: '1.5rem'
                        }}>+</div>
                        <span style={{ fontWeight: 600 }}>Create New Project</span>
                    </div>
                </div>

                {isCreating && (
                    <Modal title="New Project" onClose={() => setIsCreating(false)}>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#64748b', marginBottom: '0.5rem' }}>
                                    Project Name
                                </label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    placeholder="e.g. Huntsville 15"
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button type="button" onClick={() => setIsCreating(false)} style={secondaryButtonStyle}>Cancel</button>
                                <button type="submit" style={primaryButtonStyle}>Create Project</button>
                            </div>
                        </form>
                    </Modal>
                )}

                {editingProject && (
                    <Modal title="Rename Project" onClose={() => setEditingProject(null)}>
                        <form onSubmit={handleEditSubmit}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#64748b', marginBottom: '0.5rem' }}>
                                    New Name
                                </label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button type="button" onClick={() => setEditingProject(null)} style={secondaryButtonStyle}>Cancel</button>
                                <button type="submit" style={primaryButtonStyle}>Update Name</button>
                            </div>
                        </form>
                    </Modal>
                )}

                {deletingProject && (
                    <Modal title="Delete Project" onClose={() => setDeletingProject(null)}>
                        <div style={{ marginBottom: '1.5rem', color: '#475569' }}>
                            <p>Are you absolutely sure you want to delete <strong>{deletingProject.name}</strong>?</p>
                            <p style={{ fontSize: '0.875rem', color: '#ef4444', marginTop: '0.5rem' }}>
                                This will permanently remove all sections, survey days, and crack records for this project. This cannot be undone.
                            </p>
                        </div>
                        <form onSubmit={handleDeleteConfirm}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#64748b', marginBottom: '0.5rem' }}>
                                    Type <strong>DELETE</strong> to confirm
                                </label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={deleteConfirm}
                                    onChange={(e) => setDeleteConfirm(e.target.value)}
                                    placeholder="DELETE"
                                    style={{ ...inputStyle, borderColor: deleteConfirm === 'DELETE' ? '#ef4444' : '#e2e8f0' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button type="button" onClick={() => setDeletingProject(null)} style={secondaryButtonStyle}>Cancel</button>
                                <button
                                    type="submit"
                                    disabled={deleteConfirm !== 'DELETE'}
                                    style={{ ...primaryButtonStyle, background: deleteConfirm === 'DELETE' ? '#ef4444' : '#fee2e2', color: deleteConfirm === 'DELETE' ? '#fff' : '#ef4444', cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed' }}
                                >
                                    Permanently Delete
                                </button>
                            </div>
                        </form>
                    </Modal>
                )}
            </div>
            <style>
                {`
                .project-card:hover {
                    transform: translateY(-4px);
                    border-color: #2563eb;
                    box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.1);
                }
                .add-project-card:hover {
                    background: #fff;
                    border-color: #2563eb;
                    color: #2563eb;
                }
                `}
            </style>
        </div>
    );
};

const Modal = ({ title, children, onClose }) => (
    <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
    }}>
        <div style={{
            background: '#fff',
            padding: '2rem',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
        }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>{title}</h3>
            {children}
        </div>
    </div>
);

const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '1rem',
    outline: 'none'
};

const primaryButtonStyle = {
    flex: 1,
    padding: '0.75rem',
    borderRadius: '8px',
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer'
};

const secondaryButtonStyle = {
    flex: 1,
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#7a1919ff', // Preserving user's experimental red color for cancel
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer'
};

export default ProjectSelection;
