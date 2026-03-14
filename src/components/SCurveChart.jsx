import React, { useState } from 'react';
import Plot from 'react-plotly.js';

const getSCurveData = (filteredCracks, surveyDays) => {
  return surveyDays.map((day, index) => {
    const daysUpToCurrent = surveyDays.slice(0, index + 1).map(d => parseInt(d.id, 10));
    const dayCracks = filteredCracks.filter(c => daysUpToCurrent.includes(parseInt(c.day_id, 10)));
    if (dayCracks.length < 2) return null;

    const sortedDists = dayCracks.map(c => c.distance).sort((a, b) => a - b);
    const spacings = [];
    for (let i = 1; i < sortedDists.length; i++) {
      spacings.push(sortedDists[i] - sortedDists[i - 1]);
    }

    const sortedSpacings = [...spacings].sort((a, b) => a - b);
    const cumulativePercent = sortedSpacings.map((_, i) => ((i + 1) / sortedSpacings.length) * 100);

    return {
      x: sortedSpacings,
      y: cumulativePercent,
      type: 'scatter',
      mode: 'lines+markers',
      name: day.name,
      line: { color: day.color }
    };
  }).filter(d => d !== null);
};

const SCurveCommonLayout = {
  autosize: true,
  margin: { l: 70, r: 30, t: 30, b: 70 },
  xaxis: {
    title: { text: '<b>Crack Spacing (ft)</b>', font: { size: 16 } },
    dtick: 2,
    tick0: 0
  },
  yaxis: {
    title: { text: '<b>Cumulative Percentage (%)</b>', font: { size: 16 } },
    range: [0, 105]
  },
  legend: { orientation: 'h', y: -0.25 }
};

const SCurveChart = ({ cracks, surveyDays, sections }) => {
  const [expandedSections, setExpandedSections] = useState({});

  // Toggle logic
  const toggleSection = (idx) => {
    setExpandedSections(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  if (!cracks || cracks.length === 0) return null;

  const overviewData = getSCurveData(cracks, surveyDays);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Overview Card */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h2 className="title">Project Overview S-Curve</h2>
        <Plot
          data={overviewData}
          layout={SCurveCommonLayout}
          useResizeHandler={true}
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

            const avgSpacing = secCracks.length > 0 ? ((sec.end_station - sec.start_station) / secCracks.length).toFixed(1) : '—';

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
                      Sta. {sec.start_station} – {sec.end_station}
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
                    <Plot
                      data={getSCurveData(secCracks, surveyDays)}
                      layout={SCurveCommonLayout}
                      useResizeHandler={true}
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
