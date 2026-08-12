import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';
const BINS = ['1-2', '2-4', '4-6', '6-8', '8-10', '10-12', '12-14', '14-16', '>16'];

const getFrequencyData = (filteredCracks, surveyDays, startStation = null, endStation = null) => {
    return surveyDays.map((day, index) => {
        // Accumulate cracks up to this day to get correct spacings
        const daysUpToCurrent = surveyDays.slice(0, index + 1).map(d => parseInt(d.id, 10));
        const dayCracks = filteredCracks.filter(c => daysUpToCurrent.includes(parseInt(c.day_id, 10)));

        let sortedDists = dayCracks.map(c => c.distance);
        sortedDists = Array.from(new Set(sortedDists)).sort((a, b) => a - b);
        
        if (startStation !== null && endStation !== null) {
            const distsSet = new Set(sortedDists);
            if (!distsSet.has(startStation)) sortedDists.unshift(startStation);
            if (!distsSet.has(endStation)) sortedDists.push(endStation);
            sortedDists.sort((a, b) => a - b);
        }

        if (sortedDists.length < 2) return null;
        const spacings = [];
        for (let i = 1; i < sortedDists.length; i++) {
            const sp = sortedDists[i] - sortedDists[i - 1];
            if (sp > 0) spacings.push(sp);
        }

        const counts = new Array(9).fill(0);
        spacings.forEach(s => {
            if (s < 2) counts[0]++;
            else if (s < 4) counts[1]++;
            else if (s < 6) counts[2]++;
            else if (s < 8) counts[3]++;
            else if (s < 10) counts[4]++;
            else if (s < 12) counts[5]++;
            else if (s < 14) counts[6]++;
            else if (s < 16) counts[7]++;
            else counts[8]++;
        });

        // Convert counts to percentages? The user said "group the crack spacing ... and then we'll have bar charts".
        // It's usually better to show raw frequency (count) or percentage. Let's show count.
        return {
            x: BINS,
            y: counts,
            type: 'bar',
            name: day.name,
            marker: { color: day.color }
        };
    }).filter(d => d !== null);
};

const FrequencyCommonLayout = {
    autosize: true,
    barmode: 'group',
    margin: { l: 70, r: 30, t: 30, b: 70 },
    xaxis: {
        title: { text: '<b>Crack Spacing (ft)</b>', font: { size: 16, color: 'black' } },
                        tickfont: { size: 14, color: 'black' },
                        showline: true, linewidth: 1, linecolor: 'black', mirror: true, ticks: 'inside',
        tickangle: -45,
        type: 'category'
    },
    yaxis: {
        title: { text: '<b>Frequency (Count)</b>', font: { size: 16, color: 'black' } },
        tickfont: { size: 14, color: 'black' },
        showline: true, linewidth: 1, linecolor: 'black', mirror: true, ticks: 'inside',
        rangemode: 'nonnegative'
    },
    legend: { orientation: 'h', y: -0.3 }
};

const handleExport = (divId, metadata, name, action) => {
    return new Promise((resolve, reject) => {
        const gd = document.getElementById(divId);
        if (!gd) return resolve();
        const visibleData = gd.data.filter(d => d.visible !== 'legendonly');
        Plotly.toImage({ data: visibleData, layout: gd.layout }, { format: 'png', scale: 2, width: gd.clientWidth, height: gd.clientHeight }).then(dataUrl => {
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
                    link.download = `crack-survey-freq-${name.replace(/\s+/g, '-').toLowerCase()}.png`;
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

const FrequencyChart = ({ cracks, surveyDays, sections }) => {
    const [expandedSections, setExpandedSections] = useState({});
    const [copiedId, setCopiedId] = useState(null);

    const toggleSection = (idx) => {
        setExpandedSections(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };
    if (!cracks || cracks.length === 0) return null;

    const chartSurveyDays = surveyDays.filter(day => day.name !== 'ACC');

    const handleCopy = (divId, metadata, idString) => {
        handleExport(divId, metadata, idString, 'copy').then(() => {
            setCopiedId(idString);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    const projectStart = sections && sections.length > 0 ? sections[0].start_station : 0;
    const totalLength = sections && sections.length > 0 ? sections[sections.length - 1].end_station : 1000;
    
    const overviewData = getFrequencyData(cracks, chartSurveyDays, projectStart, totalLength);
    
    const uniqueDists = new Set(cracks.map(c => c.distance));
    const totalCracks = cracks.length;
    
    let totalSpacingPoints = uniqueDists.size;
    if (!uniqueDists.has(projectStart)) totalSpacingPoints++;
    if (!uniqueDists.has(totalLength)) totalSpacingPoints++;
    const totalNumSpacings = totalSpacingPoints - 1;
    
    const totalAvgSpacing = totalNumSpacings > 0 ? ((totalLength - projectStart) / totalNumSpacings).toFixed(1) : '—';
    const overviewMetadata = `Project Overview  |  DMI ${projectStart} - ${totalLength}  |  ${totalCracks} cracks  |  Average Spacing: ${totalAvgSpacing} ft`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h2 className="title" style={{ margin: 0 }}>Project Overview Frequency Chart</h2>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={() => handleCopy('freq-overview', overviewMetadata, 'overview')}
                            title="Copy chart to clipboard"
                            style={{
                                padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 600,
                                background: copiedId === 'overview' ? '#10b981' : '#f8fafc',
                                color: copiedId === 'overview' ? '#fff' : '#475569',
                                border: '1px solid', borderColor: copiedId === 'overview' ? '#10b981' : '#cbd5e1',
                                borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap',
                                display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.2s ease'
                            }}
                        >
                            {copiedId === 'overview' ? '✓ Copied' : '📋 Copy PNG'}
                        </button>
                        <button
                            onClick={() => handleExport('freq-overview', overviewMetadata, 'overview', 'download')}
                            title="Download chart as PNG"
                            style={{
                                padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 600,
                                background: '#2563eb', color: '#fff', border: 'none',
                                borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap',
                                display: 'flex', alignItems: 'center', gap: '0.3rem'
                            }}
                        >
                            ⬇ Download PNG
                        </button>
                    </div>
                </div>
                <Plot
                    divId="freq-overview"
                    data={overviewData}
                    layout={FrequencyCommonLayout}
                    useResizeHandler={true}
                    config={{ displayModeBar: false }}
                    style={{ width: "100%", height: "400px" }}
                />
            </div>

            {sections && sections.length > 0 && (
                <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                        Section Frequency Charts
                    </h3>
                    {sections.map((sec, idx) => {
                        const isOpen = !!expandedSections[idx];
                        const secCracks = cracks.filter(
                            (c) => c.distance >= sec.start_station && c.distance <= sec.end_station
                        );

                        let secSpacingPoints = secCracks.length;
                        if (!secCracks.some(c => c.distance === sec.start_station)) secSpacingPoints++;
                        if (!secCracks.some(c => c.distance === sec.end_station)) secSpacingPoints++;
                        const secNumSpacings = secSpacingPoints - 1;
                        
                        const avgSpacing = secNumSpacings > 0 ? ((sec.end_station - sec.start_station) / secNumSpacings).toFixed(1) : '—';

                        const sectionMetadata = `${sec.name}  |  DMI ${sec.start_station} - ${sec.end_station}  |  Steel: ${sec.steel_ratio ?? 0}%  |  ${secCracks.length} cracks  |  Average Spacing: ${avgSpacing} ft`;

                        return (
                            <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '0.75rem', overflow: 'hidden' }}>
                                <button
                                    onClick={() => toggleSection(idx)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '0.75rem 1rem', background: isOpen ? '#e0f2fe' : '#f8fafc',
                                        border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{sec.name}</span>
                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                            DMI {sec.start_station} – {sec.end_station}
                                        </span>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <span style={{ background: '#10b981', color: '#fff', borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 600 }}>
                                                Steel: {sec.steel_ratio ?? 0}%
                                            </span>
                                            <span style={{ background: '#3b82f6', color: '#fff', borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 600 }}>
                                                {secCracks.length} cracks
                                            </span>
                                            <span style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 600 }}>
                                                Average Spacing: {avgSpacing} ft
                                            </span>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '1.1rem', color: '#64748b' }}>{isOpen ? '▲' : '▼'}</span>
                                </button>

                                {isOpen && (
                                    <div style={{ padding: '0.75rem 1rem', background: '#fff' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                            <button
                                                onClick={() => handleCopy(`freq-sec-${idx}`, sectionMetadata, `sec-${idx}`)}
                                                title="Copy chart to clipboard"
                                                style={{
                                                    padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 600,
                                                    background: copiedId === `sec-${idx}` ? '#10b981' : '#f8fafc',
                                                    color: copiedId === `sec-${idx}` ? '#fff' : '#475569',
                                                    border: '1px solid', borderColor: copiedId === `sec-${idx}` ? '#10b981' : '#cbd5e1',
                                                    borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap',
                                                    display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.2s ease'
                                                }}
                                            >
                                                {copiedId === `sec-${idx}` ? '✓ Copied' : '📋 Copy PNG'}
                                            </button>
                                            <button
                                                onClick={() => handleExport(`freq-sec-${idx}`, sectionMetadata, sec.name, 'download')}
                                                title="Download chart as PNG"
                                                style={{
                                                    padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 600,
                                                    background: '#2563eb', color: '#fff', border: 'none',
                                                    borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap',
                                                    display: 'flex', alignItems: 'center', gap: '0.3rem'
                                                }}
                                            >
                                                ⬇ Download PNG
                                            </button>
                                        </div>
                                        <Plot
                                            divId={`freq-sec-${idx}`}
                                            data={getFrequencyData(secCracks, chartSurveyDays, sec.start_station, sec.end_station)}
                                            layout={FrequencyCommonLayout}
                                            useResizeHandler={true}
                                            config={{ displayModeBar: false }}
                                            style={{ width: "100%", height: "350px" }}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default FrequencyChart;
