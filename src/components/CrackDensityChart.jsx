import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';

const handleExport = (divId, metadata, name, action) => {
  return new Promise((resolve, reject) => {
    const gd = document.getElementById(divId);
    if (!gd) return resolve();

    Plotly.toImage(gd, { format: 'png', scale: 2 }).then(dataUrl => {
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
          link.download = `crack-survey-density-${name.replace(/\s+/g, '-').toLowerCase()}.png`;
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

const CrackDensityChart = ({ cracks, surveyDays, sections }) => {
    const [copiedId, setCopiedId] = useState(null);

    if (!cracks || cracks.length === 0 || sections.length === 0 || surveyDays.length === 0) return null;

    const handleCopy = (divId, metadata, idString) => {
        handleExport(divId, metadata, idString, 'copy').then(() => {
            setCopiedId(idString);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    const sectionNames = sections.map(sec => sec.name);
    const chartSurveyDays = surveyDays.filter(day => day.name !== 'ACC');

    // Create a trace for each survey day
    const data = chartSurveyDays.map((day, dayIndex) => {
        // Calculate the crack count for this specific day across all sections
        const yValues = sections.map(sec => {
            // Count ONLY the cracks that occurred ON this survey day, not cumulative?
            // User requested: "total number of cracks per section, segmented by Survey Day."
            // This usually implies a stacked bar chart showing new cracks per day, OR grouped bars.
            // Let's do cumulative up to that day as grouped bars to be safe, or just discrete counts.
            // Let's make it the absolute count of cracks added ON that day, stacking them to show total growth.
            // Grouped bars: discrete or cumulative? Discrete per day is easiest to read for density.
            const secCracks = cracks.filter(c =>
                c.distance >= sec.start_station &&
                c.distance <= sec.end_station &&
                String(c.day_id) === String(day.id)
            );
            return secCracks.length;
        });

        return {
            x: sectionNames,
            y: yValues,
            name: day.name,
            type: 'bar',
            marker: { color: day.color }
        };
    });

    const projectStart = sections && sections.length > 0 ? sections[0].start_station : 0;
    const totalLength = sections && sections.length > 0 ? sections[sections.length - 1].end_station : 1000;
    const overviewMetadata = `Crack Density per Section  |  DMI ${projectStart} - ${totalLength}`;

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="title" style={{ margin: 0 }}>Crack Density per Section (Stacked)</h2>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={() => handleCopy('crack-density-plot', overviewMetadata, 'overview')}
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
                        onClick={() => handleExport('crack-density-plot', overviewMetadata, 'overview', 'download')}
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
                </div>
            </div>
            <Plot
                divId="crack-density-plot"
                data={data}
                layout={{
                    autosize: true,
                    barmode: 'stack', // Stacked bars make it easy to see total + what day contributed what
                    margin: { l: 60, r: 30, t: 30, b: 70 },
                    xaxis: {
                        title: { text: '<b>Pavement Section</b>', font: { size: 16, color: 'black' } },
                        tickfont: { size: 14, color: 'black' },
                        showline: true, linewidth: 1, linecolor: 'black', mirror: 'all', ticks: 'inside',
                    },
                    yaxis: {
                        title: { text: '<b>Number of Cracks</b>', font: { size: 16, color: 'black' } },
                        tickfont: { size: 14, color: 'black' },
                        showline: true, linewidth: 1, linecolor: 'black', mirror: 'all', ticks: 'inside',
                    },
                    legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center', font: { color: 'black', size: 14 }, bordercolor: 'black', borderwidth: 1 }
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

export default CrackDensityChart;
