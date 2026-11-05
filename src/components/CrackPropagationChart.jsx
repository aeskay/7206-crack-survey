import React, { useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';
import { exportPlotlyDataToCsv } from '../utils/csvExport';
import { getSurveyDayNumber, mapDayToChartX } from '../utils/temperatureChartUtils';
import TemperatureControlPanel from './TemperatureControlPanel';
import TemperatureUploadModal from './TemperatureUploadModal';
import { useProjectTemperature } from '../utils/useProjectTemperature';

const handleExport = (divId, metadata, name, action) => {
  return new Promise((resolve, reject) => {
    const gd = document.getElementById(divId);
    if (!gd) return resolve();

    const visibleData = gd.data.filter(d => d.visible !== 'legendonly');
    Plotly.toImage({ data: visibleData, layout: gd.layout }, { format: 'png', scale: 2 }).then(dataUrl => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const topPadding = 60;
        canvas.width = img.width;
        canvas.height = img.height + topPadding;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, topPadding);

        ctx.font = 'bold 22px sans-serif';
        ctx.fillStyle = '#1e293b';
        ctx.fillText(metadata, 140, 40);

        if (action === 'download') {
          const link = document.createElement('a');
          link.download = `crack-survey-propagation-${name.replace(/\s+/g, '-').toLowerCase()}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          resolve();
        } else if (action === 'copy') {
          canvas.toBlob(blob => {
            if (!blob) return resolve();
            navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
              .then(resolve)
              .catch(err => {
                console.error('Failed to copy: ', err);
                reject(err);
              });
          });
        }
      };
      img.src = dataUrl;
    });
  });
};

const CrackPropagationChart = ({
    cracks,
    surveyDays,
    sections,
    projectId,
    tempBundle: propTempBundle,
    onSaveTempBundle,
    onUpdateTempSettings,
    onClearTempData
}) => {
    const [copiedId, setCopiedId] = useState(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isCountSettingsOpen, setIsCountSettingsOpen] = useState(false);

    // Spacing display mode: 'equal' (uniform survey day spacing) or 'actual' (true numerical day spacing)
    const [spacingMode, setSpacingMode] = useState(() => {
        try {
            return localStorage.getItem(`crack_survey_prop_spacing_mode_${projectId || 'default'}`) || 'equal';
        } catch (e) {
            return 'equal';
        }
    });

    const handleSpacingModeChange = (mode) => {
        setSpacingMode(mode);
        try {
            localStorage.setItem(`crack_survey_prop_spacing_mode_${projectId || 'default'}`, mode);
        } catch (e) {}
    };

    // Actual mode tick style: 'surveyDays' (Day 2, Day 3...) or 'numeric' (0, 20, 40...)
    const [actualTickStyle, setActualTickStyle] = useState(() => {
        try {
            return localStorage.getItem(`crack_survey_prop_tick_style_${projectId || 'default'}`) || 'surveyDays';
        } catch (e) {
            return 'surveyDays';
        }
    });

    const handleUpdateTickStyle = (style) => {
        setActualTickStyle(style);
        try {
            localStorage.setItem(`crack_survey_prop_tick_style_${projectId || 'default'}`, style);
        } catch (e) {}
    };

    // Primary Y-Axis settings (Cumulative Crack Count)
    const [countAxisSettings, setCountAxisSettings] = useState(() => {
        try {
            const saved = localStorage.getItem(`crack_survey_count_axis_${projectId || 'default'}`);
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        return { min: '0', max: '', dtick: '' };
    });

    const handleUpdateCountAxis = (field, value) => {
        setCountAxisSettings(prev => {
            const next = { ...prev, [field]: value };
            try {
                localStorage.setItem(`crack_survey_count_axis_${projectId || 'default'}`, JSON.stringify(next));
            } catch (e) {}
            return next;
        });
    };

    // Fallback hook if props are not passed from parent
    const hookState = useProjectTemperature(propTempBundle === undefined ? projectId : null);
    const tempBundle = propTempBundle !== undefined ? propTempBundle : hookState.tempBundle;
    const saveTempBundle = onSaveTempBundle || hookState.saveBundle;
    const updateTempSettings = onUpdateTempSettings || hookState.updateSettings;
    const clearTempData = onClearTempData || hookState.clearTemperature;

    if (!cracks || cracks.length === 0 || sections.length === 0 || surveyDays.length === 0) return null;

    const handleCopy = (divId, metadata, idString) => {
        handleExport(divId, metadata, idString, 'copy').then(() => {
            setCopiedId(idString);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    const chartSurveyDays = surveyDays.filter(day => day.name !== 'ACC');

    // Temperature settings
    const settings = tempBundle?.settings || {};
    const isTempAvailable = Boolean(tempBundle?.data && tempBundle.data.length > 0);
    const isTempEnabled = isTempAvailable && (settings.enabledPropagation !== false && settings.enabled !== false);

    // Survey day mapping: creates numeric integer index for each survey day (uniform spacing)
    const surveyDayMapping = useMemo(() => {
        return chartSurveyDays.map((day, idx) => ({
            index: idx,
            dayNum: getSurveyDayNumber(day, idx + 1, tempBundle?.summary?.startDateTime),
            name: day.name
        }));
    }, [chartSurveyDays, tempBundle?.summary?.startDateTime]);

    // In actual mode, X is numeric day numbers [2, 3, 7, 14, 30, ...]
    // In equal mode, X is index [0, 1, 2, ...] if temp enabled, or categorical day names
    const sectionXValues = useMemo(() => {
        if (spacingMode === 'actual') {
            return surveyDayMapping.map(m => m.dayNum);
        }
        return isTempEnabled
            ? surveyDayMapping.map(m => m.index)
            : chartSurveyDays.map(day => day.name);
    }, [spacingMode, isTempEnabled, surveyDayMapping, chartSurveyDays]);

    const sectionTraces = useMemo(() => {
        const colors = ['#2563eb', '#dc2626', '#16a34a', '#8b5cf6', '#f59e0b', '#0ea5e9', '#db2777', '#14b8a6'];
        return sections.map((sec, idx) => {
            const secCracks = cracks.filter(c => c.distance >= sec.start_station && c.distance <= sec.end_station);

            // Calculate cumulative count for each day
            const yValues = chartSurveyDays.map((day) => {
                const originalIndex = surveyDays.findIndex(d => d.id === day.id);
                const daysUpToCurrent = surveyDays.slice(0, originalIndex + 1).map(d => parseInt(d.id, 10));
                const cracksUpToDay = secCracks.filter(c => daysUpToCurrent.includes(parseInt(c.day_id, 10)));
                return cracksUpToDay.length;
            });

            return {
                x: sectionXValues,
                y: yValues,
                type: 'scatter',
                mode: 'lines+markers',
                name: sec.name,
                line: { width: 3, color: sec.color || colors[idx % colors.length] },
                marker: { size: 8 },
                connectgaps: true,
                hovertemplate: spacingMode === 'actual'
                    ? `<b>${sec.name}</b><br>Cumulative Count: %{y}<br>%{customdata[0]} (Age: %{x} days)<extra></extra>`
                    : `<b>${sec.name}</b><br>Cumulative Count: %{y}<br>%{customdata[0]}<extra></extra>`,
                customdata: chartSurveyDays.map(d => [d.name])
            };
        });
    }, [sections, cracks, surveyDays, chartSurveyDays, sectionXValues, spacingMode]);

    // Build Temperature Trace if enabled
    const tempTrace = useMemo(() => {
        if (!isTempEnabled || !tempBundle?.data || tempBundle.data.length === 0) return null;

        const cleanTitle = (settings.yTitle || 'Temperature (°F)').replace(/<[^>]+>/g, '°');

        if (spacingMode === 'actual') {
            const minDay = surveyDayMapping[0]?.dayNum ?? 0;
            const maxDay = surveyDayMapping[surveyDayMapping.length - 1]?.dayNum ?? 100;
            const actualPoints = tempBundle.data.filter(p => p.day >= minDay && p.day <= maxDay);

            return {
                x: actualPoints.map(p => p.day),
                y: actualPoints.map(p => p.temp),
                type: 'scatter',
                mode: 'lines',
                name: settings.yTitle || 'Temperature (<sup>o</sup>F)',
                yaxis: 'y2',
                line: { width: 1.5, color: settings.color || '#dc2626' },
                hoverinfo: 'text',
                text: actualPoints.map(p => `${p.timestamp} (Age: ${p.day.toFixed(2)} days)<br>${cleanTitle}: ${p.temp}°F`)
            };
        }

        const mappedPoints = tempBundle.data
            .map(p => ({
                x: mapDayToChartX(p.day, surveyDayMapping),
                y: p.temp,
                timestamp: p.timestamp,
                day: p.day
            }))
            .filter(p => p.x !== null && p.x >= 0 && p.x <= surveyDayMapping.length - 1);

        return {
            x: mappedPoints.map(p => p.x),
            y: mappedPoints.map(p => p.y),
            type: 'scatter',
            mode: 'lines',
            name: settings.yTitle || 'Temperature (<sup>o</sup>F)',
            yaxis: 'y2',
            line: { width: 1.5, color: settings.color || '#dc2626' },
            hoverinfo: 'text',
            text: mappedPoints.map(p => `${p.timestamp} (Day ${p.day.toFixed(2)})<br>${cleanTitle}: ${p.y}°F`)
        };
    }, [isTempEnabled, tempBundle?.data, settings.yTitle, settings.color, surveyDayMapping, spacingMode]);

    const data = useMemo(() => {
        return tempTrace ? [...sectionTraces, tempTrace] : sectionTraces;
    }, [sectionTraces, tempTrace]);

    const projectStart = sections && sections.length > 0 ? sections[0].start_station : 0;
    const totalLength = sections && sections.length > 0 ? sections[sections.length - 1].end_station : 1000;
    const overviewMetadata = `Crack Propagation Rate (${spacingMode === 'actual' ? 'Actual Spacing' : 'Equal Spacing'})  |  DMI ${projectStart} - ${totalLength}`;

    const handleUpdateSettings = (newPartial) => {
        if ('enabled' in newPartial) {
            updateTempSettings({ enabledPropagation: newPartial.enabled, enabled: newPartial.enabled });
        } else {
            updateTempSettings(newPartial);
        }
    };

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <h2 className="title" style={{ margin: 0 }}>Crack Propagation Rate</h2>
                    {/* Spacing Mode Tabs */}
                    <div style={{
                        display: 'inline-flex',
                        background: '#f1f5f9',
                        padding: '0.25rem',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        gap: '0.25rem'
                    }}>
                        <button
                            type="button"
                            onClick={() => handleSpacingModeChange('equal')}
                            style={{
                                padding: '0.35rem 0.85rem',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                background: spacingMode === 'equal' ? '#ffffff' : 'transparent',
                                color: spacingMode === 'equal' ? '#0f172a' : '#64748b',
                                boxShadow: spacingMode === 'equal' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            Equal Spacing
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSpacingModeChange('actual')}
                            style={{
                                padding: '0.35rem 0.85rem',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                background: spacingMode === 'actual' ? '#ffffff' : 'transparent',
                                color: spacingMode === 'actual' ? '#0f172a' : '#64748b',
                                boxShadow: spacingMode === 'actual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            Actual Spacing
                        </button>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => handleCopy('crack-propagation-plot', overviewMetadata, 'overview')}
                        title="Copy chart to clipboard"
                        style={{
                            background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569',
                            padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem',
                            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#475569'; }}
                    >
                        {copiedId === 'overview' ? (
                            <><span style={{ color: '#10b981' }}>✓</span> Copied!</>
                        ) : (
                            <>📋 Copy Image</>
                        )}
                    </button>
                    <button
                        onClick={() => setIsCountSettingsOpen(prev => !prev)}
                        title="Configure Cumulative Crack Count Y-axis"
                        style={{
                            background: isCountSettingsOpen ? '#e0e7ff' : '#ffffff',
                            border: '1px solid #cbd5e1',
                            color: isCountSettingsOpen ? '#4338ca' : '#475569',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        📊 Count Axis {isCountSettingsOpen ? '▲' : '▼'}
                    </button>
                    <button
                        onClick={() => handleExport('crack-propagation-plot', overviewMetadata, 'overview', 'download')}
                        title="Download chart as PNG"
                        style={{
                            background: '#3b82f6', border: 'none', color: '#fff',
                            padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem',
                            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                            transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#2563eb'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#3b82f6'}
                    >
                        📥 Download
                    </button>
                    <button
                        onClick={() => {
                            const gd = document.getElementById('crack-propagation-plot');
                            exportPlotlyDataToCsv(gd, 'crack-survey-propagation');
                        }}
                        title="Export data as CSV"
                        style={{
                            background: '#10b981', border: 'none', color: '#fff',
                            padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem',
                            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                            transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#059669'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#10b981'}
                    >
                        📄 Export CSV
                    </button>
                </div>
            </div>

            {/* Collapsible Count Axis Settings Panel */}
            {isCountSettingsOpen && (
                <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    flexWrap: 'wrap'
                }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        📊 Cumulative Crack Count Axis Settings:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Min:</label>
                        <input
                            type="number"
                            placeholder="0"
                            value={countAxisSettings.min}
                            onChange={(e) => handleUpdateCountAxis('min', e.target.value)}
                            style={{ width: '65px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Max:</label>
                        <input
                            type="number"
                            placeholder="Auto"
                            value={countAxisSettings.max}
                            onChange={(e) => handleUpdateCountAxis('max', e.target.value)}
                            style={{ width: '65px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Interval / Step:</label>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="Auto"
                            value={countAxisSettings.dtick}
                            onChange={(e) => handleUpdateCountAxis('dtick', e.target.value)}
                            style={{ width: '65px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                    </div>
                    {spacingMode === 'actual' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderLeft: '1px solid #cbd5e1', paddingLeft: '1rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>X-Axis Labels:</label>
                            <select
                                value={actualTickStyle}
                                onChange={(e) => handleUpdateTickStyle(e.target.value)}
                                style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#fff' }}
                            >
                                <option value="surveyDays">Survey Days (Day 2, Day 3...)</option>
                                <option value="numeric">Numerical Days (0, 20, 40...)</option>
                            </select>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            const def = { min: '0', max: '', dtick: '' };
                            setCountAxisSettings(def);
                            try { localStorage.removeItem(`crack_survey_count_axis_${projectId || 'default'}`); } catch (e) {}
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#2563eb',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: 0
                        }}
                    >
                        Reset Count Y-Axis
                    </button>
                </div>
            )}

            {/* Temperature Control Panel */}
            <TemperatureControlPanel
                tempBundle={tempBundle}
                settings={{
                    ...settings,
                    enabled: settings.enabledPropagation !== undefined ? settings.enabledPropagation : settings.enabled
                }}
                onUpdateSettings={handleUpdateSettings}
                onOpenUploadModal={() => setIsUploadModalOpen(true)}
                onClearData={clearTempData}
            />

            <Plot
                divId="crack-propagation-plot"
                data={data}
                layout={{
                    autosize: true,
                    margin: { 
                        l: 60, 
                        r: isTempEnabled ? 65 : 30, 
                        t: 30, 
                        b: (spacingMode === 'actual' && actualTickStyle === 'surveyDays') ? 85 : 70 
                    },
                    xaxis: {
                        title: { 
                            text: spacingMode === 'actual' ? '<b>Age (Days)</b>' : '<b>Age (Survey Days)</b>', 
                            font: { size: 16, color: 'black' } 
                        },
                        tickfont: { size: 14, color: 'black' },
                        showline: true, linewidth: 1, linecolor: 'black', mirror: true, ticks: 'inside',
                        zeroline: false,
                        ...(spacingMode === 'actual' ? {
                            ...(actualTickStyle === 'surveyDays' ? {
                                tickmode: 'array',
                                tickvals: surveyDayMapping.map(m => m.dayNum),
                                ticktext: surveyDayMapping.map(m => m.name),
                                tickangle: -45
                            } : {
                                tickmode: 'auto',
                                tickangle: 0
                            }),
                            range: [
                                Math.max(0, (surveyDayMapping[0]?.dayNum ?? 0) - 2),
                                Math.ceil((surveyDayMapping[surveyDayMapping.length - 1]?.dayNum ?? 100) + Math.max(2, ((surveyDayMapping[surveyDayMapping.length - 1]?.dayNum ?? 100) - (surveyDayMapping[0]?.dayNum ?? 0)) * 0.03))
                            ]
                        } : (isTempEnabled ? {
                            tickmode: 'array',
                            tickvals: surveyDayMapping.map(m => m.index),
                            ticktext: surveyDayMapping.map(m => m.name),
                            range: [-0.5, surveyDayMapping.length - 0.5]
                        } : {}))
                    },
                    yaxis: {
                        title: { text: '<b>Cumulative Crack Count</b>', font: { size: 16, color: 'black' } },
                        tickfont: { size: 14, color: 'black' },
                        showline: true, linewidth: 1, linecolor: 'black', mirror: true, ticks: 'inside',
                        ...(countAxisSettings.dtick !== '' && !isNaN(Number(countAxisSettings.dtick)) && Number(countAxisSettings.dtick) > 0 ? {
                            dtick: Number(countAxisSettings.dtick)
                        } : {}),
                        ...(countAxisSettings.min !== '' && countAxisSettings.max !== '' && !isNaN(Number(countAxisSettings.min)) && !isNaN(Number(countAxisSettings.max)) ? {
                            range: [Number(countAxisSettings.min), Number(countAxisSettings.max)],
                            autorange: false
                        } : {
                            rangemode: 'tozero',
                            autorange: true
                        })
                    },
                    ...(isTempEnabled ? {
                        yaxis2: {
                            title: {
                                text: `<b>${settings.yTitle || 'Temperature (<sup>o</sup>F)'}</b>`,
                                font: { size: 16, color: 'black' }
                            },
                            tickfont: { size: 14, color: 'black' },
                            overlaying: 'y',
                            side: 'right',
                            showline: true,
                            linewidth: 1,
                            linecolor: 'black',
                            ticks: 'inside',
                            showgrid: false,
                            zeroline: false,
                            ...(settings.min !== '' && settings.max !== '' && !isNaN(Number(settings.min)) && !isNaN(Number(settings.max)) ? {
                                range: [Number(settings.min), Number(settings.max)],
                                autorange: false
                            } : { autorange: true }),
                            ...(settings.dtick !== '' && !isNaN(Number(settings.dtick)) ? {
                                dtick: Number(settings.dtick)
                            } : {})
                        }
                    } : {}),
                    legend: {
                        orientation: 'h',
                        y: -0.25,
                        x: 0.5,
                        xanchor: 'center',
                        font: { color: 'black', size: 14 },
                        bordercolor: 'black',
                        borderwidth: 1
                    }
                }}
                useResizeHandler={true}
                config={{
                    modeBarButtonsToRemove: ['toImage'],
                    modeBarButtonsToAdd: [{
                        name: 'Download plot as a png',
                        icon: Plotly.Icons.camera,
                        click: function(gd) {
                            const visibleData = gd.data.filter(d => d.visible !== 'legendonly');
                            Plotly.downloadImage(
                                { data: visibleData, layout: gd.layout }, 
                                { format: 'png', filename: 'crack-survey-propagation' }
                            );
                        }
                    }]
                }}
                style={{ width: "100%", height: "450px" }}
            />

            {/* Modal for file upload */}
            <TemperatureUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onSave={saveTempBundle}
                existingFileName={tempBundle?.fileName}
            />
        </div>
    );
};

export default CrackPropagationChart;
