import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';
import { exportPlotlyDataToCsv } from '../utils/csvExport';

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
          link.download = `crack-survey-boxplot-${name.replace(/\s+/g, '-').toLowerCase()}.png`;
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

const SpacingBoxPlotChart = ({ cracks, sections }) => {
    const [copiedId, setCopiedId] = useState(null);

    if (!cracks || cracks.length === 0 || sections.length === 0) return null;

    const handleCopy = (divId, metadata, idString) => {
        handleExport(divId, metadata, idString, 'copy').then(() => {
            setCopiedId(idString);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    const data = sections.map((sec, idx) => {
        // Get all cracks in this section across all days
        const secCrackDistances = cracks
            .filter(c => c.distance >= sec.start_station && c.distance <= sec.end_station)
            .map(c => c.distance)
            .sort((a, b) => a - b);
            
        if (!secCrackDistances.includes(sec.start_station)) secCrackDistances.unshift(sec.start_station);
        if (!secCrackDistances.includes(sec.end_station)) secCrackDistances.push(sec.end_station);

        const spacings = [];
        for (let i = 1; i < secCrackDistances.length; i++) {
            spacings.push(secCrackDistances[i] - secCrackDistances[i - 1]);
        }

        const colors = ['#2563eb', '#dc2626', '#16a34a', '#8b5cf6', '#f59e0b', '#0ea5e9', '#db2777', '#14b8a6'];

        return {
            y: spacings,
            type: 'box',
            name: sec.name,
            boxpoints: 'Outliers', // Show only outliers or 'all' for all points
            jitter: 0.3,
            pointpos: -1.8,
            marker: { color: colors[idx % colors.length] },
            line: { width: 2 }
        };
    });

    const projectStart = sections && sections.length > 0 ? sections[0].start_station : 0;
    const totalLength = sections && sections.length > 0 ? sections[sections.length - 1].end_station : 1000;
    const overviewMetadata = `Crack Spacing Distribution  |  DMI ${projectStart} - ${totalLength}`;

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="title" style={{ margin: 0 }}>Crack Spacing Distribution (Box Plots)</h2>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={() => handleCopy('spacing-boxplot', overviewMetadata, 'overview')}
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
                        onClick={() => handleExport('spacing-boxplot', overviewMetadata, 'overview', 'download')}
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
                            const gd = document.getElementById('spacing-boxplot');
                            exportPlotlyDataToCsv(gd, 'crack-survey-spacing-distribution');
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
            <Plot
                divId="spacing-boxplot"
                data={data}
                layout={{
                    autosize: true,
                    margin: { l: 60, r: 30, t: 30, b: 70 },
                    xaxis: {
                        title: { text: '<b>Pavement Section</b>', font: { size: 16, color: 'black' } },
                        tickfont: { size: 14, color: 'black' },
                        showline: true, linewidth: 1, linecolor: 'black', mirror: 'all', ticks: 'inside',
                    },
                    yaxis: {
                        title: { text: '<b>Crack Spacing (ft)</b>', font: { size: 16, color: 'black' } },
                        tickfont: { size: 14, color: 'black' },
                        showline: true, linewidth: 1, linecolor: 'black', mirror: 'all', ticks: 'inside',
                        rangemode: 'tozero'
                    },
                    showlegend: false // Legend is redundant since x-axis labels are section names
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
                                { format: 'png', filename: 'chart' }
                            );
                        }
                    }]
                }}

                style={{ width: "100%", height: "450px" }}
            />
        </div>
    );
};

export default SpacingBoxPlotChart;
