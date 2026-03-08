import React from 'react';
import Plot from 'react-plotly.js';

const SpacingBoxPlotChart = ({ cracks, sections }) => {
    if (!cracks || cracks.length === 0 || sections.length === 0) return null;

    const data = sections.map((sec, idx) => {
        // Get all cracks in this section across all days
        const secCracks = cracks
            .filter(c => c.distance >= sec.start_station && c.distance <= sec.end_station)
            .sort((a, b) => a.distance - b.distance);

        const spacings = [];
        for (let i = 1; i < secCracks.length; i++) {
            spacings.push(secCracks[i].distance - secCracks[i - 1].distance);
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

    return (
        <div className="card">
            <h2 className="title">Crack Spacing Distribution (Box Plots)</h2>
            <Plot
                data={data}
                layout={{
                    autosize: true,
                    margin: { l: 60, r: 30, t: 30, b: 70 },
                    xaxis: {
                        title: { text: 'Pavement Section', font: { size: 14 } },
                    },
                    yaxis: {
                        title: { text: 'Crack Spacing (ft)', font: { size: 14 } },
                        rangemode: 'tozero'
                    },
                    showlegend: false // Legend is redundant since x-axis labels are section names
                }}
                useResizeHandler={true}
                style={{ width: "100%", height: "450px" }}
            />
        </div>
    );
};

export default SpacingBoxPlotChart;
