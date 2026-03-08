import React from 'react';
import Plot from 'react-plotly.js';

const CrackPropagationChart = ({ cracks, surveyDays, sections }) => {
    if (!cracks || cracks.length === 0 || sections.length === 0 || surveyDays.length === 0) return null;

    // For each section, we want a line showing cumulative cracks over time
    // X-axis: Survey Day Names (ordered as they appear in the array)
    const xValues = surveyDays.map(day => day.name);

    const data = sections.map((sec, idx) => {
        const secCracks = cracks.filter(c => c.distance >= sec.start_station && c.distance <= sec.end_station);

        // Calculate cumulative count for each day
        const yValues = surveyDays.map((day, dayIndex) => {
            const daysUpToCurrent = surveyDays.slice(0, dayIndex + 1).map(d => parseInt(d.id, 10));
            const cracksUpToDay = secCracks.filter(c => daysUpToCurrent.includes(parseInt(c.day_id, 10)));
            return cracksUpToDay.length;
        });

        // Use a default color palette if section colors aren't defined
        const colors = ['#2563eb', '#dc2626', '#16a34a', '#8b5cf6', '#f59e0b', '#0ea5e9', '#db2777', '#14b8a6'];

        return {
            x: xValues,
            y: yValues,
            type: 'scatter',
            mode: 'lines+markers',
            name: sec.name,
            line: { width: 3, color: colors[idx % colors.length] },
            marker: { size: 8 }
        };
    });

    return (
        <div className="card">
            <h2 className="title">Crack Propagation Rate</h2>
            <Plot
                data={data}
                layout={{
                    autosize: true,
                    margin: { l: 60, r: 30, t: 30, b: 70 },
                    xaxis: {
                        title: { text: 'Survey Day', font: { size: 14 } },
                    },
                    yaxis: {
                        title: { text: 'Cumulative Crack Count', font: { size: 14 } },
                        rangemode: 'tozero'
                    },
                    legend: { orientation: 'h', y: -0.25 }
                }}
                useResizeHandler={true}
                style={{ width: "100%", height: "450px" }}
            />
        </div>
    );
};

export default CrackPropagationChart;
