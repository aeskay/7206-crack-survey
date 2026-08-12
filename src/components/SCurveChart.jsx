import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';

const getSCurveData = (filteredCracks, surveyDays, startStation = null, endStation = null) => {
  let prevUniqueSpacings = null;
  let prevCumulativePercent = null;
  let overlapCount = 0;

  return surveyDays.map((day, index) => {
    const daysUpToCurrent = surveyDays.slice(0, index + 1).map(d => parseInt(d.id, 10));
    const dayCracks = filteredCracks.filter(c => daysUpToCurrent.includes(parseInt(c.day_id, 10)));
    
    let sortedDists = dayCracks.map(c => c.distance).sort((a, b) => a - b);
    
    if (startStation !== null && endStation !== null) {
      const distsSet = new Set(sortedDists);
      if (!distsSet.has(startStation)) sortedDists.unshift(startStation);
      if (!distsSet.has(endStation)) sortedDists.push(endStation);
      sortedDists.sort((a, b) => a - b);
    } else if (sortedDists.length < 2) {
      return null;
    }

    const spacings = [];
    for (let i = 1; i < sortedDists.length; i++) {
      spacings.push(sortedDists[i] - sortedDists[i - 1]);
    }

    const sortedSpacings = [...spacings].sort((a, b) => a - b);
    
    const uniqueSpacings = [];
    const cumulativePercent = [];
    
    for (let i = 0; i < sortedSpacings.length; i++) {
      if (i === sortedSpacings.length - 1 || sortedSpacings[i] !== sortedSpacings[i + 1]) {
        uniqueSpacings.push(sortedSpacings[i]);
        cumulativePercent.push(((i + 1) / sortedSpacings.length) * 100);
      }
    }

    let isIdentical = false;
    if (prevUniqueSpacings && prevUniqueSpacings.length === uniqueSpacings.length) {
      isIdentical = prevUniqueSpacings.every((v, i) => v === uniqueSpacings[i]) &&
                    prevCumulativePercent.every((v, i) => v === cumulativePercent[i]);
    }

    if (isIdentical) {
      overlapCount++;
    } else {
      overlapCount = 0;
    }

    prevUniqueSpacings = uniqueSpacings;
    prevCumulativePercent = cumulativePercent;

    return {
      x: uniqueSpacings,
      y: cumulativePercent,
      type: 'scatter',
      mode: 'lines+markers',
      name: day.name,
      line: { 
          color: day.color,
          width: 2.5,
          dash: ['solid', 'dash', 'dot', 'dashdot', 'longdash'][overlapCount % 5]
      },
      marker: { 
          size: 7,
          symbol: ['circle', 'square', 'diamond', 'triangle-up', 'x'][overlapCount % 5]
      }
    };
  }).filter(d => d !== null);
};

const SCurveCommonLayout = {
  autosize: true,
  margin: { l: 70, r: 30, t: 30, b: 70 },
  xaxis: {
    title: { text: '<b>Crack Spacing (ft)</b>', font: { size: 16, color: 'black' } },
    tickfont: { size: 14, color: 'black' },
    showline: true, linewidth: 1, linecolor: 'black', mirror: true, ticks: 'inside',
    dtick: 2,
    tick0: 0,
    rangemode: 'nonnegative'
  },
  yaxis: {
    title: { text: '<b>Cumulative Percentage (%)</b>', font: { size: 16, color: 'black' } },
    tickfont: { size: 14, color: 'black' },
    showline: true, linewidth: 1, linecolor: 'black', mirror: true, ticks: 'inside',
    range: [0, 105]
  },
  legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center', font: { color: 'black', size: 14 }, bordercolor: 'black', borderwidth: 1 }
};

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
          link.download = `crack-survey-scurve-${name.replace(/\s+/g, '-').toLowerCase()}.png`;
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

const SCurveChart = ({ cracks, surveyDays, sections }) => {
  const [expandedSections, setExpandedSections] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  // Toggle logic
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
  
  const overviewData = getSCurveData(cracks, chartSurveyDays, projectStart, totalLength);

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
      {/* Overview Card */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 className="title" style={{ margin: 0 }}>Project Overview S-Curve</h2>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => handleCopy('scurve-overview', overviewMetadata, 'overview')}
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
              onClick={() => handleExport('scurve-overview', overviewMetadata, 'overview', 'download')}
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
          divId="scurve-overview"
          data={overviewData}
          layout={SCurveCommonLayout}
          useResizeHandler={true}
          config={{ displayModeBar: false }}
          style={{ width: "100%", height: "400px" }}
        />
      </div>

      {/* Collapsible Section S-Curves */}
      {sections && sections.length > 0 && (
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
            Section S-Curves
          </h3>
          {sections.map((sec, idx) => {
            const isOpen = !!expandedSections[idx];
            const secCracks = cracks.filter(
              (c) => c.distance >= sec.start_station && c.distance <= sec.end_station
            );

            const secUniqueDists = new Set(secCracks.map(c => c.distance));
            let secSpacingPoints = secUniqueDists.size;
            if (!secUniqueDists.has(sec.start_station)) secSpacingPoints++;
            if (!secUniqueDists.has(sec.end_station)) secSpacingPoints++;
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
                        onClick={() => handleCopy(`scurve-sec-${idx}`, sectionMetadata, `sec-${idx}`)}
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
                        onClick={() => handleExport(`scurve-sec-${idx}`, sectionMetadata, sec.name, 'download')}
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
                      divId={`scurve-sec-${idx}`}
                      data={getSCurveData(secCracks, chartSurveyDays, sec.start_station, sec.end_station)}
                      layout={SCurveCommonLayout}
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

export default SCurveChart;
