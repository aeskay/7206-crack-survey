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
          link.download = `crack-survey-spacing-${name.replace(/\s+/g, '-').toLowerCase()}.png`;
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

const CrackSpacingChart = ({
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
    const [isSpacingSettingsOpen, setIsSpacingSettingsOpen] = useState(false);

    // Primary Y-Axis settings (Average Crack Spacing) with default dtick = 2
    const [spacingAxisSettings, setSpacingAxisSettings] = useState(() => {
        try {
            const saved = localStorage.getItem(`crack_survey_spacing_axis_${projectId || 'default'}`);
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        return { min: '0', max: '', dtick: '2' };
    });

    const handleUpdateSpacingAxis = (field, value) => {
        setSpacingAxisSettings(prev => {
            const next = { ...prev, [field]: value };
            try {
                localStorage.setItem(`crack_survey_spacing_axis_${projectId || 'default'}`, JSON.stringify(next));
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

    // Filter out "ACC" day for the chart display
    const chartSurveyDays = surveyDays.filter(day => day.name !== 'ACC');

    // Temperature settings
    const settings = tempBundle?.settings || {};
    const isTempAvailable = Boolean(tempBundle?.data && tempBundle.data.length > 0);
    const isTempEnabled = isTempAvailable && (settings.enabledSpacing !== false && settings.enabled !== false);

    // Survey day mapping: creates numeric integer index for each survey day
    const surveyDayMapping = useMemo(() => {
        return chartSurveyDays.map((day, idx) => ({
            index: idx,
            dayNum: getSurveyDayNumber(day, idx + 1, tempBundle?.summary?.startDateTime),
            name: day.name
        }));
    }, [chartSurveyDays, tempBundle?.summary?.startDateTime]);

    // If temp overlay is active, X is mapped to index [0, 1, ..., N-1] with ticktext = day.name
    // If not, X is plain day.name categorical
    const sectionXValues = useMemo(() => {
        return isTempEnabled
            ? surveyDayMapping.map(m => m.index)
            : chartSurveyDays.map(day => day.name);
    }, [isTempEnabled, surveyDayMapping, chartSurveyDays]);

    const sectionTraces = useMemo(() => {
        const colors = ['#2563eb', '#dc2626', '#16a34a', '#8b5cf6', '#f59e0b', '#0ea5e9', '#db2777', '#14b8a6'];
        return sections.map((sec, idx) => {
            const secCracks = cracks.filter(c => c.distance >= sec.start_station && c.distance <= sec.end_station);

            // Calculate average spacing for each day
            const yValues = chartSurveyDays.map((day) => {
                const originalIndex = surveyDays.findIndex(d => d.id === day.id);
                const daysUpToCurrent = surveyDays.slice(0, originalIndex + 1).map(d => parseInt(d.id, 10));
                const cracksUpToDay = secCracks
                    .filter(c => daysUpToCurrent.includes(parseInt(c.day_id, 10)));
                    
                const uniqueDists = new Set(cracksUpToDay.map(c => c.distance));
                let spacingPoints = uniqueDists.size;
                if (!uniqueDists.has(sec.start_station)) spacingPoints++;
                if (!uniqueDists.has(sec.end_station)) spacingPoints++;
                
                const numSpacings = spacingPoints - 1;
                if (numSpacings <= 0) return null;

                return (sec.end_station - sec.start_station) / numSpacings;
            });

            return {
                x: sectionXValues,
                y: yValues,
                type: 'scatter',
                mode: 'lines+markers',
                name: sec.name,
                line: { width: 3, color: sec.color || colors[idx % colors.length] },
                marker: { size: 8 },
                connectgaps: true
            };
        });
    }, [sections, cracks, surveyDays, chartSurveyDays, sectionXValues]);

    // Build Temperature Trace if enabled
    const tempTrace = useMemo(() => {
        if (!isTempEnabled || !tempBundle?.data || tempBundle.data.length === 0) return null;

        const mappedPoints = tempBundle.data
            .map(p => ({
                x: mapDayToChartX(p.day, surveyDayMapping),
                y: p.temp,
                timestamp: p.timestamp,
                day: p.day
            }))
            .filter(p => p.x !== null && p.x >= 0 && p.x <= surveyDayMapping.length - 1);

        const cleanTitle = (settings.yTitle || 'Temperature (°F)').replace(/<[^>]+>/g, '°');
        return {
            x: mappedPoints.map(p => p.x),
            y: mappedPoints.map(p => p.y),
            type: 'scatter',
            mode: 'lines',
            name: settings.yTitle || 'Temperature (<sup>o</sup>F)',
            yaxis: 'y2',
            line: { width: 1.5, color: settings.color || '#dc2626' },
            hoverinfo: 'text',
            text: mappedPoints.map(p => `${p.timestamp} (Day ${p.day.toFixed(2)})<br>${cleanTitle}: ${p.y}°`)
        };
    }, [isTempEnabled, tempBundle?.data, settings.yTitle, settings.color, surveyDayMapping]);

    const data = useMemo(() => {
        return tempTrace ? [...sectionTraces, tempTrace] : sectionTraces;
    }, [sectionTraces, tempTrace]);

    const projectStart = sections && sections.length > 0 ? sections[0].start_station : 0;
    const totalLength = sections && sections.length > 0 ? sections[sections.length - 1].end_station : 1000;
    const overviewMetadata = `Average Crack Spacing Over Time  |  DMI ${projectStart} - ${totalLength}`;

    const handleUpdateSettings = (newPartial) => {
        // If updating 'enabled', write to 'enabledSpacing' and 'enabled'
        if ('enabled' in newPartial) {
            updateTempSettings({ enabledSpacing: newPartial.enabled, enabled: newPartial.enabled });
        } else {
            updateTempSettings(newPartial);
        }
    };

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="title" style={{ margin: 0 }}>Crack Spacing</h2>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={() => handleCopy('crack-spacing-plot', overviewMetadata, 'overview')}
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
                        onClick={() => setIsSpacingSettingsOpen(prev => !prev)}
                        title="Configure Average Crack Spacing Y-axis"
                        style={{
                            background: isSpacingSettingsOpen ? '#e0e7ff' : '#ffffff',
                            border: '1px solid #cbd5e1',
                            color: isSpacingSettingsOpen ? '#4338ca' : '#475569',
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
                        📏 Spacing Axis {isSpacingSettingsOpen ? '▲' : '▼'}
                    </button>
                    <button
                        onClick={() => handleExport('crack-spacing-plot', overviewMetadata, 'overview', 'download')}
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
                            const gd = document.getElementById('crack-spacing-plot');
                            exportPlotlyDataToCsv(gd, 'crack-survey-spacing');
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

            {/* Collapsible Spacing Axis Settings Panel */}
            {isSpacingSettingsOpen && (
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
                        📏 Spacing Y-Axis Settings:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Min (ft):</label>
                        <input
                            type="number"
                            placeholder="0"
                            value={spacingAxisSettings.min}
                            onChange={(e) => handleUpdateSpacingAxis('min', e.target.value)}
                            style={{ width: '65px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Max (ft):</label>
                        <input
                            type="number"
                            placeholder="Auto"
                            value={spacingAxisSettings.max}
                            onChange={(e) => handleUpdateSpacingAxis('max', e.target.value)}
                            style={{ width: '65px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Interval / Step (ft):</label>
                        <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            placeholder="2"
                            value={spacingAxisSettings.dtick}
                            onChange={(e) => handleUpdateSpacingAxis('dtick', e.target.value)}
                            style={{ width: '65px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            const def = { min: '0', max: '', dtick: '2' };
                            setSpacingAxisSettings(def);
                            try { localStorage.removeItem(`crack_survey_spacing_axis_${projectId || 'default'}`); } catch (e) {}
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
                        Reset to Default (0, Auto, Step 2)
                    </button>
                </div>
            )}

            {/* Temperature Control Panel */}
            <TemperatureControlPanel
                tempBundle={tempBundle}
                settings={{
                    ...settings,
                    enabled: settings.enabledSpacing !== undefined ? settings.enabledSpacing : settings.enabled
                }}
                onUpdateSettings={handleUpdateSettings}
                onOpenUploadModal={() => setIsUploadModalOpen(true)}
                onClearData={clearTempData}
            />

            <Plot
                divId="crack-spacing-plot"
                data={data}
                layout={{
                    autosize: true,
                    margin: { l: 60, r: isTempEnabled ? 65 : 30, t: 30, b: 70 },
                    xaxis: {
                        title: { text: '<b>Age (Survey Days)</b>', font: { size: 16, color: 'black' } },
                        tickfont: { size: 14, color: 'black' },
                        showline: true, linewidth: 1, linecolor: 'black', mirror: true, ticks: 'inside',
                        zeroline: false,
                        ...(isTempEnabled ? {
                            tickmode: 'array',
                            tickvals: surveyDayMapping.map(m => m.index),
                            ticktext: surveyDayMapping.map(m => m.name),
                            range: [-0.5, surveyDayMapping.length - 0.5]
                        } : {})
                    },
                    yaxis: {
                        title: { text: '<b>Average Crack Spacing (ft)</b>', font: { size: 16, color: 'black' } },
                        tickfont: { size: 14, color: 'black' },
                        showline: true, linewidth: 1, linecolor: 'black', mirror: true, ticks: 'inside',
                        dtick: spacingAxisSettings.dtick !== '' && !isNaN(Number(spacingAxisSettings.dtick)) && Number(spacingAxisSettings.dtick) > 0 ? Number(spacingAxisSettings.dtick) : 2,
                        ...(spacingAxisSettings.min !== '' && spacingAxisSettings.max !== '' && !isNaN(Number(spacingAxisSettings.min)) && !isNaN(Number(spacingAxisSettings.max)) ? {
                            range: [Number(spacingAxisSettings.min), Number(spacingAxisSettings.max)],
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
                                { format: 'png', filename: 'crack-survey-spacing' }
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

export default CrackSpacingChart;
